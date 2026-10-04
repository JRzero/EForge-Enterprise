-- Existing active duplicates must be resolved before migration; no data is deleted.
ALTER TABLE sys_role
    ADD COLUMN active_role_name varchar(30) GENERATED ALWAYS AS (IF(del_flag='0',role_name,NULL)) STORED,
    ADD COLUMN active_role_key varchar(100) GENERATED ALWAYS AS (IF(del_flag='0',role_key,NULL)) STORED,
    ADD UNIQUE KEY uq_active_role_name (active_role_name),
    ADD UNIQUE KEY uq_active_role_key (active_role_key);
