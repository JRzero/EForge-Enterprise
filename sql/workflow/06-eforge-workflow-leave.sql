-- Feature-local leave sample, explicitly installed only with the optional workflow schema.
CREATE TABLE ef_workflow_leave (
 id VARCHAR(36) NOT NULL PRIMARY KEY,
 submission_id VARCHAR(36) NOT NULL,
 initiator_id VARCHAR(20) NOT NULL,
 release_id VARCHAR(36) NULL,
 process_id VARCHAR(64) NULL,
 start_date DATE NOT NULL,
 end_date DATE NOT NULL,
 reason VARCHAR(1000) NOT NULL,
 state VARCHAR(20) NOT NULL,
 revision BIGINT NOT NULL,
 created_at TIMESTAMP(3) NOT NULL,
 UNIQUE KEY uk_workflow_leave_submission (initiator_id,submission_id),
 UNIQUE KEY uk_workflow_leave_process (process_id),
 KEY ix_workflow_leave_owner (initiator_id,created_at,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE ef_workflow_leave_audit (
 id VARCHAR(36) NOT NULL PRIMARY KEY,
 leave_id VARCHAR(36) NOT NULL,
 command_id VARCHAR(36) NOT NULL,
 action VARCHAR(20) NOT NULL,
 actor_id VARCHAR(20) NOT NULL,
 task_id VARCHAR(64) NULL,
 command_digest CHAR(64) NOT NULL,
 comment VARCHAR(500) NOT NULL,
 event_order BIGINT NOT NULL,
 created_at TIMESTAMP(3) NOT NULL,
 UNIQUE KEY uk_workflow_leave_command (leave_id,actor_id,command_id),
 UNIQUE KEY uk_workflow_leave_event (leave_id,event_order),
 KEY ix_workflow_leave_audit (leave_id,created_at,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
