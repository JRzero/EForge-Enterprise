-- Bind only the implemented notice page to its existing stable navigation key.
UPDATE sys_menu SET route_id = 'system-notices'
WHERE menu_key = 'system-notices' AND menu_type = 'C';
