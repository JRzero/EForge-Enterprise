-- Retain original duplicate entry values/default flags; only type codes are unique.
ALTER TABLE sys_dict_type ADD CONSTRAINT uk_sys_dict_type_code UNIQUE (dict_type);
