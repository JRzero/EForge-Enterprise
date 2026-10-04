package io.eforge.enterprise.system.mapper;

import org.apache.ibatis.annotations.*;
import io.eforge.enterprise.common.core.domain.entity.SysDictType;
import io.eforge.enterprise.common.core.domain.entity.SysDictData;

/** Canonical writes keep compatibility entities inside the migration boundary. */
public interface DictionaryMutationMapper
{
    @Insert("INSERT INTO sys_dict_type(dict_name,dict_type,status,remark,create_by,create_time) VALUES(#{dictName},#{dictType},#{status},#{remark},#{createBy},sysdate())")
    @Options(useGeneratedKeys=true,keyProperty="dictId")
    int insertType(SysDictType row);
    @Insert("INSERT INTO sys_dict_data(dict_sort,dict_label,dict_value,dict_type,css_class,list_class,is_default,status,remark,create_by,create_time) VALUES(#{dictSort},#{dictLabel},#{dictValue},#{dictType},#{cssClass},#{listClass},#{isDefault},#{status},#{remark},#{createBy},sysdate())")
    @Options(useGeneratedKeys=true,keyProperty="dictCode")
    int insertEntry(SysDictData row);
}
