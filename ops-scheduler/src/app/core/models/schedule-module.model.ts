import { Module } from './module.model';

/** relative_time is an ISO 8601 duration string (e.g. "PT1H2M3.456S"), as serialized by Postgres's `interval` type. */
export interface ScheduleModule {
  id: number;
  schedule_id: number;
  module_id: number;
  relative_time: string | null;
  delta_orbit_number: number | null;
  delta_orbit_angle: number | null;
  created_at: string;
}

export interface ScheduleModuleWithModule extends ScheduleModule {
  module: Module & { module_group: { name: string } | null };
}

export interface ScheduleModuleInsert {
  schedule_id: number;
  module_id: number;
  relative_time?: string | null;
  delta_orbit_number?: number | null;
  delta_orbit_angle?: number | null;
}

export interface ScheduleModuleUpdate {
  module_id?: number;
  relative_time?: string | null;
  delta_orbit_number?: number | null;
  delta_orbit_angle?: number | null;
}
