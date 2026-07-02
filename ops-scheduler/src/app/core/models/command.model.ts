export interface Command {
  id: number;
  module_id: number;
  name: string;
  relative_time_seconds: number | null;
  relative_orbit_angle: number | null;
  created_at: string;
}

export interface CommandInsert {
  module_id: number;
  name: string;
  relative_time_seconds?: number | null;
  relative_orbit_angle?: number | null;
}

export interface CommandUpdate {
  name?: string;
  relative_time_seconds?: number | null;
  relative_orbit_angle?: number | null;
}
