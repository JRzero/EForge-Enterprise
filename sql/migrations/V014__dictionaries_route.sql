-- Bind only the implemented page; data detail remains an internal static route.
UPDATE sys_menu SET route_id = 'system-dictionaries'
WHERE menu_key = 'system-dictionaries' AND route_id IS NULL;
