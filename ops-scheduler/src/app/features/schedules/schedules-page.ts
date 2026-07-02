import { Component, inject, signal, viewChild } from '@angular/core';
import { map, switchMap } from 'rxjs';

import { Command } from '../../core/models/command.model';
import { Schedule } from '../../core/models/schedule.model';
import { CommandService } from '../../core/services/command.service';
import { ScheduleModuleService } from '../../core/services/schedule-module.service';
import { downloadBlob } from '../../core/util/download-file';
import { extractErrorMessage } from '../../core/util/http-error';
import { buildScheduleWorkbook } from '../../core/util/schedule-workbook';
import { ScheduleList } from './schedule-list';
import { ScheduleModuleTable } from './schedule-module-table';
import { ScheduleProperties } from './schedule-properties';

const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@Component({
  selector: 'app-schedules-page',
  imports: [ScheduleList, ScheduleProperties, ScheduleModuleTable],
  templateUrl: './schedules-page.html'
})
export class SchedulesPage {
  private readonly scheduleModuleService = inject(ScheduleModuleService);
  private readonly commandService = inject(CommandService);
  private readonly scheduleList = viewChild.required(ScheduleList);

  readonly selectedSchedule = signal<Schedule | null>(null);
  readonly exporting = signal(false);
  readonly exportError = signal<string | null>(null);

  onSelectedScheduleChange(schedule: Schedule | null): void {
    this.selectedSchedule.set(schedule);
  }

  onScheduleUpdated(schedule: Schedule): void {
    this.selectedSchedule.set(schedule);
    this.scheduleList().updateInList(schedule);
  }

  exportToExcel(): void {
    const schedule = this.selectedSchedule();
    if (!schedule) {
      return;
    }
    this.exporting.set(true);
    this.exportError.set(null);
    this.scheduleModuleService
      .listBySchedule(schedule.id)
      .pipe(
        switchMap((scheduleModules) => {
          const moduleIds = Array.from(new Set(scheduleModules.map((sm) => sm.module_id)));
          return this.commandService
            .listByModules(moduleIds)
            .pipe(map((commands) => ({ scheduleModules, commands })));
        })
      )
      .subscribe({
        next: ({ scheduleModules, commands }) => {
          const commandsByModuleId = new Map<number, Command[]>();
          for (const command of commands) {
            const list = commandsByModuleId.get(command.module_id);
            if (list) {
              list.push(command);
            } else {
              commandsByModuleId.set(command.module_id, [command]);
            }
          }
          const workbook = buildScheduleWorkbook(schedule, scheduleModules, commandsByModuleId);
          workbook.xlsx.writeBuffer().then((buffer) => {
            downloadBlob(new Blob([buffer], { type: XLSX_MIME_TYPE }), `${schedule.name}.xlsx`);
            this.exporting.set(false);
          });
        },
        error: (err: unknown) => {
          this.exportError.set(extractErrorMessage(err));
          this.exporting.set(false);
        }
      });
  }
}
