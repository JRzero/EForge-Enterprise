-- EForge Enterprise canonical navigation contract.
-- Applied after the pinned upstream RuoYi schema.

alter table sys_menu
  add column menu_key varchar(100) null comment 'stable EForge navigation key' after menu_id,
  add column route_id varchar(100) null comment 'stable EForge frontend route id' after route_name;

create unique index uk_sys_menu_menu_key on sys_menu(menu_key);
create unique index uk_sys_menu_route_id on sys_menu(route_id);

-- Navigation groups.
update sys_menu set menu_key = 'system' where menu_id = 1;
update sys_menu set menu_key = 'monitor' where menu_id = 2;
update sys_menu set menu_key = 'tools' where menu_id = 3;
update sys_menu set menu_key = 'system-logs' where menu_id = 108;

-- Canonical EForge routes. Legacy Vue component paths remain migration-only.
update sys_menu set menu_key = 'system-users', route_id = 'system-users' where menu_id = 100;
update sys_menu set menu_key = 'system-roles', route_id = 'system-roles' where menu_id = 101;
update sys_menu set menu_key = 'system-menus', route_id = 'system-menus' where menu_id = 102;
update sys_menu set menu_key = 'system-departments', route_id = 'system-departments' where menu_id = 103;
update sys_menu set menu_key = 'system-posts', route_id = 'system-posts' where menu_id = 104;
update sys_menu set menu_key = 'system-dictionaries', route_id = 'system-dictionaries' where menu_id = 105;
update sys_menu set menu_key = 'system-config', route_id = 'system-config' where menu_id = 106;
update sys_menu set menu_key = 'system-notices', route_id = 'system-notices' where menu_id = 107;
update sys_menu set menu_key = 'monitor-online-users', route_id = 'monitor-online-users' where menu_id = 109;
update sys_menu set menu_key = 'monitor-jobs', route_id = 'monitor-jobs' where menu_id = 110;
update sys_menu set menu_key = 'monitor-server', route_id = 'monitor-server' where menu_id = 112;
update sys_menu set menu_key = 'monitor-cache', route_id = 'monitor-cache' where menu_id = 113;
update sys_menu set menu_key = 'monitor-cache-list', route_id = 'monitor-cache-list' where menu_id = 114;
update sys_menu set menu_key = 'tools-generator', route_id = 'tools-generator' where menu_id = 116;
update sys_menu set menu_key = 'system-operation-logs', route_id = 'system-operation-logs' where menu_id = 500;
update sys_menu set menu_key = 'system-login-logs', route_id = 'system-login-logs' where menu_id = 501;
