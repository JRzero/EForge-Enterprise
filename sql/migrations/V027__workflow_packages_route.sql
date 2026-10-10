-- Optional workflow remains disabled by default. Backend permissions govern all actions.
-- No ordinary-role grants or database-owned React component names.
INSERT INTO sys_menu (menu_name,parent_id,order_num,path,component,is_frame,is_cache,menu_type,visible,status,perms,icon,create_by,create_time,menu_key,route_id)
VALUES ('工作流',0,5,'workflow',NULL,1,1,'M','0','0','','tree','eforge',NOW(),'workflow',NULL);
SET @workflow_group = LAST_INSERT_ID();
INSERT INTO sys_menu (menu_name,parent_id,order_num,path,component,is_frame,is_cache,menu_type,visible,status,perms,icon,create_by,create_time,menu_key,route_id)
VALUES ('流程管理',@workflow_group,1,'workflow/packages',NULL,1,1,'C','0','0','workflow:definition:list','list','eforge',NOW(),'workflow-packages','workflow-packages');
SET @workflow_packages = LAST_INSERT_ID();
INSERT INTO sys_menu (menu_name,parent_id,order_num,path,component,is_frame,is_cache,menu_type,visible,status,perms,icon,create_by,create_time,menu_key,route_id)
VALUES
('编辑流程',@workflow_packages,1,'',NULL,1,1,'F','0','0','workflow:definition:edit','#','eforge',NOW(),'workflow-definition-edit',NULL),
('校验流程',@workflow_packages,2,'',NULL,1,1,'F','0','0','workflow:definition:validate','#','eforge',NOW(),'workflow-definition-validate',NULL),
('发布流程',@workflow_packages,3,'',NULL,1,1,'F','0','0','workflow:definition:publish','#','eforge',NOW(),'workflow-definition-publish',NULL),
('激活流程',@workflow_packages,4,'',NULL,1,1,'F','0','0','workflow:definition:activate','#','eforge',NOW(),'workflow-definition-activate',NULL);
