-- Original config-key uniqueness is enforced for concurrent canonical writers.
ALTER TABLE sys_config ADD CONSTRAINT uk_sys_config_key UNIQUE (config_key);
