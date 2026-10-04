package io.eforge.enterprise.web.controller.api.v1.system;

import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.core.domain.entity.*;
import io.eforge.enterprise.common.utils.spring.SpringUtils;
import io.eforge.enterprise.framework.config.SecurityConfig;
import io.eforge.enterprise.framework.config.properties.PermitAllUrlProperties;
import io.eforge.enterprise.framework.security.filter.JwtAuthenticationTokenFilter;
import io.eforge.enterprise.framework.security.handle.*;
import io.eforge.enterprise.framework.web.exception.*;
import io.eforge.enterprise.framework.web.service.*;
import io.eforge.enterprise.system.mapper.*;
import io.eforge.enterprise.system.service.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static io.eforge.enterprise.web.controller.api.v1.system.MenuContracts.*;

@WebMvcTest
@ContextConfiguration(classes={MenuController.class,MenuService.class,PermissionService.class,ApiExceptionHandler.class,ApiRoutingExceptionResolver.class,SpringUtils.class,SecurityConfig.class,ApiSecurityProblemHandler.class,AuthenticationEntryPointImpl.class,JwtAuthenticationTokenFilter.class,MenuControllerTest.Configuration.class})
class MenuControllerTest
{
    static final String PATH="/api/v1/system/menus";
    static final String BODY="{\"key\":\"new-group\",\"name\":\"New\",\"parentId\":\"0\",\"sort\":1,\"type\":\"GROUP\",\"status\":\"0\",\"visible\":true,\"groupPath\":\"new-group\",\"cached\":true}";
    @Autowired MockMvc mvc;
    @MockitoBean MenuMutationMapper mapper;
    @MockitoBean ISysMenuService legacy;
    @MockitoBean DepartmentMutationMapper mutex;
    @MockitoBean MenuRouteCatalog routes;
    @MockitoBean RoleSessionRefresher sessions;
    @MockitoBean ISysUserService users;
    @MockitoBean NavigationMapper navigation;
    @MockitoBean SysPermissionService permissions;
    @MockitoBean PlatformTransactionManager transactions;
    @MockitoBean TokenService tokens;
    @MockitoBean LogoutSuccessHandlerImpl logout;
    @BeforeEach void prepare()
    {
        actor(1,Set.of("*:*:*"));when(transactions.getTransaction(any())).thenReturn(new SimpleTransactionStatus());when(mutex.lockRoot()).thenReturn(100L);
        when(mapper.rows()).thenReturn(List.of(row(1,0,"system","System","M","system",null),row(2,1,"system-users","Users","C","user","system-users"),row(3,2,"system-user-query","Query","F","",null),row(4,0,"restricted","Restricted","M","restricted",null)));
        when(routes.options()).thenReturn(List.of(new MenuRouteOption("system-users","/user","system:user:list"),new MenuRouteOption("dashboard","/dashboard",null)));
        when(mapper.grantedIds(2L)).thenReturn(List.of(1L,2L,3L));when(mapper.affectedUsers(2L)).thenReturn(List.of(2L,3L));
        when(mapper.filteredIds(nullable(String.class),nullable(String.class),nullable(String.class))).thenReturn(List.of(1L,2L,3L,4L));
        when(mapper.filteredIds("Users","0","0")).thenReturn(List.of(2L));
        when(mapper.insert(any())).thenAnswer(call->{SysMenu row=call.getArgument(0);row.setMenuId(9007199254740993L);return 1;});
        when(mapper.update(anyLong(),anyLong(),anyString(),nullable(String.class),anyString(),anyInt(),anyString(),anyString(),anyString(),anyString(),anyString(),anyString(),anyString(),anyString(),anyString(),anyString(),anyString())).thenReturn(1);
        when(legacy.deleteMenuById(anyLong())).thenReturn(1);
    }
    void actor(long id,Set<String> grants) {SysUser user=new SysUser(id);user.setUserName("operator");when(tokens.getLoginUser(any())).thenReturn(new LoginUser(id,103L,user,grants));}
    static MenuMutationMapper.Row row(long id,long parent,String key,String name,String type,String path,String route)
    {return new MenuMutationMapper.Row(id,parent,key,route,name,1,type,"0","0",type.equals("C")?"system:user:list":"","1",path,"icon","remark","","0",new Date());}
    String editBody() {return "{\"key\":\"system-users\",\"name\":\"Users\",\"parentId\":\"1\",\"sort\":2,\"type\":\"ROUTE\",\"status\":\"0\",\"visible\":true,\"routeId\":\"system-users\",\"permission\":\"system:user:list\",\"cached\":true,\"remark\":\"\",\"icon\":\"\"}";}
    @Test void safeFlatContractsAndScopedFiltersNeverLeakLegacyComponents() throws Exception
    {
        mvc.perform(get(PATH)).andExpect(status().isOk()).andExpect(jsonPath("$[0].type").value("GROUP")).andExpect(jsonPath("$[0].component").doesNotExist()).andExpect(jsonPath("$[0].params").doesNotExist());
        mvc.perform(get(PATH+"?name=Users&visible=true&status=0")).andExpect(jsonPath("$.length()").value(1));
        actor(2,Set.of("system:menu:list"));mvc.perform(get(PATH)).andExpect(jsonPath("$.length()").value(3));
        actor(2,Set.of("system:menu:query"));mvc.perform(get(PATH+"/4")).andExpect(status().isForbidden());mvc.perform(get(PATH+"/999")).andExpect(status().isNotFound());
    }
    @Test void createReturnsExactLargeIdAndStableIdentity() throws Exception
    {mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isCreated()).andExpect(header().string("Location",PATH+"/9007199254740993")).andExpect(jsonPath("$.id").value("9007199254740993")).andExpect(jsonPath("$.key").value("new-group"));verify(transactions).commit(any());}
    @ParameterizedTest @ValueSource(strings={"{}","null","{\"key\":\"UPPER\"}","{\"key\":\"new-group\",\"name\":\"New\",\"parentId\":\"9223372036854775808\",\"sort\":1,\"type\":\"GROUP\",\"status\":\"0\",\"visible\":true,\"groupPath\":\"new-group\",\"cached\":true}"})
    void invalidBodiesNeverWrite(String body) throws Exception {mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());verify(mapper,never()).insert(any());}
    @Test void invalidFiltersAndLongOverflowReturnProblems() throws Exception
    {mvc.perform(get(PATH+"?status=2")).andExpect(status().isBadRequest());mvc.perform(get(PATH+"/9223372036854775808")).andExpect(status().isBadRequest());mvc.perform(get(PATH+"/999")).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("MENU_NOT_FOUND"));}
    @Test void updateClearsOptionalFieldsAndRefreshesOnlyAfterCommit() throws Exception
    {mvc.perform(put(PATH+"/2").contentType(MediaType.APPLICATION_JSON).content(editBody())).andExpect(status().isNoContent());var order=inOrder(mapper,transactions,sessions);order.verify(mapper).update(eq(2L),eq(1L),eq("system-users"),eq("system-users"),eq("Users"),eq(2),eq("C"),eq("0"),eq("0"),eq("system:user:list"),eq("1"),eq("user"),eq(""),eq(""),eq(""),eq("0"),eq("operator"));order.verify(transactions).commit(any());order.verify(sessions).refresh(Set.of(2L,3L));}
    @Test void stableKeysCyclesAndLeafTypeConversionAreRejected() throws Exception
    {
        mvc.perform(put(PATH+"/2").contentType(MediaType.APPLICATION_JSON).content(editBody().replace("system-users","renamed"))).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MENU_KEY_IMMUTABLE"));
        mvc.perform(put(PATH+"/1").contentType(MediaType.APPLICATION_JSON).content(BODY.replace("new-group","system").replace("\"0\",\"sort\"","\"2\",\"sort\""))).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MENU_CYCLE"));
        mvc.perform(put(PATH+"/2").contentType(MediaType.APPLICATION_JSON).content(editBody().replace("ROUTE","FUNCTION").replace("\"routeId\":\"system-users\",",""))).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MENU_HAS_CHILDREN"));
        verify(mapper,never()).update(any(),any(),any(),any(),any(),any(),any(),any(),any(),any(),any(),any(),any(),any(),any(),any(),any());verify(sessions,never()).refresh(any());
    }
    @Test void registeredRoutesMustMatchPermissionsAndNeverUseInternalRoutes() throws Exception
    {
        mvc.perform(put(PATH+"/2").contentType(MediaType.APPLICATION_JSON).content(editBody().replace("\"routeId\":\"system-users\"","\"routeId\":\"account-profile\""))).andExpect(status().isBadRequest());
        mvc.perform(put(PATH+"/2").contentType(MediaType.APPLICATION_JSON).content(editBody().replace("system:user:list","secret:read"))).andExpect(status().isBadRequest());
        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(editBody().replace("system-users","new-route").replace("\"name\":\"Users\"","\"name\":\"Other route\"").replace("\"routeId\":\"new-route\"","\"routeId\":\"system-users\""))).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MENU_ROUTE_EXISTS"));
    }
    @ParameterizedTest @ValueSource(strings={"javascript:alert(1)","https://user:password@example.com","/relative","https:///missing-host"})
    void unsafeExternalUrlsCannotBePersisted(String url) throws Exception
    {mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(BODY.replace("GROUP","EXTERNAL").replace("\"groupPath\":\"new-group\"","\"externalUrl\":\""+url+"\""))).andExpect(status().isBadRequest());verify(mapper,never()).insert(any());}
    @Test void scopeAndNewPermissionGuardsPreventPrivilegeEscalation() throws Exception
    {
        actor(2,Set.of("system:menu:add","system:menu:edit"));SysUser actor=new SysUser(2L);when(users.selectUserById(2L)).thenReturn(actor);when(navigation.selectActiveRoles(2L)).thenReturn(List.of());
        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(BODY.replace("\"parentId\":\"0\"","\"parentId\":\"4\""))).andExpect(status().isForbidden());
        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(BODY.replace("\"cached\":true","\"cached\":true,\"permission\":\"secret:read\""))).andExpect(status().isForbidden());
        mvc.perform(put(PATH+"/4").contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isForbidden());verify(mapper,never()).insert(any());
    }
    @Test void uniquenessDeletionAndAtomicSortGuardsAreEnforced() throws Exception
    {
        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(BODY.replace("new-group","system"))).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MENU_KEY_EXISTS"));
        mvc.perform(delete(PATH+"/1")).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MENU_HAS_CHILDREN"));when(mapper.roleCount(3L)).thenReturn(1);
        mvc.perform(delete(PATH+"/3")).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MENU_IN_USE"));
        mvc.perform(put(PATH+"/sort").contentType(MediaType.APPLICATION_JSON).content("{\"items\":[{\"id\":\"2\",\"sort\":4},{\"id\":\"999\",\"sort\":5}]}")).andExpect(status().isNotFound());
        mvc.perform(put(PATH+"/sort").contentType(MediaType.APPLICATION_JSON).content("{\"items\":[{\"id\":\"2\",\"sort\":4},{\"id\":\"2\",\"sort\":5}]}")).andExpect(status().isBadRequest());verify(legacy,never()).updateMenuSort(any(),any());
        mvc.perform(delete(PATH+"/4")).andExpect(status().isNoContent());
    }
    @Test void everyEndpointUsesOriginalPermissionsAndRequiresAuthentication() throws Exception
    {
        actor(2,Set.of());for(String suffix:List.of("","/1","/options","/routes")) mvc.perform(get(PATH+suffix)).andExpect(status().isForbidden());
        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isForbidden());mvc.perform(put(PATH+"/2").contentType(MediaType.APPLICATION_JSON).content(editBody())).andExpect(status().isForbidden());
        mvc.perform(put(PATH+"/sort").contentType(MediaType.APPLICATION_JSON).content("{\"items\":[{\"id\":\"2\",\"sort\":4}]}")).andExpect(status().isForbidden());mvc.perform(delete(PATH+"/4")).andExpect(status().isForbidden());
        when(tokens.getLoginUser(any())).thenReturn(null);mvc.perform(get(PATH)).andExpect(status().isUnauthorized());
    }
    @Test void databaseLengthBoundsRejectOversizedPermissionsBeforeWrite() throws Exception
    {mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(BODY.replace("\"cached\":true","\"cached\":true,\"permission\":\""+"x".repeat(101)+"\""))).andExpect(status().isBadRequest());verify(mapper,never()).insert(any());}
    @Test void insertingBelowMaximumDepthCannotCreateAnInvalidBootstrapGraph() throws Exception
    {
        var rows=new ArrayList<MenuMutationMapper.Row>();for(int id=1;id<=64;id++) rows.add(row(id,id-1,"node-"+id,"Node "+id,"M","node-"+id,null));when(mapper.rows()).thenReturn(rows);
        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(BODY.replace("\"parentId\":\"0\"","\"parentId\":\"64\""))).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MENU_CYCLE"));verify(mapper,never()).insert(any());
    }
    @Test void parentOptionsExcludeTheEntireSubtreeEvenThroughUngrantedAncestors() throws Exception
    {
        var rows=new ArrayList<>(mapper.rows());rows.set(3,row(4,2,"hidden-parent","Hidden parent","M","hidden",null));rows.add(row(5,4,"granted-grandchild","Grandchild","M","grandchild",null));when(mapper.rows()).thenReturn(rows);
        actor(2,Set.of("system:menu:query"));when(mapper.grantedIds(2L)).thenReturn(List.of(1L,2L,3L,5L));
        mvc.perform(get(PATH+"/options?excludeId=2")).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].id").value("1"));
        mvc.perform(get(PATH+"/options?excludeId=4")).andExpect(status().isForbidden());
    }
    @Test void wholeTreeSortMayAtomicallyIncludeMoreThanOneHundredMenus() throws Exception
    {
        var rows=new ArrayList<MenuMutationMapper.Row>();for(int id=1;id<=150;id++) rows.add(row(id,0,"node-"+id,"Node "+id,"M","node-"+id,null));when(mapper.rows()).thenReturn(rows);
        String body="{\"items\":["+java.util.stream.IntStream.rangeClosed(1,150).mapToObj(id->"{\"id\":\""+id+"\",\"sort\":"+id+"}").collect(java.util.stream.Collectors.joining(","))+"]}";
        mvc.perform(put(PATH+"/sort").contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isNoContent());
        verify(legacy).updateMenuSort(argThat(ids->ids.length==150 && ids[149].equals("150")),argThat(sorts->sorts.length==150 && sorts[149].equals("150")));
    }
    @TestConfiguration static class Configuration
    {@Bean PermitAllUrlProperties permitAllUrlProperties(){return new PermitAllUrlProperties();}@Bean CorsFilter corsFilter(){return new CorsFilter(new UrlBasedCorsConfigurationSource());}}
}
