-- Feature-local generator metadata transaction coordination across canonical/legacy writers.
-- The row lock is released by the same SQL commit/rollback; no process-local or task gate.
CREATE TABLE gen_metadata_guard (
    guard_id TINYINT NOT NULL,
    PRIMARY KEY (guard_id),
    CONSTRAINT ck_gen_metadata_guard CHECK (guard_id = 1)
) ENGINE=InnoDB;
INSERT INTO gen_metadata_guard(guard_id) VALUES (1);
