-- Application prechecks provide precise errors; database indexes also protect
-- concurrent requests. Existing duplicates must be resolved before migration.
ALTER TABLE sys_post
    ADD CONSTRAINT uk_sys_post_code UNIQUE (post_code),
    ADD CONSTRAINT uk_sys_post_name UNIQUE (post_name);
