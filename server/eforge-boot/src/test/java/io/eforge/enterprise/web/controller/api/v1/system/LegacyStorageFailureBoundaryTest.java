package io.eforge.enterprise.web.controller.api.v1.system;

import java.sql.SQLException;
import java.util.UUID;
import java.util.stream.Stream;
import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.BadSqlGrammarException;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.CannotCreateTransactionException;
import org.springframework.transaction.TransactionSystemException;
import io.eforge.enterprise.common.core.domain.entity.SysDept;
import io.eforge.enterprise.common.exception.ServiceException;
import io.eforge.enterprise.common.exception.user.UserException;
import io.eforge.enterprise.common.utils.MessageUtils;
import io.eforge.enterprise.framework.web.exception.ApiDiagnostics;
import io.eforge.enterprise.framework.web.exception.ApiExceptionHandler;
import io.eforge.enterprise.framework.web.exception.GlobalExceptionHandler;
import io.eforge.enterprise.system.mapper.DepartmentMutationMapper;
import io.eforge.enterprise.system.service.ISysDeptService;
import io.eforge.enterprise.web.controller.system.SysDeptController;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Real controllers and advice routing. Transaction/filter behavior is covered by native probes. */
class LegacyStorageFailureBoundaryTest
{
    private static final String SAFE_MESSAGE = "The request could not be completed.";
    private static final String PRIVATE = "SELECT password FROM internal_table jdbc:mysql://private-host driver-secret";
    private static final String CALLER_ID = "caller-controlled-private-id";
    private static final ObjectMapper JSON = new ObjectMapper();
    private final ISysDeptService departments = mock(ISysDeptService.class);
    private final DepartmentMutationMapper mutations = mock(DepartmentMutationMapper.class);
    private final Logger legacyLogger = (Logger) LoggerFactory.getLogger(GlobalExceptionHandler.class);
    private final Logger canonicalLogger = (Logger) LoggerFactory.getLogger(ApiExceptionHandler.class);
    private final ListAppender<ILoggingEvent> events = new ListAppender<>();
    private MockMvc mvc;

    @BeforeEach void setup()
    {
        SysDeptController legacy = new SysDeptController();
        ReflectionTestUtils.setField(legacy, "deptService", departments);
        ReflectionTestUtils.setField(legacy, "mutations", mutations);
        mvc = MockMvcBuilders.standaloneSetup(legacy, new DepartmentController(departments, mutations))
                // Higher-priority canonical advice must still beat the more specific legacy handler.
                .setControllerAdvice(new GlobalExceptionHandler(), new ApiExceptionHandler()).build();
        events.start(); legacyLogger.addAppender(events); canonicalLogger.addAppender(events);
    }

    @AfterEach void cleanup()
    {
        legacyLogger.detachAppender(events); canonicalLogger.detachAppender(events); events.stop();
    }

    static Stream<RuntimeException> storageFailures()
    {
        return Stream.of(new DataAccessResourceFailureException(PRIVATE, new SQLException(PRIVATE)),
                new BadSqlGrammarException(PRIVATE, PRIVATE, new SQLException(PRIVATE)),
                new CannotCreateTransactionException(PRIVATE, new SQLException(PRIVATE)),
                new TransactionSystemException(PRIVATE, new SQLException(PRIVATE)));
    }

    @ParameterizedTest @MethodSource("storageFailures")
    void legacyListStorageFailureKeepsAjaxTransportAndUsesPrivateCorrelatedDiagnostics(RuntimeException failure) throws Exception
    {
        when(departments.selectDeptList(any(SysDept.class))).thenThrow(failure);
        MvcResult result = mvc.perform(get("/system/dept/list").param("deptName", "private-query")
                        .header(ApiDiagnostics.REQUEST_ID_HEADER, CALLER_ID)).andReturn();
        assertLegacyStorageResponse(result);
        assertPrivateDiagnostic(result, false, failure);
        verify(departments).selectDeptList(any(SysDept.class)); verifyNoInteractions(mutations);
    }

