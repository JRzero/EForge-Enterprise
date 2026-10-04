-- Only the actual local React department page is bound to this stable identity.
UPDATE sys_menu SET route_id = 'system-departments', component = NULL
WHERE menu_key = 'system-departments' AND menu_type = 'C';
