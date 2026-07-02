import { Module } from './module.model';

export interface ScheduleModule {
  id: number;
  schedule_id: number;
  module_id: number;
  relative_time_seconds: number | null;
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
  relative_time_seconds?: number | null;
  delta_orbit_number?: number | null;
  delta_orbit_angle?: number | null;
}

export interface ScheduleModuleUpdate {
  module_id?: number;
  relative_time_seconds?: number | null;
  delta_orbit_number?: number | null;
  delta_orbit_angle?: number | null;
}
