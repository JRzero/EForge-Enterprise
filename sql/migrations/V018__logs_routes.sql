-- Only existing log ROUTE nodes bind; the system-logs GROUP remains a group.
UPDATE sys_menu SET route_id = 'monitor-operation-logs'
WHERE menu_key = 'monitor-operation-logs' AND menu_type = 'C';
UPDATE sys_menu SET route_id = 'monitor-login-logs'
WHERE menu_key = 'monitor-login-logs' AND menu_type = 'C';
