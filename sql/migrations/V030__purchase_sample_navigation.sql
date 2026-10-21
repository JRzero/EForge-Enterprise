-- Sample business capability; no implicit grant to ordinary roles.
SET @workflow_group = (SELECT menu_id FROM sys_menu WHERE menu_key='workflow');
INSERT INTO sys_menu (menu_name,parent_id,order_num,path,component,is_frame,is_cache,menu_type,visible,status,perms,icon,create_by,create_time,menu_key,route_id)
VALUES ('采购审批示例',@workflow_group,4,'samples/purchases',NULL,1,1,'C','0','0','sample:purchase:list','list','eforge',NOW(),'sample-purchases','sample-purchases');
SET @purchase_sample = LAST_INSERT_ID();
INSERT INTO sys_menu (menu_name,parent_id,order_num,path,component,is_frame,is_cache,menu_type,visible,status,perms,icon,create_by,create_time,menu_key,route_id)
VALUES ('发起采购申请',@purchase_sample,1,'',NULL,1,1,'F','0','0','sample:purchase:write','#','eforge',NOW(),'sample-purchase-write',NULL),
('审批采购申请',@purchase_sample,2,'',NULL,1,1,'F','0','0','sample:purchase:approve','#','eforge',NOW(),'sample-purchase-approve',NULL);
