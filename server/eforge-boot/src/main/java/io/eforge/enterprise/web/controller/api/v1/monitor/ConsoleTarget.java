package io.eforge.enterprise.web.controller.api.v1.monitor;

/** Fixed compatibility targets; callers cannot supply a redirect or resource URL. */
public enum ConsoleTarget
{
    DRUID("monitor:druid:list", "/druid/login.html", "eforge_console_druid", "/druid"),
    API_DOCS("tool:swagger:list", "/swagger-ui/index.html", "eforge_console_docs", "/");

    private final String permission, entryPath, cookieName, cookiePath;
    ConsoleTarget(String permission, String entryPath, String cookieName, String cookiePath)
    {this.permission=permission;this.entryPath=entryPath;this.cookieName=cookieName;this.cookiePath=cookiePath;}
    public String permission(){return permission;}
    public String entryPath(){return entryPath;}
    public String cookieName(){return cookieName;}
    public String cookiePath(){return cookiePath;}
    public boolean contains(String path)
    {
        if(path==null || path.contains("%") || path.contains("..") || path.contains("\\") || path.contains(";"))return false;
        return this==DRUID ? path.equals("/druid") || path.startsWith("/druid/")
                : path.equals("/swagger-ui.html") || path.startsWith("/swagger-ui/")
                    || path.equals("/v3/api-docs") || path.startsWith("/v3/api-docs/");
    }
}
