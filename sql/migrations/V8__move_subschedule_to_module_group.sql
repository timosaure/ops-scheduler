ALTER TABLE module_group
    ADD COLUMN subschedule INTEGER;

UPDATE module_group mg
SET subschedule = COALESCE(
    (SELECT m.subschedule FROM module m WHERE m.module_group_id = mg.id ORDER BY m.id LIMIT 1),
    0
);

ALTER TABLE module_group
    ALTER COLUMN subschedule SET NOT NULL;

ALTER TABLE module
    DROP COLUMN subschedule;
