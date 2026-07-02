CREATE TABLE schedule (
    id                       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name                     TEXT NOT NULL,
    start_time               TIMESTAMPTZ NOT NULL,
    start_orbit_number       INTEGER NOT NULL,
    start_orbit_angle        NUMERIC NOT NULL,
    orbit_duration_seconds   NUMERIC NOT NULL,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
