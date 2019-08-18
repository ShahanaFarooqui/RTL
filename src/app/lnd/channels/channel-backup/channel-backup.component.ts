import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';

import { Subject } from 'rxjs';
import { takeUntil, filter } from 'rxjs/operators';
import { Store } from '@ngrx/store';
import { Actions } from '@ngrx/effects';

import { MatTableDataSource, MatSort } from '@angular/material';
import { Node } from '../../../shared/models/RTLconfig';
import { Channel } from '../../../shared/models/lndModels';
import { LoggerService } from '../../../shared/services/logger.service';

import * as LNDActions from '../../store/lnd.actions';
import * as RTLActions from '../../../store/rtl.actions';
import * as fromApp from '../../../store/rtl.reducers';

@Component({
  selector: 'rtl-channel-backup',
  templateUrl: './channel-backup.component.html',
  styleUrls: ['./channel-backup.component.scss']
})
export class ChannelBackupComponent implements OnInit, OnDestroy {
  @ViewChild(MatSort, { static: true }) sort: MatSort;
  public selNode: Node;
  public displayedColumns = ['chan_id', 'backup', 'verify'];
  public selChannel: Channel;
  public channels: any;
  public flgLoading: Array<Boolean | 'error'> = [true];
  public flgSticky = false;
  private unSubs: Array<Subject<void>> = [new Subject(), new Subject(), new Subject(), new Subject(), new Subject()];

  constructor(private logger: LoggerService, private store: Store<fromApp.AppState>, private actions$: Actions) {}

  ngOnInit() {
    this.store.select('lnd')
    .pipe(takeUntil(this.unSubs[4]))
    .subscribe(lndStore => {
      this.channels = new MatTableDataSource([]);
      this.channels.data = [];
      if (undefined !== lndStore.allChannels) {
        this.channels = new MatTableDataSource<Channel>([...lndStore.allChannels]);
        this.channels.data = lndStore.allChannels;
      }
      this.channels.sort = this.sort;
      this.channels.filterPredicate = (channel: Channel, fltr: string) => {
        const newChannel = ((channel.active) ? 'active' : 'inactive') + (channel.chan_id ? channel.chan_id : '') +
        (channel.remote_pubkey ? channel.remote_pubkey : '') + (channel.remote_alias ? channel.remote_alias : '') +
        (channel.capacity ? channel.capacity : '') + (channel.local_balance ? channel.local_balance : '') +
        (channel.remote_balance ? channel.remote_balance : '') + (channel.total_satoshis_sent ? channel.total_satoshis_sent : '') +
        (channel.total_satoshis_received ? channel.total_satoshis_received : '') + (channel.commit_fee ? channel.commit_fee : '') +
        (channel.private ? 'private' : 'public');
        return newChannel.includes(fltr);
      };
      if (this.flgLoading[0] !== 'error') {
        this.flgLoading[0] = false;
      }
      this.logger.info(lndStore);
    });
    this.store.select('rtlRoot')
    .pipe(takeUntil(this.unSubs[0]))
    .subscribe((rtlStore: fromApp.RootState) => {
      this.selNode = rtlStore.selNode;
      rtlStore.effectErrors.forEach(effectsErr => {
        if (effectsErr.action === 'Fetchchannels') {
          this.flgLoading[0] = 'error';
        }
      });
      this.logger.info(rtlStore);
    });
    this.actions$
    .pipe(
      takeUntil(this.unSubs[1]),
      filter((action) => action.type === LNDActions.SET_CHANNELS)
    ).subscribe((setchannels: LNDActions.SetChannels) => {
      this.selChannel = undefined;
    });
  }

  onBackupChannels(selChannel: Channel) {
    this.store.dispatch(new RTLActions.OpenSpinner('Backup Channels...'));
    this.store.dispatch(new LNDActions.BackupChannels({channelPoint: (selChannel.channel_point) ? selChannel.channel_point : 'ALL', showMessage: ''}));
  }

  onVerifyChannels(selChannel: Channel) {
    this.store.dispatch(new RTLActions.OpenSpinner('Verify Channels...'));
    this.store.dispatch(new LNDActions.VerifyChannels({channelPoint: (selChannel.channel_point) ? selChannel.channel_point : 'ALL'}));
  }

  onChannelClick(selRow: Channel, event: any) {
    const flgButtonsClicked = event.target.className.includes('mat-icon')
      || event.target.className.includes('mat-column-backup')
      || event.target.className.includes('mat-column-verify');
    if (flgButtonsClicked) { return; }
    const selChannel = this.channels.data.filter(channel => {
      return channel.chan_id === selRow.chan_id;
    })[0];
    const reorderedChannel = JSON.parse(JSON.stringify(selChannel, [
      'active', 'remote_pubkey', 'remote_alias', 'channel_point', 'chan_id', 'capacity', 'local_balance', 'remote_balance', 'commit_fee', 'commit_weight',
      'fee_per_kw', 'unsettled_balance', 'total_satoshis_sent', 'total_satoshis_received', 'num_updates', 'pending_htlcs', 'csv_delay', 'private'
    ] , 2));
    this.store.dispatch(new RTLActions.OpenAlert({ width: '75%', data: {
      type: 'INFO',
      message: JSON.stringify(reorderedChannel)
    }}));
  }

  applyFilter(selFilter: string) {
    this.channels.filter = selFilter;
  }

  ngOnDestroy() {
    this.unSubs.forEach(completeSub => {
      completeSub.next();
      completeSub.complete();
    });
  }

}
