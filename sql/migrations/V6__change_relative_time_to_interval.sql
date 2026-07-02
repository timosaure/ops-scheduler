ALTER TABLE command
    DROP CONSTRAINT command_exactly_one_relative_position;

ALTER TABLE command
    ALTER COLUMN relative_time_seconds TYPE INTERVAL USING relative_time_seconds * INTERVAL '1 second';

ALTER TABLE command
    RENAME COLUMN relative_time_seconds TO relative_time;

ALTER TABLE command
    ADD CONSTRAINT command_exactly_one_relative_position CHECK (
        (relative_time IS NOT NULL) <> (relative_orbit_angle IS NOT NULL)
    );

ALTER TABLE schedule_module
    DROP CONSTRAINT schedule_module_exactly_one_relative_position;

ALTER TABLE schedule_module
    ALTER COLUMN relative_time_seconds TYPE INTERVAL USING relative_time_seconds * INTERVAL '1 second';

ALTER TABLE schedule_module
    RENAME COLUMN relative_time_seconds TO relative_time;

ALTER TABLE schedule_module
    ADD CONSTRAINT schedule_module_exactly_one_relative_position CHECK (
        (relative_time IS NOT NULL)
        <> (delta_orbit_number IS NOT NULL AND delta_orbit_angle IS NOT NULL)
    );

-- PostgREST serializes interval columns to JSON as text using the session's IntervalStyle.
-- Use ISO 8601 so the frontend can parse the value with a standard duration library (luxon).
ALTER ROLE app_user SET intervalstyle = 'iso_8601';
