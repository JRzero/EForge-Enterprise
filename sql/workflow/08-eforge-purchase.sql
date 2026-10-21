-- Explicit optional sample schema; never auto-run against existing databases.
INSERT INTO ef_workflow_activation (business_type,release_id,revision) VALUES ('purchase',NULL,0);
CREATE TABLE ef_purchase (
 id VARCHAR(36) NOT NULL PRIMARY KEY,
 creation_command VARCHAR(36) NOT NULL,
 creation_digest CHAR(64) NOT NULL,
 initiator_id VARCHAR(20) NOT NULL,
 approver_id VARCHAR(20) NOT NULL,
 title VARCHAR(100) NOT NULL,
 reason VARCHAR(1000) NOT NULL,
 total DECIMAL(14,2) NOT NULL,
 state VARCHAR(20) NOT NULL,
 revision BIGINT NOT NULL,
 process_id VARCHAR(64) NULL,
 release_id VARCHAR(36) NULL,
 created_at TIMESTAMP(3) NOT NULL,
 UNIQUE KEY uk_purchase_creation (initiator_id,creation_command),
 UNIQUE KEY uk_purchase_process (process_id),
 KEY ix_purchase_mine (initiator_id,created_at,id),
 KEY ix_purchase_pending (approver_id,state,created_at,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE ef_purchase_attachment (
 purchase_id VARCHAR(36) NOT NULL,
 attachment_id VARCHAR(36) NOT NULL,
 name VARCHAR(120) NOT NULL,
 byte_size BIGINT NOT NULL,
 content MEDIUMBLOB NOT NULL,
 PRIMARY KEY (purchase_id,attachment_id),
 CONSTRAINT fk_purchase_attachment FOREIGN KEY (purchase_id) REFERENCES ef_purchase(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE ef_purchase_item (
 purchase_id VARCHAR(36) NOT NULL,
 item_id VARCHAR(64) NOT NULL,
 item_order INT NOT NULL,
 name VARCHAR(200) NOT NULL,
 unit VARCHAR(20) NOT NULL,
 quantity DECIMAL(9,3) NOT NULL,
 unit_price DECIMAL(10,2) NOT NULL,
 amount DECIMAL(14,2) NOT NULL,
 PRIMARY KEY (purchase_id,item_id),
 UNIQUE KEY uk_purchase_item_order (purchase_id,item_order),
 CONSTRAINT fk_purchase_item FOREIGN KEY (purchase_id) REFERENCES ef_purchase(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE ef_purchase_audit (
 id VARCHAR(36) NOT NULL PRIMARY KEY,
 purchase_id VARCHAR(36) NOT NULL,
 actor_id VARCHAR(20) NOT NULL,
 command_id VARCHAR(36) NOT NULL,
 command_digest CHAR(64) NOT NULL,
 action VARCHAR(20) NOT NULL,
 comment VARCHAR(500) NOT NULL,
 revision BIGINT NOT NULL,
 created_at TIMESTAMP(3) NOT NULL,
 UNIQUE KEY uk_purchase_command (purchase_id,actor_id,command_id),
 UNIQUE KEY uk_purchase_revision (purchase_id,revision),
 CONSTRAINT fk_purchase_audit FOREIGN KEY (purchase_id) REFERENCES ef_purchase(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
