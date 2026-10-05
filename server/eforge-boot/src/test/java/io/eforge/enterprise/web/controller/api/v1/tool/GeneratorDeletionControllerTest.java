package io.eforge.enterprise.web.controller.api.v1.tool;

import java.util.*;
import java.time.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.common.utils.spring.SpringUtils;
import io.eforge.enterprise.framework.config.SecurityConfig;
import io.eforge.enterprise.framework.config.properties.PermitAllUrlProperties;
import io.eforge.enterprise.framework.security.filter.JwtAuthenticationTokenFilter;
import io.eforge.enterprise.framework.security.handle.*;
import io.eforge.enterprise.framework.web.exception.*;
import io.eforge.enterprise.framework.web.service.*;
import io.eforge.enterprise.generator.mapper.GenTableMapper;
import io.eforge.enterprise.generator.mapper.GenTableColumnMapper;
import io.eforge.enterprise.generator.domain.GenTable;
import io.eforge.enterprise.generator.domain.GenTableColumn;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.junit.jupiter.api.Assertions.*;

@WebMvcTest
@ContextConfiguration(classes={GeneratorDeletionController.class,GeneratorDeletionService.class,PermissionService.class,
    ApiExceptionHandler.class,ApiRoutingExceptionResolver.class,SpringUtils.class,SecurityConfig.class,ApiSecurityProblemHandler.class,
    AuthenticationEntryPointImpl.class,JwtAuthenticationTokenFilter.class,GeneratorDeletionControllerTest.Configuration.class})
class GeneratorDeletionControllerTest {
    static final String PATH="/api/v1/tool/generator/tables";
    @Autowired MockMvc mvc;
    @MockitoBean io.eforge.enterprise.generator.service.GeneratorMetadataBoundary boundary;
    @MockitoBean GenTableMapper tables;
    @MockitoBean GenTableColumnMapper columns;
    @MockitoBean TokenService tokens;
    @MockitoBean LogoutSuccessHandlerImpl logout;
    @BeforeEach void prepare(){actor(Set.of("tool:gen:remove"));}
    void actor(Set<String> grants){var user=new SysUser(2L);user.setUserName("editor");when(tokens.getLoginUser(any())).thenReturn(new LoginUser(2L,103L,user,grants));}
    org.springframework.test.web.servlet.ResultActions request(String body) throws Exception{return mvc.perform(delete(PATH).contentType("application/json").content(body));}
    @Test void originalRemoveGrantDeduplicatesExactIdsAndDeletesOnlyMetadata() throws Exception {
        request("{\"ids\":[\"9007199254740993\",\"9007199254740993\"]}").andExpect(status().isNoContent());
        verify(boundary).lock();verify(boundary).assertDeletionAllowed(org.mockito.AdditionalMatchers.aryEq(new Long[]{9007199254740993L}));
        verify(tables).deleteGenTableByIds(org.mockito.AdditionalMatchers.aryEq(new Long[]{9007199254740993L}));
        verify(columns).deleteGenTableColumnByIds(org.mockito.AdditionalMatchers.aryEq(new Long[]{9007199254740993L}));
    }
    @ParameterizedTest @ValueSource(strings={"{}","{\"ids\":[]}","{\"ids\":[null]}","{\"ids\":[\"0\"]}","{\"ids\":[\"9223372036854775808\"]}"})
    void rejectsInvalidSelectionsBeforeLockOrSql(String body) throws Exception {request(body).andExpect(status().isBadRequest());verifyNoInteractions(boundary,tables,columns);}
    @Test void externalReferenceRejectsWholeBatchBeforeWrites() throws Exception {
        doThrow(new io.eforge.enterprise.common.exception.ApiFailure(409,"GENERATOR_TABLE_REFERENCED","Referenced metadata.")).when(boundary).assertDeletionAllowed(any());
        request("{\"ids\":[\"1\",\"2\"]}").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("GENERATOR_TABLE_REFERENCED"));verifyNoInteractions(tables,columns);
    }
    @Test void everyOtherGrantAndAnonymousAreDeniedBeforeLock() throws Exception {
        for(var grants:List.of(Set.of("tool:gen:list","tool:gen:edit","tool:gen:import"),Set.<String>of())){actor(grants);request("{\"ids\":[\"1\"]}").andExpect(status().isForbidden());}
        when(tokens.getLoginUser(any())).thenReturn(null);request("{\"ids\":[\"1\"]}").andExpect(status().isUnauthorized());verifyNoInteractions(boundary,tables,columns);
    }
    @Test void sqlFailureIsSanitized() throws Exception {
        when(columns.deleteGenTableColumnByIds(any())).thenThrow(new org.springframework.dao.DataAccessResourceFailureException("private SQL"));
        request("{\"ids\":[\"1\"]}").andExpect(status().isInternalServerError()).andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("private"))));
    }
    @TestConfiguration static class Configuration {
        @Bean PermitAllUrlProperties permitAll(){var value=new PermitAllUrlProperties();value.setUrls(List.of());return value;}
        @Bean CorsFilter corsFilter(){return new CorsFilter(new UrlBasedCorsConfigurationSource());}
    }
}
