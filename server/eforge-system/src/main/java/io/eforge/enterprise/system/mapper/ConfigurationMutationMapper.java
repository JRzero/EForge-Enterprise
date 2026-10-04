package io.eforge.enterprise.system.mapper;

import org.apache.ibatis.annotations.*;
import io.eforge.enterprise.system.domain.SysConfig;

public interface ConfigurationMutationMapper
{
    @Insert("INSERT INTO sys_config(config_name,config_key,config_value,config_type,remark,create_by,create_time) VALUES(#{configName},#{configKey},#{configValue},#{configType},#{remark},#{createBy},sysdate())")
    @Options(useGeneratedKeys=true,keyProperty="configId")
    int insert(SysConfig row);
}
