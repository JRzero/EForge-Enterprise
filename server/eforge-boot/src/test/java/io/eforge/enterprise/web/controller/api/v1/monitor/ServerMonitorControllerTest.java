package io.eforge.enterprise.web.controller.api.v1.monitor;

import java.util.*;
import org.junit.jupiter.api.*;
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
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.common.utils.spring.SpringUtils;
import io.eforge.enterprise.framework.web.domain.Server;
import io.eforge.enterprise.framework.web.domain.server.SysFile;
import io.eforge.enterprise.framework.config.SecurityConfig;
import io.eforge.enterprise.framework.config.properties.PermitAllUrlProperties;
import io.eforge.enterprise.framework.security.filter.JwtAuthenticationTokenFilter;
import io.eforge.enterprise.framework.security.handle.*;
import io.eforge.enterprise.framework.web.exception.*;
import io.eforge.enterprise.framework.web.service.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.junit.jupiter.api.Assertions.*;

@WebMvcTest
@ContextConfiguration(classes={ServerMonitorController.class,PermissionService.class,
        ApiExceptionHandler.class,ApiRoutingExceptionResolver.class,SpringUtils.class,SecurityConfig.class,ApiSecurityProblemHandler.class,
        AuthenticationEntryPointImpl.class,JwtAuthenticationTokenFilter.class,ServerMonitorControllerTest.Configuration.class})
class ServerMonitorControllerTest
{
    static final String BASE="/api/v1/monitor/server";
    @Autowired MockMvc mvc;
    @MockitoBean ServerMonitorService monitor;
    @MockitoBean TokenService tokens;
    @MockitoBean LogoutSuccessHandlerImpl logout;
    Server sample;
    @BeforeEach void prepare() {
        actor(Set.of("monitor:server:list"));sample=new Server();
        var cpu=sample.getCpu();cpu.setCpuNum(4);cpu.setTotal(100);cpu.setUsed(30);cpu.setSys(20);cpu.setFree(40);cpu.setWait(10);
        var memory=sample.getMem();memory.setTotal(8L*1024*1024*1024);memory.setUsed(3L*1024*1024*1024);memory.setFree(5L*1024*1024*1024);
        var jvm=sample.getJvm();jvm.setTotal(512L*1024*1024);jvm.setMax(1024L*1024*1024);jvm.setFree(128L*1024*1024);jvm.setVersion("17");jvm.setHome("/java");
        var host=sample.getSys();host.setComputerName("测试主机");host.setComputerIp("127.0.0.1");host.setOsName("Linux");host.setOsArch("amd64");host.setUserDir("/workspace");
        var disk=new SysFile();disk.setDirName("/");disk.setSysTypeName("ext4");disk.setTypeName("本地");disk.setTotal("100 GB");disk.setUsed("25 GB");disk.setFree("75 GB");disk.setUsage(25);sample.setSysFiles(List.of(disk));
        when(monitor.snapshot()).thenReturn(ServerMonitorResponse.from(sample));
    }
    void actor(Set<String> grants){var user=new SysUser(2L);user.setUserName("reader");when(tokens.getLoginUser(any())).thenReturn(new LoginUser(2L,103L,user,grants));}
    @Test void originalGrantAndAuthenticationAreAuthoritativeBeforeSampling() throws Exception {
        actor(Set.of());mvc.perform(get(BASE)).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        when(tokens.getLoginUser(any())).thenReturn(null);mvc.perform(get(BASE)).andExpect(status().isUnauthorized());verifyNoInteractions(monitor);
    }
    @Test void concreteResponsePreservesBinaryUnitsPercentagesAndAllOriginalDiagnosticGroups() throws Exception {
        mvc.perform(get(BASE)).andExpect(status().isOk()).andExpect(jsonPath("$.sampledAt").isString())
                .andExpect(jsonPath("$.cpu.coreCount").value(4)).andExpect(jsonPath("$.cpu.userPercent").value(30))
                .andExpect(jsonPath("$.cpu.systemPercent").value(20)).andExpect(jsonPath("$.cpu.waitPercent").value(10))
                .andExpect(jsonPath("$.memory.totalGiB").value(8)).andExpect(jsonPath("$.memory.usagePercent").value(37.5))
                .andExpect(jsonPath("$.jvm.totalMiB").value(512)).andExpect(jsonPath("$.jvm.usedMiB").value(384)).andExpect(jsonPath("$.jvm.maxMiB").value(1024))
                .andExpect(jsonPath("$.jvm.usagePercent").value(75)).andExpect(jsonPath("$.jvm.startedAt").isString()).andExpect(jsonPath("$.jvm.arguments").isString())
                .andExpect(jsonPath("$.host.name").value("测试主机")).andExpect(jsonPath("$.host.workingDirectory").value("/workspace"))
                .andExpect(jsonPath("$.disks[0].mount").value("/")).andExpect(jsonPath("$.disks[0].totalSize").value("100 GB"))
                .andExpect(jsonPath("$.disks[0].usagePercent").value(25)).andExpect(jsonPath("$.data").doesNotExist()).andExpect(jsonPath("$.mem").doesNotExist());
    }
    @Test void authorizedSamplingFailuresUseGenericProblemDetail() throws Exception {
        when(monitor.snapshot()).thenThrow(new ApiFailure(503,"SERVER_MONITOR_UNAVAILABLE","Server diagnostics are temporarily unavailable."));
        mvc.perform(get(BASE)).andExpect(status().isServiceUnavailable()).andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.code").value("SERVER_MONITOR_UNAVAILABLE")).andExpect(jsonPath("$.detail").value("Server diagnostics are temporarily unavailable."));
    }
    @Test void probeIoFailuresDoNotExposeInternalHostOrPath() throws Exception {
        var service=spy(new ServerMonitorService());doThrow(new java.io.IOException("private-host/private-path")).when(service).sample();
        var failure=assertThrows(ApiFailure.class,service::snapshot);assertEquals(503,failure.status());assertEquals("SERVER_MONITOR_UNAVAILABLE",failure.code());assertEquals("Server diagnostics are temporarily unavailable.",failure.getMessage());
    }
    @Test void successfulProbeUsesCanonicalProjectionWithoutChangingItsUnits() throws Exception {
        var service=spy(new ServerMonitorService());doReturn(sample).when(service).sample();
        var result=service.snapshot();assertEquals(8,result.memory().totalGiB());assertEquals(512,result.jvm().totalMiB());assertEquals(25,result.disks().get(0).usagePercent());
        assertThrows(UnsupportedOperationException.class,()->result.disks().clear());
    }
    @Test void interruptedProbePreservesTheInterruptFlag() throws Exception {
        var service=spy(new ServerMonitorService());doThrow(new InterruptedException("sampling cancelled")).when(service).sample();
        try {assertThrows(ApiFailure.class,service::snapshot);assertTrue(Thread.currentThread().isInterrupted());} finally {Thread.interrupted();}
    }
    @TestConfiguration static class Configuration
    {@Bean PermitAllUrlProperties permitAllUrlProperties(){return new PermitAllUrlProperties();}@Bean CorsFilter corsFilter(){return new CorsFilter(new UrlBasedCorsConfigurationSource());}}
}
