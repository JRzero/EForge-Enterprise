package io.eforge.enterprise.web.controller.api.v1.system;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class MenuRouteCatalogTest
{
    @Test void packagedNavigationRegistryIncludesActualRoutesAndExcludesInternalRoutes() throws Exception
    {
        var catalog=new MenuRouteCatalog(new ObjectMapper());
        assertTrue(catalog.options().stream().anyMatch(route->route.id().equals("system-roles") && route.path().equals("/role") && route.permission().equals("system:role:list")));
        assertFalse(catalog.options().stream().anyMatch(route->route.path().contains(":") || route.id().equals("account-profile")));
    }
    private org.springframework.core.io.Resource manifest(String json) {
        return new org.springframework.core.io.ByteArrayResource(json.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }
    private MenuRouteCatalog installed(String json) throws Exception {
        return new MenuRouteCatalog(new ObjectMapper(),new org.springframework.core.io.Resource[]{manifest(json)});
    }
    @Test void installedStaticUnicodeRouteRetainsPermissionAndImmutableRegistry() throws Exception {
        var catalog=installed("[{\"id\":\"business-gen-test\",\"path\":\"/business/%E6%A8%A1%E5%9D%97/x\",\"permission\":\"module:x:list\"}]");
        var route=catalog.options().get(catalog.options().size()-1);
        assertEquals("/business/模块/x",java.net.URI.create(route.path()).getPath());
        assertEquals("module:x:list",route.permission());
        assertThrows(UnsupportedOperationException.class,()->catalog.options().clear());
    }
    @Test void rejectsDuplicateUnsafeMalformedAndDatabaseComponentDeclarations() {
        for(String path:java.util.List.of("/role","/business/%2e%2e/x","/business/%5c/x","/business/%00/x","/business/x?secret=y","/business/x#fragment","//outside/x","/business/:id")) {
            assertThrows(IllegalStateException.class,()->installed("[{\"id\":\"business-gen-test\",\"path\":\""+path+"\",\"permission\":\"x:list\"}]"),path);
        }
        assertThrows(IllegalStateException.class,()->installed("[{\"id\":\"system-roles\",\"path\":\"/business/unique\",\"permission\":\"x:list\"}]"));
        assertThrows(IllegalStateException.class,()->installed("[null]"));
        assertThrows(java.io.IOException.class,()->installed("[{\"id\":\"business-gen-test\",\"path\":\"/business/x\",\"permission\":\"x:list\",\"component\":\"database-string\"}]"));
        assertThrows(java.io.IOException.class,()->installed("not-json"));
    }}
