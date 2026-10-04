-- Bind only the implemented React page; the original role grants stay intact.
UPDATE sys_menu SET route_id = 'system-posts', component = NULL
WHERE menu_key = 'system-posts' AND menu_type = 'C';
