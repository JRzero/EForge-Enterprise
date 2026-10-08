package io.eforge.enterprise.web.controller.system;

import io.eforge.enterprise.common.core.domain.entity.SysUser;

/**
 * Compatibility input boundary for the legacy basic-user editor.
 * Never pass its persistence entity through to a write unchanged: credentials,
 * login metadata, avatars and caller-provided params have dedicated owners.
 */
final class LegacyUserEditFields
{
    private LegacyUserEditFields() {}

    static SysUser copyOf(SysUser source)
    {
        SysUser target = new SysUser();
        target.setUserId(source.getUserId());
        target.setDeptId(source.getDeptId());
        target.setUserName(source.getUserName());
        target.setNickName(source.getNickName());
        target.setEmail(source.getEmail());
        target.setPhonenumber(source.getPhonenumber());
        target.setSex(source.getSex());
        target.setStatus(source.getStatus());
        target.setRemark(source.getRemark());
        target.setRoleIds(source.getRoleIds() == null ? null : source.getRoleIds().clone());
        target.setPostIds(source.getPostIds() == null ? null : source.getPostIds().clone());
        return target;
    }
}
