-- RuoYi-derived generator metadata identifies one configuration per physical table.
-- Existing duplicates deliberately stop migration; never silently delete configuration.
ALTER TABLE gen_table ADD CONSTRAINT uk_gen_table_name UNIQUE (table_name);
