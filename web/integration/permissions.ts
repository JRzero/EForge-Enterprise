// RuoYi's administrator marker differs from EForge's wildcard convention.
// This conversion is for frontend UX; endpoint authorization stays on the server.
export function toEForgePermissions(permissions: readonly string[]): string[] {
  return [...new Set(permissions.map(permission => permission === '*:*:*' ? '*' : permission))];
}
