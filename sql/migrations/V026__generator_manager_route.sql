-- Bind the implemented generator manager; deferred form builder remains unbound.
UPDATE sys_menu SET route_id = 'tool-generator'
WHERE menu_key = 'tool-generator' AND menu_type = 'C';
