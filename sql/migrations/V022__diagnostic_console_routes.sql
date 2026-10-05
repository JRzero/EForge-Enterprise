-- Bind only implemented diagnostic ROUTEs; GROUP identities have no route_id.
UPDATE sys_menu SET route_id = 'monitor-druid'
WHERE menu_key = 'monitor-druid' AND menu_type = 'C';
UPDATE sys_menu SET route_id = 'tool-openapi'
WHERE menu_key = 'tool-openapi' AND menu_type = 'C';