    @ParameterizedTest @MethodSource("storageFailures")
    void legacyWriteRootLockFailureIsSafeBeforeAnyDepartmentRead(RuntimeException failure) throws Exception
    {
        when(mutations.lockRoot()).thenThrow(failure);
        MvcResult result = mvc.perform(put("/system/dept").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"deptId\":101,\"parentId\":100,\"deptName\":\"Team\",\"orderNum\":1,\"status\":\"0\"}")
                        .header(ApiDiagnostics.REQUEST_ID_HEADER, CALLER_ID)).andReturn();
        assertLegacyStorageResponse(result);
        assertPrivateDiagnostic(result, false, failure);
        verify(mutations).lockRoot(); verifyNoInteractions(departments);
    }

    @ParameterizedTest @MethodSource("storageFailures")
    void canonicalListStorageFailureStillUsesProblemDetailAndCanonicalDiagnostics(RuntimeException failure) throws Exception
    {
        when(departments.selectDeptList(any(SysDept.class))).thenThrow(failure);
        MvcResult result = mvc.perform(get("/api/v1/system/departments").param("name", "private-query")
                        .header(ApiDiagnostics.REQUEST_ID_HEADER, CALLER_ID)).andReturn();
        assertCanonicalStorageResponse(result);
        assertPrivateDiagnostic(result, true, failure);
        verify(departments).selectDeptList(any(SysDept.class)); verifyNoInteractions(mutations);
    }

    @ParameterizedTest @MethodSource("storageFailures")
    void canonicalWriteStorageFailureDoesNotFallThroughToCompatibilityAdvice(RuntimeException failure) throws Exception
    {
        when(mutations.lockRoot()).thenThrow(failure);
        MvcResult result = mvc.perform(post("/api/v1/system/departments").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"parentId\":\"100\",\"name\":\"Team\",\"sort\":1,\"status\":\"0\"}")
                        .header(ApiDiagnostics.REQUEST_ID_HEADER, CALLER_ID)).andReturn();
        assertCanonicalStorageResponse(result);
        assertPrivateDiagnostic(result, true, failure);
        verify(mutations).lockRoot(); verifyNoInteractions(departments);
    }

    @Test void ordinaryServiceExceptionKeepsItsExplicitBusinessCodeAndMessage() throws Exception
    {
        when(departments.selectDeptList(any(SysDept.class))).thenThrow(new ServiceException("Department is disabled.", 409));
        mvc.perform(get("/system/dept/list")).andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(409)).andExpect(jsonPath("$.msg").value("Department is disabled."));
    }

    @Test void ordinaryUserExceptionKeepsItsLocalizedBusinessMessage() throws Exception
    {
        try (var messages = mockStatic(MessageUtils.class))
        {
            messages.when(() -> MessageUtils.message("user.blocked", (Object[]) null)).thenReturn("Account is disabled.");
            when(departments.selectDeptList(any(SysDept.class))).thenThrow(new UserException("user.blocked", null));
            mvc.perform(get("/system/dept/list")).andExpect(status().isOk())
                    .andExpect(jsonPath("$.code").value(500)).andExpect(jsonPath("$.msg").value("Account is disabled."));
        }
    }

    @Test void unrelatedRuntimeContractIsNotBroadenedByStorageHandling() throws Exception
    {
        when(departments.selectDeptList(any(SysDept.class))).thenThrow(new IllegalStateException("ordinary runtime message"));
        mvc.perform(get("/system/dept/list")).andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(500)).andExpect(jsonPath("$.msg").value("ordinary runtime message"));
    }

    private static void assertLegacyStorageResponse(MvcResult result) throws Exception
    {
        status().isOk().match(result);
        content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON).match(result);
        jsonPath("$.code").value(500).match(result);
        jsonPath("$.msg").value(SAFE_MESSAGE).match(result);
        jsonPath("$.status").doesNotExist().match(result);
        jsonPath("$.detail").doesNotExist().match(result);
        assertCorrelatedResponse(result);
    }

    private static void assertCanonicalStorageResponse(MvcResult result) throws Exception
    {
        status().isInternalServerError().match(result);
        content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON).match(result);
        jsonPath("$.code").value("INTERNAL_ERROR").match(result);
        jsonPath("$.detail").value(SAFE_MESSAGE).match(result);
        jsonPath("$.msg").doesNotExist().match(result);
        assertCorrelatedResponse(result);
    }

    private static void assertCorrelatedResponse(MvcResult result) throws Exception
    {
        header().string("Cache-Control", "no-store").match(result);
        String requestId = result.getResponse().getHeader(ApiDiagnostics.REQUEST_ID_HEADER);
        assertNotNull(requestId); assertEquals(requestId, UUID.fromString(requestId).toString());
        jsonPath("$.requestId").value(requestId).match(result);
        assertNoPrivateData(result.getResponse().getContentAsString());
    }

    private void assertPrivateDiagnostic(MvcResult result, boolean canonical, RuntimeException failure) throws Exception
    {
        assertEquals(1, events.list.size(), "One bounded diagnostic replaces raw exception logging.");
        ILoggingEvent event = events.list.get(0);
        assertEquals(canonical ? ApiExceptionHandler.class.getName() : GlobalExceptionHandler.class.getName(), event.getLoggerName());
        assertEquals(Level.ERROR, event.getLevel()); assertNull(event.getThrowableProxy());
        String message = event.getFormattedMessage(); assertNoPrivateData(message);
        JsonNode record = JSON.readTree(message);
        assertEquals("api_server_error", record.path("event").asText());
        assertEquals(canonical ? "canonical_http" : "compatibility_http", record.path("entryPoint").asText());
        assertEquals(500, record.path("status").asInt()); assertEquals("HTTP_500", record.path("code").asText());
        assertEquals(result.getResponse().getHeader(ApiDiagnostics.REQUEST_ID_HEADER), record.path("requestId").asText());
        assertEquals(failure.getClass().getName(), record.path("errors").get(0).path("type").asText());
        assertTrue(record.path("errors").size() <= 4);
        for (JsonNode error : record.path("errors"))
        {
            assertTrue(error.path("locations").size() <= 8);
            for (JsonNode location : error.path("locations")) assertTrue(location.asText().startsWith("io.eforge.enterprise."));
        }
    }

    private static void assertNoPrivateData(String text)
    {
        for (String secret : new String[]{"SELECT password", "internal_table", "jdbc:mysql", "private-host", "driver-secret", CALLER_ID, "private-query"})
            assertFalse(text.contains(secret), "Private input must not appear: " + secret);
    }
}
