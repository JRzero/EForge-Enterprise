-- Apply once AFTER the unchanged upstream schemas. Nullable fields preserve
-- legacy menu creation; only explicitly migrated nodes enter canonical navigation.
ALTER TABLE sys_menu
  ADD COLUMN menu_key VARCHAR(100) COLLATE utf8mb4_bin NULL COMMENT 'Stable navigation identity',
  ADD COLUMN route_id VARCHAR(100) COLLATE utf8mb4_bin NULL COMMENT 'Implemented frontend route only',
  ADD CONSTRAINT uk_sys_menu_menu_key UNIQUE (menu_key),
  ADD CONSTRAINT uk_sys_menu_route_id UNIQUE (route_id),
  ADD CONSTRAINT ck_sys_menu_menu_key CHECK (menu_key IS NULL OR REGEXP_LIKE(menu_key, '^[a-z][a-z0-9]*(-[a-z0-9]+)*$', 'c')),
  ADD CONSTRAINT ck_sys_menu_route_id CHECK (route_id IS NULL OR
    (menu_type = 'C' AND is_frame = '1' AND path NOT REGEXP '^https?://' AND
     REGEXP_LIKE(route_id, '^[a-z][a-z0-9]*(-[a-z0-9]+)*$', 'c')));

UPDATE sys_menu SET menu_key = CASE
  WHEN menu_type = 'M' AND path = 'system' THEN 'system'
  WHEN menu_type = 'M' AND path = 'monitor' THEN 'monitor'
  WHEN menu_type = 'M' AND path = 'tool' THEN 'tool'
  WHEN menu_type = 'M' AND path = 'log' THEN 'system-logs'
  WHEN menu_type = 'M' AND path = 'http://ruoyi.vip' THEN 'upstream-ruoyi'
  WHEN menu_type = 'C' AND perms = 'system:user:list' THEN 'system-users'
  WHEN menu_type = 'C' AND perms = 'system:role:list' THEN 'system-roles'
  WHEN menu_type = 'C' AND perms = 'system:menu:list' THEN 'system-menus'
  WHEN menu_type = 'C' AND perms = 'system:dept:list' THEN 'system-departments'
  WHEN menu_type = 'C' AND perms = 'system:post:list' THEN 'system-posts'
  WHEN menu_type = 'C' AND perms = 'system:dict:list' THEN 'system-dictionaries'
  WHEN menu_type = 'C' AND perms = 'system:config:list' THEN 'system-configuration'
  WHEN menu_type = 'C' AND perms = 'system:notice:list' THEN 'system-notices'
  WHEN menu_type = 'C' AND perms = 'monitor:online:list' THEN 'monitor-online-sessions'
  WHEN menu_type = 'C' AND perms = 'monitor:job:list' THEN 'monitor-jobs'
  WHEN menu_type = 'C' AND perms = 'monitor:druid:list' THEN 'monitor-druid'
  WHEN menu_type = 'C' AND perms = 'monitor:server:list' THEN 'monitor-server'
  WHEN menu_type = 'C' AND perms = 'monitor:cache:list' AND path = 'cache' THEN 'monitor-cache'
  WHEN menu_type = 'C' AND perms = 'monitor:cache:list' AND path = 'cacheList' THEN 'monitor-cache-entries'
  WHEN menu_type = 'C' AND perms = 'tool:build:list' THEN 'tool-form-builder'
  WHEN menu_type = 'C' AND perms = 'tool:gen:list' THEN 'tool-generator'
  WHEN menu_type = 'C' AND path = 'swagger' THEN 'tool-openapi'
  WHEN menu_type = 'C' AND perms = 'monitor:operlog:list' THEN 'monitor-operation-logs'
  WHEN menu_type = 'C' AND perms = 'monitor:logininfor:list' THEN 'monitor-login-logs'
  WHEN menu_type = 'F' AND perms <> '' THEN LOWER(REPLACE(perms, ':', '-'))
  ELSE NULL
END WHERE menu_key IS NULL;

-- No React routes exist yet. route_id stays NULL until a subsequent migration
-- binds an implemented frontend route and validates the frontend route registry.
