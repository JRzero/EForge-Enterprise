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
}
