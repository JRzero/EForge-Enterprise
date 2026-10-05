-- Bind only the implemented server ROUTE; the monitor GROUP remains navigation-only.
UPDATE sys_menu SET route_id = 'monitor-server'
WHERE menu_key = 'monitor-server' AND menu_type = 'C';
