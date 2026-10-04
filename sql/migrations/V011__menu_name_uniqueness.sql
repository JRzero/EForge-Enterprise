-- Preserve upstream sibling-name uniqueness with a real concurrent-write guard.
ALTER TABLE sys_menu ADD CONSTRAINT uk_sys_menu_parent_name UNIQUE (parent_id, menu_name);
