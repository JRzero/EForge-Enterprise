package io.eforge.enterprise.web.controller.api.v1.system;

import java.io.IOException;
import java.util.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import static io.eforge.enterprise.web.controller.api.v1.system.MenuContracts.*;

/** Read the packaged web navigation registry, excluding hidden/internal routes. */
@Component
public class MenuRouteCatalog
{
    private final List<MenuRouteOption> options;
    public MenuRouteCatalog(ObjectMapper json) throws IOException
    {
        try(var input=new ClassPathResource("contracts/route-contract.json").getInputStream())
        { options=List.copyOf(json.readValue(input,new TypeReference<List<MenuRouteOption>>() {})); }
        Set<String> ids=new HashSet<>(),paths=new HashSet<>();
        if(options.isEmpty() || options.stream().anyMatch(route->route.id()==null || !route.id().matches("[a-z][a-z0-9]*(-[a-z0-9]+)*") || route.path()==null || !route.path().startsWith("/") || !ids.add(route.id()) || !paths.add(route.path())))
            throw new IllegalStateException("Invalid packaged navigation route contract");
    }
    public List<MenuRouteOption> options() { return options; }
}
