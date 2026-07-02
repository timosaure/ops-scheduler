import { Duration } from 'luxon';

import { Command } from '../models/command.model';
import { Module } from '../models/module.model';
import { ScheduleModule } from '../models/schedule-module.model';
import { Schedule } from '../models/schedule.model';

export interface OrbitPosition {
  orbitNumber: number;
  orbitAngle: number;
}

function isoDurationSeconds(iso: string): number {
  return Duration.fromISO(iso).as('seconds');
}

/** Seconds elapsed from the schedule's start_time to the point where a placed module begins. */
export function scheduleModuleElapsedSeconds(
  schedule: Schedule,
  scheduleModule: ScheduleModule,
): number {
  if (scheduleModule.relative_time != null) {
    return isoDurationSeconds(scheduleModule.relative_time);
  }
  const deltaOrbitNumber = scheduleModule.delta_orbit_number ?? 0;
  const deltaOrbitAngle = scheduleModule.delta_orbit_angle ?? 0;
  // Orbit 0 relative to the schedule is the partial orbit already under way when the scenario
  // starts, so its angle builds onward from start_orbit_angle. Every other orbit is a full
  // revolution measured from its own zero reference, independent of start_orbit_angle.
  const deltaOrbits =
    deltaOrbitNumber === 0
      ? deltaOrbitAngle / 360
      : deltaOrbitNumber + (deltaOrbitAngle - schedule.start_orbit_angle) / 360;
  return deltaOrbits * schedule.orbit_duration_seconds;
}

/** Seconds elapsed from the schedule's start_time to when a specific command executes. */
export function commandElapsedSeconds(
  schedule: Schedule,
  scheduleModule: ScheduleModule,
  module: Module,
  command: Command,
): number {
  const moduleStart = scheduleModuleElapsedSeconds(schedule, scheduleModule);
  if (module.type === 'MTL') {
    return (
      moduleStart + (command.relative_time != null ? isoDurationSeconds(command.relative_time) : 0)
    );
  }
  return (
    moduleStart + ((command.relative_orbit_angle ?? 0) / 360) * schedule.orbit_duration_seconds
  );
}

/** Orbit number/angle at a given number of seconds elapsed since the schedule's start_time. */
export function orbitPositionAtElapsedSeconds(
  schedule: Schedule,
  elapsedSeconds: number,
): OrbitPosition {
  const phase =
    schedule.start_orbit_number +
    schedule.start_orbit_angle / 360 +
    elapsedSeconds / schedule.orbit_duration_seconds;
  const orbitNumber = Math.floor(phase);
  const orbitAngle = (phase - orbitNumber) * 360;
  return { orbitNumber, orbitAngle };
}

export function absoluteTimeAtElapsedSeconds(schedule: Schedule, elapsedSeconds: number): Date {
  return new Date(new Date(schedule.start_time).getTime() + elapsedSeconds * 1000);
}

/**
 * Formats a relative time (ISO 8601 duration string, as returned by Postgres's `interval` type) as "hh:mm:ss.SSS".
 * Computed manually rather than via Duration.toISOTime(), which refuses to format negative durations or
 * ones >= 24 hours — both of which are valid relative times in this domain.
 */
export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) {
    return '';
  }
  const duration = Duration.fromISO(iso);
  if (!duration.isValid) {
    return '';
  }
  const totalMillis = Math.round(duration.as('milliseconds'));
  const sign = totalMillis < 0 ? '-' : '';
  const absMillis = Math.abs(totalMillis);
  const millis = absMillis % 1000;
  const totalSeconds = Math.floor(absMillis / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  const pad = (value: number, length: number) => String(value).padStart(length, '0');
  return `${sign}${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)}.${pad(millis, 3)}`;
}

/** Formats a plain number of seconds (e.g. a module's duration) as "hh:mm:ss". */
export function formatDurationSeconds(totalSeconds: number): string {
  const sign = totalSeconds < 0 ? '-' : '';
  const duration = Duration.fromObject({ seconds: Math.round(Math.abs(totalSeconds)) }).shiftTo(
    'hours',
    'minutes',
    'seconds'
  );
  return `${sign}${duration.toFormat('hh:mm:ss')}`;
}

/** Sentinel returned by parseRelativeTime when the input doesn't match the expected hh:mm:ss.SSS format. */
export const INVALID_RELATIVE_TIME = 'invalid-relative-time';

/**
 * Parses a relative time entered as "hh:mm:ss.SSS" into an ISO 8601 duration string suitable for
 * Postgres's `interval` type. Delegates to luxon's ISO-time parser (Duration.fromISOTime), which
 * accepts the shorter forms it documents (e.g. "hh:mm") too; an optional leading "-" is handled
 * separately since ISO time-of-day strings have no sign of their own.
 * Returns null for an empty value and INVALID_RELATIVE_TIME for a value that doesn't match the expected format.
 */
export function parseRelativeTime(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }
  const negative = trimmed.startsWith('-');
  const duration = Duration.fromISOTime(negative ? trimmed.slice(1) : trimmed);
  if (!duration.isValid) {
    return INVALID_RELATIVE_TIME;
  }
  return (negative ? duration.negate() : duration).toISO() ?? INVALID_RELATIVE_TIME;
}
