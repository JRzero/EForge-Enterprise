package io.eforge.enterprise.system.domain;

/** Internal SQL projection; never returned by an HTTP endpoint. */
public record RoleMenuPermission(Long roleId, String perms) {}
