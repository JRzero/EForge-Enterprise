-- Optional workflow schema. Apply explicitly after 06; never enables the executor.
create table ef_workflow_job_audit (
  id varchar(36) not null primary key,
  leave_id varchar(36) not null,
  actor_id bigint not null,
  command_id varchar(36) not null,
  original_job_id varchar(64) not null,
  queued_job_id varchar(64) not null,
  created_at datetime(6) not null,
  unique key uk_workflow_job_command (actor_id,command_id),
  key idx_workflow_job_leave (leave_id)
);
