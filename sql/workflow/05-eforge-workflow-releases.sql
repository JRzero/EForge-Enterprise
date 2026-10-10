-- Immutable EForge publication records. Install after 04, never modify engine schemas.
CREATE TABLE ef_workflow_release (
    id varchar(36) NOT NULL PRIMARY KEY,
    package_id varchar(36) NOT NULL,
    package_revision bigint NOT NULL,
    name varchar(128) NOT NULL,
    business_type varchar(64) NOT NULL,
    content_digest varchar(64) NOT NULL,
    source_json mediumtext NOT NULL,
    validation_json mediumtext NOT NULL,
    definition_id varchar(128) NOT NULL,
    deployment_id varchar(128) NOT NULL,
    published_by varchar(20) NOT NULL,
    published_at timestamp(6) NOT NULL,
    UNIQUE (package_id, package_revision),
    UNIQUE (definition_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE ef_workflow_activation (
    business_type varchar(64) NOT NULL PRIMARY KEY,
    release_id varchar(36) NULL,
    revision bigint NOT NULL,
    updated_by varchar(20) NULL,
    updated_at timestamp(6) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
INSERT INTO ef_workflow_activation (business_type,revision) VALUES ('leave',0);

CREATE TABLE ef_workflow_release_audit (
    id varchar(36) NOT NULL PRIMARY KEY,
    release_id varchar(36) NOT NULL,
    action varchar(32) NOT NULL,
    actor_id varchar(20) NOT NULL,
    activation_revision bigint NULL,
    created_at timestamp(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
