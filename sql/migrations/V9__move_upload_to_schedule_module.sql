ALTER TABLE schedule_module
    ADD COLUMN upload module_upload;

UPDATE schedule_module sm
SET upload = (SELECT m.upload FROM module m WHERE m.id = sm.module_id);

ALTER TABLE schedule_module
    ALTER COLUMN upload SET NOT NULL;

ALTER TABLE module
    DROP COLUMN upload;
