-- The first implemented React page. Components remain owned by the web registry.
INSERT INTO sys_menu (menu_name, parent_id, order_num, path, component, is_frame,
    is_cache, menu_type, visible, status, perms, icon, create_by, create_time,
    remark, menu_key, route_id)
VALUES ('工作台', 0, 0, 'dashboard', NULL, 1, 1, 'C', '0', '0',
    'app:dashboard:view', 'dashboard', 'eforge', NOW(), 'EForge application workbench',
    'dashboard', 'dashboard');

INSERT INTO sys_role_menu (role_id, menu_id)
SELECT r.role_id, m.menu_id FROM sys_role r CROSS JOIN sys_menu m
WHERE r.role_key IN ('admin', 'common') AND r.status = '0' AND r.del_flag = '0'
    AND m.menu_key = 'dashboard';
