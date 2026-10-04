-- Bind only the implemented configuration page; keep stable navigation identity.
UPDATE sys_menu SET route_id = 'system-configurations'
WHERE menu_key = 'system-configuration' AND menu_type = 'C';
