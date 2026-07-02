export interface Schedule {
  id: number;
  name: string;
  start_time: string;
  start_orbit_number: number;
  start_orbit_angle: number;
  orbit_duration_seconds: number;
  created_at: string;
}

export interface ScheduleInsert {
  name: string;
  start_time: string;
  start_orbit_number: number;
  start_orbit_angle: number;
  orbit_duration_seconds: number;
}

export interface ScheduleUpdate {
  name?: string;
  start_time?: string;
  start_orbit_number?: number;
  start_orbit_angle?: number;
  orbit_duration_seconds?: number;
}
