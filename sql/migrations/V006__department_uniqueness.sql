-- Deleted department names can be reused repeatedly. Enforce the existing
-- sibling-name rule only for active rows, including concurrent/legacy requests.
ALTER TABLE sys_dept
    ADD COLUMN active_dept_name VARCHAR(30)
        GENERATED ALWAYS AS (CASE WHEN del_flag = '0' THEN dept_name ELSE NULL END) STORED,
    ADD CONSTRAINT uk_sys_dept_parent_name UNIQUE (parent_id, active_dept_name);
