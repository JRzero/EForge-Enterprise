-- The existing monitor GROUP remains navigation-only; bind only its online ROUTE.
UPDATE sys_menu SET route_id = 'monitor-online-sessions'
WHERE menu_key = 'monitor-online-sessions' AND menu_type = 'C';
