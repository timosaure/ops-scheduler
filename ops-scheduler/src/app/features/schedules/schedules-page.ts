import { Component, signal, viewChild } from '@angular/core';

import { Schedule } from '../../core/models/schedule.model';
import { ScheduleList } from './schedule-list';
import { ScheduleModuleTable } from './schedule-module-table';
import { ScheduleProperties } from './schedule-properties';

@Component({
  selector: 'app-schedules-page',
  imports: [ScheduleList, ScheduleProperties, ScheduleModuleTable],
  templateUrl: './schedules-page.html'
})
export class SchedulesPage {
  private readonly scheduleList = viewChild.required(ScheduleList);

  readonly selectedSchedule = signal<Schedule | null>(null);

  onSelectedScheduleChange(schedule: Schedule | null): void {
    this.selectedSchedule.set(schedule);
  }

  onScheduleUpdated(schedule: Schedule): void {
    this.selectedSchedule.set(schedule);
    this.scheduleList().updateInList(schedule);
  }
}
