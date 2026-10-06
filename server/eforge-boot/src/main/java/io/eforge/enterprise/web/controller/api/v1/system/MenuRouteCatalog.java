package io.eforge.enterprise.web.controller.api.v1.system;

import java.io.IOException;
import java.net.URI;
import java.util.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.DeserializationFeature;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Component;
import static io.eforge.enterprise.web.controller.api.v1.system.MenuContracts.*;

/** Read declarations packaged with code, never database component strings. */
@Component
public class MenuRouteCatalog
{
    private final List<MenuRouteOption> options;
    @Autowired
    public MenuRouteCatalog(ObjectMapper json) throws IOException
    {
        this(json, new PathMatchingResourcePatternResolver().getResources("classpath*:META-INF/eforge/routes/*.json"));
    }
    MenuRouteCatalog(ObjectMapper json, Resource[] installed) throws IOException
    {
        var reader=json.copy().enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .readerFor(new TypeReference<List<MenuRouteOption>>() {});
        List<MenuRouteOption> declared=new ArrayList<>();
        try(var input=new ClassPathResource("contracts/route-contract.json").getInputStream())
        {declared.addAll(reader.<List<MenuRouteOption>>readValue(input));}
        List<MenuRouteOption> generated=new ArrayList<>();
        for(var resource:installed)
            try(var input=resource.getInputStream()) {generated.addAll(reader.<List<MenuRouteOption>>readValue(input));}
        if(generated.stream().anyMatch(Objects::isNull)) throw new IllegalStateException("Invalid packaged navigation route contract");
        generated.sort(Comparator.comparing(MenuRouteOption::id, Comparator.nullsFirst(Comparator.naturalOrder())));
        declared.addAll(generated);
        Set<String> ids=new HashSet<>(),paths=new HashSet<>();
        if(declared.isEmpty() || declared.stream().anyMatch(route->route==null || route.id()==null
            || route.id().length()>100 || !route.id().matches("[a-z][a-z0-9]*(-[a-z0-9]+)*") || !staticPath(route.path())
            || route.permission()==null || route.permission().isBlank()
            || !ids.add(route.id()) || !paths.add(route.path())))
            throw new IllegalStateException("Invalid packaged navigation route contract");
        options=List.copyOf(declared);
    }
    private static boolean staticPath(String path)
    {
        if(path==null || !path.startsWith("/") || path.startsWith("//") || path.contains("\\") || path.contains(":")) return false;
        try {var uri=URI.create(path);String decoded=uri.getPath();return uri.getQuery()==null && uri.getFragment()==null && uri.normalize().toString().equals(path)
            && !decoded.contains("\\") && !decoded.contains("//") && decoded.codePoints().noneMatch(c->c<32 || c==127)
            && Arrays.stream(decoded.split("/")).noneMatch(part->part.equals(".") || part.equals(".."));}
        catch(IllegalArgumentException invalid) {return false;}
    }
    public List<MenuRouteOption> options() {return options;}
}