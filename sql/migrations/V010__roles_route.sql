-- Only the implemented role page binds navigation. Authorization subpages stay internal.
UPDATE sys_menu SET route_id='system-roles' WHERE menu_key='system-roles' AND route_id IS NULL;
