CREATE TABLE schedule_module (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    schedule_id             BIGINT NOT NULL REFERENCES schedule(id) ON DELETE CASCADE,
    module_id               BIGINT NOT NULL REFERENCES module(id) ON DELETE RESTRICT,
    relative_time_seconds   NUMERIC,
    delta_orbit_number      INTEGER,
    delta_orbit_angle       NUMERIC,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT schedule_module_exactly_one_relative_position CHECK (
        (relative_time_seconds IS NOT NULL)
        <> (delta_orbit_number IS NOT NULL AND delta_orbit_angle IS NOT NULL)
    )
);
