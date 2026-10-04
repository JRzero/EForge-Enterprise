-- Bind only the implemented React user administration page.
UPDATE sys_menu SET route_id = 'system-users', component = NULL
WHERE menu_key = 'system-users' AND menu_type = 'C';
