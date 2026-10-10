-- Operation controls live in the workflow release panel; no synthetic route or default grant.
SET @workflow_packages = (SELECT menu_id FROM sys_menu WHERE menu_key='workflow-packages');
INSERT INTO sys_menu (menu_name,parent_id,order_num,path,component,is_frame,is_cache,menu_type,visible,status,perms,icon,create_by,create_time,menu_key,route_id)
VALUES ('查看失败作业',@workflow_packages,6,'',NULL,1,1,'F','0','0','workflow:operation:list','#','eforge',NOW(),'workflow-operation-list',NULL),
('恢复失败作业',@workflow_packages,7,'',NULL,1,1,'F','0','0','workflow:operation:retry','#','eforge',NOW(),'workflow-operation-retry',NULL);
