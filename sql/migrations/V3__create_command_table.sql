CREATE TABLE command (
    id                     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    module_id              BIGINT NOT NULL REFERENCES module(id) ON DELETE CASCADE,
    name                   TEXT NOT NULL,
    relative_time_seconds  NUMERIC,
    relative_orbit_angle   NUMERIC,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT command_exactly_one_relative_position CHECK (
        (relative_time_seconds IS NOT NULL) <> (relative_orbit_angle IS NOT NULL)
    )
);
