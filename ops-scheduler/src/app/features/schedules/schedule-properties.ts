import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Schedule, ScheduleUpdate } from '../../core/models/schedule.model';
import { ScheduleService } from '../../core/services/schedule.service';
import { INVALID_DATE_TIME, formatDateTimeInput, parseDateTimeInput } from '../../core/util/datetime-input';
import { extractErrorMessage } from '../../core/util/http-error';

@Component({
  selector: 'app-schedule-properties',
  imports: [FormsModule],
  templateUrl: './schedule-properties.html'
})
export class ScheduleProperties {
  private readonly scheduleService = inject(ScheduleService);

  readonly schedule = input.required<Schedule>();
  readonly updated = output<Schedule>();

  readonly error = signal<string | null>(null);

  readonly name = signal('');
  readonly startTime = signal('');
  readonly startOrbitNumber = signal(0);
  readonly startOrbitAngle = signal(0);
  readonly orbitDurationSeconds = signal(0);

  constructor() {
    effect(() => {
      const schedule = this.schedule();
      this.name.set(schedule.name);
      this.startTime.set(formatDateTimeInput(schedule.start_time));
      this.startOrbitNumber.set(schedule.start_orbit_number);
      this.startOrbitAngle.set(schedule.start_orbit_angle);
      this.orbitDurationSeconds.set(schedule.orbit_duration_seconds);
    });
  }

  save(field: keyof ScheduleUpdate): void {
    const schedule = this.schedule();
    let value: string | number;
    switch (field) {
      case 'name':
        value = this.name().trim();
        if (!value || value === schedule.name) {
          this.name.set(schedule.name);
          return;
        }
        break;
      case 'start_time': {
        const parsed = parseDateTimeInput(this.startTime());
        if (parsed === INVALID_DATE_TIME) {
          this.error.set('Start time is not a valid ISO 8601 date-time.');
          this.startTime.set(formatDateTimeInput(schedule.start_time));
          return;
        }
        if (parsed === schedule.start_time) {
          return;
        }
        value = parsed;
        break;
      }
      case 'start_orbit_number':
        value = this.startOrbitNumber();
        if (value === schedule.start_orbit_number) {
          return;
        }
        break;
      case 'start_orbit_angle':
        value = this.startOrbitAngle();
        if (value === schedule.start_orbit_angle) {
          return;
        }
        break;
      case 'orbit_duration_seconds':
        value = this.orbitDurationSeconds();
        if (value === schedule.orbit_duration_seconds) {
          return;
        }
        break;
    }
    this.error.set(null);
    this.scheduleService.update(schedule.id, { [field]: value } as ScheduleUpdate).subscribe({
      next: (updated) => this.updated.emit(updated),
      error: (err: unknown) => {
        this.error.set(extractErrorMessage(err));
        const schedule = this.schedule();
        this.name.set(schedule.name);
        this.startTime.set(formatDateTimeInput(schedule.start_time));
        this.startOrbitNumber.set(schedule.start_orbit_number);
        this.startOrbitAngle.set(schedule.start_orbit_angle);
        this.orbitDurationSeconds.set(schedule.orbit_duration_seconds);
      }
    });
  }
}
