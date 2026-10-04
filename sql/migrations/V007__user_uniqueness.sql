-- Active-account uniqueness matches the original service checks. Existing active
-- duplicates must be resolved by an operator before applying this migration.
-- Empty optional contacts and deleted accounts do not reserve these identities.
ALTER TABLE sys_user
    ADD COLUMN active_user_name VARCHAR(30) GENERATED ALWAYS AS (CASE WHEN del_flag = '0' THEN user_name ELSE NULL END) STORED,
    ADD COLUMN active_user_phone VARCHAR(11) GENERATED ALWAYS AS (CASE WHEN del_flag = '0' THEN NULLIF(phonenumber, '') ELSE NULL END) STORED,
    ADD COLUMN active_user_email VARCHAR(50) GENERATED ALWAYS AS (CASE WHEN del_flag = '0' THEN NULLIF(email, '') ELSE NULL END) STORED,
    ADD UNIQUE INDEX ux_user_active_name (active_user_name),
    ADD UNIQUE INDEX ux_user_active_phone (active_user_phone),
    ADD UNIQUE INDEX ux_user_active_email (active_user_email);
