import { Component, inject, signal, viewChild } from '@angular/core';
import { Observable, map, switchMap } from 'rxjs';

import { Command } from '../../core/models/command.model';
import { Schedule } from '../../core/models/schedule.model';
import { ScheduleModuleWithModule } from '../../core/models/schedule-module.model';
import { CommandService } from '../../core/services/command.service';
import { ScheduleModuleService } from '../../core/services/schedule-module.service';
import { downloadBlob } from '../../core/util/download-file';
import { extractErrorMessage } from '../../core/util/http-error';
import { buildScheduleJavaSource } from '../../core/util/schedule-java-export';
import { buildScheduleWorkbook } from '../../core/util/schedule-workbook';
import { ScheduleList } from './schedule-list';
import { ScheduleModuleTable } from './schedule-module-table';
import { ScheduleProperties } from './schedule-properties';

const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const JAVA_MIME_TYPE = 'text/x-java-source;charset=utf-8';

interface ScheduleData {
  scheduleModules: ScheduleModuleWithModule[];
  commandsByModuleId: Map<number, Command[]>;
}

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
  readonly exportWarnings = signal<string[] | null>(null);

  onSelectedScheduleChange(schedule: Schedule | null): void {
    this.selectedSchedule.set(schedule);
  }

  onScheduleUpdated(schedule: Schedule): void {
    this.selectedSchedule.set(schedule);
    this.scheduleList().updateInList(schedule);
  }

  private fetchScheduleData(scheduleId: number): Observable<ScheduleData> {
    return this.scheduleModuleService.listBySchedule(scheduleId).pipe(
      switchMap((scheduleModules) => {
        const moduleIds = Array.from(new Set(scheduleModules.map((sm) => sm.module_id)));
        return this.commandService.listByModules(moduleIds).pipe(
          map((commands) => {
            const commandsByModuleId = new Map<number, Command[]>();
            for (const command of commands) {
              const list = commandsByModuleId.get(command.module_id);
              if (list) {
                list.push(command);
              } else {
                commandsByModuleId.set(command.module_id, [command]);
              }
            }
            return { scheduleModules, commandsByModuleId };
          })
        );
      })
    );
  }

  exportToExcel(): void {
    const schedule = this.selectedSchedule();
    if (!schedule) {
      return;
    }
    this.exporting.set(true);
    this.exportError.set(null);
    this.exportWarnings.set(null);
    this.fetchScheduleData(schedule.id).subscribe({
      next: ({ scheduleModules, commandsByModuleId }) => {
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

  exportToJava(): void {
    const schedule = this.selectedSchedule();
    if (!schedule) {
      return;
    }
    this.exporting.set(true);
    this.exportError.set(null);
    this.exportWarnings.set(null);
    this.fetchScheduleData(schedule.id).subscribe({
      next: ({ scheduleModules, commandsByModuleId }) => {
        const { source, warnings } = buildScheduleJavaSource(schedule, scheduleModules, commandsByModuleId);
        downloadBlob(new Blob([source], { type: JAVA_MIME_TYPE }), `${schedule.name}.java`);
        this.exportWarnings.set(warnings.length > 0 ? warnings : null);
        this.exporting.set(false);
      },
      error: (err: unknown) => {
        this.exportError.set(extractErrorMessage(err));
        this.exporting.set(false);
      }
    });
  }
}
