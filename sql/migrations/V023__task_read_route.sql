-- Bind the implemented task read page; the task log child is an internal route.
UPDATE sys_menu SET route_id = 'monitor-jobs'
WHERE menu_key = 'monitor-jobs' AND menu_type = 'C';