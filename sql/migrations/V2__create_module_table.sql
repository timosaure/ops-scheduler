CREATE TYPE module_type AS ENUM ('MTL', 'OPS');

CREATE TABLE module (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    module_group_id  BIGINT NOT NULL REFERENCES module_group(id) ON DELETE RESTRICT,
    name             TEXT NOT NULL,
    type             module_type NOT NULL,
    subschedule      INTEGER NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_module_module_group_id ON module(module_group_id);
