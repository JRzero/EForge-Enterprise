-- EForge-owned metadata; install explicitly after the pinned Flowable schemas.
-- Never alter engine tables or automatically remove deployed process history.
CREATE TABLE ef_workflow_package (
    id varchar(36) NOT NULL PRIMARY KEY,
    name varchar(128) NOT NULL,
    business_type varchar(64) NOT NULL,
    revision bigint NOT NULL,
    source_json mediumtext NOT NULL,
    content_digest varchar(64) NOT NULL,
    validated_revision bigint NULL,
    validation_json mediumtext NULL,
    created_by varchar(20) NOT NULL,
    updated_by varchar(20) NOT NULL,
    created_at timestamp(6) NOT NULL,
    updated_at timestamp(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE ef_workflow_package_audit (
    id varchar(36) NOT NULL PRIMARY KEY,
    package_id varchar(36) NOT NULL,
    revision bigint NOT NULL,
    action varchar(32) NOT NULL,
    actor_id varchar(20) NOT NULL,
    content_digest varchar(64) NOT NULL,
    created_at timestamp(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
