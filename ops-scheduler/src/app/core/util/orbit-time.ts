import { Command } from '../models/command.model';
import { Module } from '../models/module.model';
import { ScheduleModule } from '../models/schedule-module.model';
import { Schedule } from '../models/schedule.model';

export interface OrbitPosition {
  orbitNumber: number;
  orbitAngle: number;
}

/** Seconds elapsed from the schedule's start_time to the point where a placed module begins. */
export function scheduleModuleElapsedSeconds(schedule: Schedule, scheduleModule: ScheduleModule): number {
  if (scheduleModule.relative_time_seconds != null) {
    return scheduleModule.relative_time_seconds;
  }
  const deltaOrbits = (scheduleModule.delta_orbit_number ?? 0) + (scheduleModule.delta_orbit_angle ?? 0) / 360;
  return deltaOrbits * schedule.orbit_duration_seconds;
}

/** Seconds elapsed from the schedule's start_time to when a specific command executes. */
export function commandElapsedSeconds(
  schedule: Schedule,
  scheduleModule: ScheduleModule,
  module: Module,
  command: Command
): number {
  const moduleStart = scheduleModuleElapsedSeconds(schedule, scheduleModule);
  if (module.type === 'MTL') {
    return moduleStart + (command.relative_time_seconds ?? 0);
  }
  return moduleStart + ((command.relative_orbit_angle ?? 0) / 360) * schedule.orbit_duration_seconds;
}

/** Orbit number/angle at a given number of seconds elapsed since the schedule's start_time. */
export function orbitPositionAtElapsedSeconds(schedule: Schedule, elapsedSeconds: number): OrbitPosition {
  const phase =
    schedule.start_orbit_number + schedule.start_orbit_angle / 360 + elapsedSeconds / schedule.orbit_duration_seconds;
  const orbitNumber = Math.floor(phase);
  const orbitAngle = (phase - orbitNumber) * 360;
  return { orbitNumber, orbitAngle };
}

export function absoluteTimeAtElapsedSeconds(schedule: Schedule, elapsedSeconds: number): Date {
  return new Date(new Date(schedule.start_time).getTime() + elapsedSeconds * 1000);
}
