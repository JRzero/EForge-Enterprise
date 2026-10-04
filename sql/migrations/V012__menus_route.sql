-- Bind the completed menu administration page to its stable navigation identity.
UPDATE sys_menu SET route_id='system-menus' WHERE menu_key='system-menus' AND route_id IS NULL;
