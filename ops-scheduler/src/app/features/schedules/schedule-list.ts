import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Schedule, ScheduleInsert } from '../../core/models/schedule.model';
import { ScheduleService } from '../../core/services/schedule.service';
import { extractErrorMessage } from '../../core/util/http-error';

function defaultStartTime(): string {
  const now = new Date();
  now.setSeconds(0, 0);
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

@Component({
  selector: 'app-schedule-list',
  imports: [FormsModule],
  templateUrl: './schedule-list.html'
})
export class ScheduleList {
  private readonly scheduleService = inject(ScheduleService);

  readonly selectedId = input<number | null>(null);
  readonly selectedIdChange = output<number | null>();
  readonly selectedScheduleChange = output<Schedule | null>();

  readonly schedules = signal<Schedule[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly showCreateForm = signal(false);
  readonly creating = signal(false);
  readonly newName = signal('');
  readonly newStartTime = signal(defaultStartTime());
  readonly newStartOrbitNumber = signal(1);
  readonly newStartOrbitAngle = signal(0);
  readonly newOrbitDurationSeconds = signal(5700);

  constructor() {
    this.refresh();
  }

  refresh(): void {
    this.loading.set(true);
    this.error.set(null);
    this.scheduleService.list().subscribe({
      next: (schedules) => {
        this.schedules.set(schedules);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(extractErrorMessage(err));
        this.loading.set(false);
      }
    });
  }

  select(schedule: Schedule): void {
    this.selectedIdChange.emit(schedule.id);
    this.selectedScheduleChange.emit(schedule);
  }

  updateInList(schedule: Schedule): void {
    this.schedules.update((list) =>
      list.map((s) => (s.id === schedule.id ? schedule : s)).sort((a, b) => a.name.localeCompare(b.name))
    );
  }

  openCreateForm(): void {
    this.showCreateForm.set(true);
  }

  cancelCreate(): void {
    this.showCreateForm.set(false);
    this.newName.set('');
    this.newStartTime.set(defaultStartTime());
    this.newStartOrbitNumber.set(1);
    this.newStartOrbitAngle.set(0);
    this.newOrbitDurationSeconds.set(5700);
  }

  createSchedule(): void {
    const name = this.newName().trim();
    if (!name || !this.newStartTime()) {
      return;
    }
    const insert: ScheduleInsert = {
      name,
      start_time: new Date(this.newStartTime()).toISOString(),
      start_orbit_number: this.newStartOrbitNumber(),
      start_orbit_angle: this.newStartOrbitAngle(),
      orbit_duration_seconds: this.newOrbitDurationSeconds()
    };
    this.creating.set(true);
    this.error.set(null);
    this.scheduleService.create(insert).subscribe({
      next: (created) => {
        this.schedules.update((list) => [...list, created].sort((a, b) => a.name.localeCompare(b.name)));
        this.creating.set(false);
        this.cancelCreate();
        this.selectedIdChange.emit(created.id);
        this.selectedScheduleChange.emit(created);
      },
      error: (err: unknown) => {
        this.error.set(extractErrorMessage(err));
        this.creating.set(false);
      }
    });
  }

  deleteSchedule(schedule: Schedule, event: Event): void {
    event.stopPropagation();
    if (!confirm(`Delete schedule "${schedule.name}"? This is only possible if it has no scheduled modules.`)) {
      return;
    }
    this.error.set(null);
    this.scheduleService.delete(schedule.id).subscribe({
      next: () => {
        this.schedules.update((list) => list.filter((s) => s.id !== schedule.id));
        if (this.selectedId() === schedule.id) {
          this.selectedIdChange.emit(null);
          this.selectedScheduleChange.emit(null);
        }
      },
      error: (err: unknown) => this.error.set(extractErrorMessage(err))
    });
  }
}
