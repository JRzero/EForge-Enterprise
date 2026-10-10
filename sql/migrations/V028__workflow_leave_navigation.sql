-- Business approvals use the existing authoritative account/role permissions.
-- Explicit grants are required; ordinary roles receive no new capabilities.
SET @workflow_group = (SELECT menu_id FROM sys_menu WHERE menu_key='workflow');
INSERT INTO sys_menu (menu_name,parent_id,order_num,path,component,is_frame,is_cache,menu_type,visible,status,perms,icon,create_by,create_time,menu_key,route_id)
VALUES ('我发起的审批',@workflow_group,2,'workflow/requests',NULL,1,1,'C','0','0','workflow:request:list','list','eforge',NOW(),'workflow-requests','workflow-requests');
SET @workflow_requests = LAST_INSERT_ID();
INSERT INTO sys_menu (menu_name,parent_id,order_num,path,component,is_frame,is_cache,menu_type,visible,status,perms,icon,create_by,create_time,menu_key,route_id)
VALUES ('发起申请',@workflow_requests,1,'',NULL,1,1,'F','0','0','workflow:request:submit','#','eforge',NOW(),'workflow-request-submit',NULL),
('撤回申请',@workflow_requests,2,'',NULL,1,1,'F','0','0','workflow:request:withdraw','#','eforge',NOW(),'workflow-request-withdraw',NULL);
INSERT INTO sys_menu (menu_name,parent_id,order_num,path,component,is_frame,is_cache,menu_type,visible,status,perms,icon,create_by,create_time,menu_key,route_id)
VALUES ('审批任务',@workflow_group,3,'workflow/tasks',NULL,1,1,'C','0','0','workflow:task:list','list','eforge',NOW(),'workflow-tasks','workflow-tasks');
SET @workflow_tasks = LAST_INSERT_ID();
INSERT INTO sys_menu (menu_name,parent_id,order_num,path,component,is_frame,is_cache,menu_type,visible,status,perms,icon,create_by,create_time,menu_key,route_id)
VALUES ('处理审批',@workflow_tasks,1,'',NULL,1,1,'F','0','0','workflow:task:handle','#','eforge',NOW(),'workflow-task-handle',NULL);
