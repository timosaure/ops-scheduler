/** relative_time is an ISO 8601 duration string (e.g. "PT1H2M3.456S"), as serialized by Postgres's `interval` type. */
export interface Command {
  id: number;
  module_id: number;
  name: string;
  relative_time: string | null;
  relative_orbit_angle: number | null;
  created_at: string;
}

export interface CommandInsert {
  module_id: number;
  name: string;
  relative_time?: string | null;
  relative_orbit_angle?: number | null;
}

export interface CommandUpdate {
  name?: string;
  relative_time?: string | null;
  relative_orbit_angle?: number | null;
}
