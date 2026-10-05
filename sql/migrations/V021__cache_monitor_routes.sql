-- Bind only implemented cache ROUTEs, retaining the existing monitor GROUP.
UPDATE sys_menu SET route_id = 'monitor-cache'
WHERE menu_key = 'monitor-cache' AND menu_type = 'C';
UPDATE sys_menu SET route_id = 'monitor-cache-entries'
WHERE menu_key = 'monitor-cache-entries' AND menu_type = 'C';
