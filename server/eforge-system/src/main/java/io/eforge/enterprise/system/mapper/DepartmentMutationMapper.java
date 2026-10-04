package io.eforge.enterprise.system.mapper;

import org.apache.ibatis.annotations.Select;

/** Canonical hierarchy mutation mutex; uses the existing root's InnoDB row lock. */
public interface DepartmentMutationMapper
{
    @Select("SELECT dept_id FROM sys_dept WHERE parent_id = 0 ORDER BY dept_id LIMIT 1 FOR UPDATE")
    Long lockRoot();
}
