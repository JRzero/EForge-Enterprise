package io.eforge.enterprise.framework.web.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.TimerTask;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.function.Predicate;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.MockedStatic;
import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContext;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.context.support.StaticMessageSource;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.InternalAuthenticationServiceException;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import io.eforge.enterprise.common.constant.CacheConstants;
import io.eforge.enterprise.common.constant.Constants;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.core.redis.RedisCache;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.common.exception.ServiceException;
import io.eforge.enterprise.common.exception.user.UserException;
import io.eforge.enterprise.common.utils.spring.SpringUtils;
import io.eforge.enterprise.framework.manager.AsyncManager;
import io.eforge.enterprise.framework.manager.factory.AsyncFactory;
import io.eforge.enterprise.framework.security.context.AuthenticationContextHolder;
import io.eforge.enterprise.system.service.ISysConfigService;
import io.eforge.enterprise.system.service.ISysUserService;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Login orchestration uses the real credential provider where business-error wrapping matters. */
class SysLoginServiceTest
{
    private static final String USERNAME = "reader";
    private static final String PASSWORD = "correct-password";
    private static final String SESSION = "created-session";
    private static final String CAPTCHA = CacheConstants.CAPTCHA_CODE_KEY + "captcha-id";
    private static final String RETRIES = CacheConstants.PWD_ERR_CNT_KEY + USERNAME;
    private static final String PRIVATE = "private SQL password=secret redis://internal.example";
    private final TokenService tokens = mock(TokenService.class);
    private final AuthenticationManager authentication = mock(AuthenticationManager.class);
    private final RedisCache redis = mock(RedisCache.class);
    private final ISysUserService users = mock(ISysUserService.class);
    private final ISysConfigService config = mock(ISysConfigService.class);
    private final List<AuditTask> queued = new ArrayList<>();
    private final List<String> events = new ArrayList<>();
    private final StaticMessageSource messages = new StaticMessageSource();
    private MockedStatic<SpringUtils> spring;
    private MockedStatic<AsyncManager> managers;
    private MockedStatic<AsyncFactory> factories;
    private LocaleContext previousLocale;
    private SysLoginService service;
    private SysUser user;
    private LoginUser principal;
    private Predicate<AuditTask> rejectAudit = ignored -> false;
    private final RuntimeException queueFailure = new RejectedExecutionException(PRIVATE);

    @BeforeEach void setup()
    {
        previousLocale = LocaleContextHolder.getLocaleContext();
        LocaleContextHolder.setLocale(Locale.ENGLISH);
        messages.addMessage("user.password.not.match", Locale.ENGLISH, "Password is incorrect.");
        messages.addMessage("user.password.retry.limit.exceed", Locale.ENGLISH, "Password failed {0} times; retry after {1} minutes.");
        messages.addMessage("user.not.exists", Locale.ENGLISH, "Account does not exist.");
        messages.addMessage("user.password.delete", Locale.ENGLISH, "Account was deleted.");
        messages.addMessage("user.blocked", Locale.ENGLISH, "Account is disabled.");
        messages.addMessage("user.login.success", Locale.ENGLISH, "Login succeeded.");
        messages.addMessage("user.jcaptcha.error", Locale.ENGLISH, "Captcha is incorrect.");
        messages.addMessage("user.jcaptcha.expire", Locale.ENGLISH, "Captcha has expired.");
        messages.addMessage("not.null", Locale.ENGLISH, "Username and password are required.");
        messages.addMessage("login.blocked", Locale.ENGLISH, "Login is not allowed.");
        messages.addMessage("internal.secret", Locale.ENGLISH, PRIVATE);

        // AsyncManager initializes a static scheduler. No Spring context or task thread is started.
        spring = mockStatic(SpringUtils.class);
        spring.when(() -> SpringUtils.getBean("scheduledExecutorService"))
                .thenReturn(mock(ScheduledExecutorService.class));
        spring.when(() -> SpringUtils.getBean(MessageSource.class)).thenReturn(messages);
        AsyncManager manager = mock(AsyncManager.class);
        managers = mockStatic(AsyncManager.class);
        managers.when(AsyncManager::me).thenReturn(manager);
        factories = mockStatic(AsyncFactory.class, invocation -> {
            if (invocation.getMethod().getName().equals("recordLogininfor"))
                return new AuditTask(invocation.getArgument(0), invocation.getArgument(1), invocation.getArgument(2));
            return RETURNS_DEFAULTS.answer(invocation);
        });
        doAnswer(invocation -> {
            AuditTask task = invocation.getArgument(0);
            events.add("audit-attempt:" + task.status);
            if (rejectAudit.test(task)) throw queueFailure;
            queued.add(task);
            events.add("audit-queued:" + task.status);
            return null;
        }).when(manager).execute(any(TimerTask.class));

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("192.0.2.7");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
        service = new SysLoginService();
        ReflectionTestUtils.setField(service, "tokenService", tokens);
        ReflectionTestUtils.setField(service, "authenticationManager", authentication);
        ReflectionTestUtils.setField(service, "redisCache", redis);
        ReflectionTestUtils.setField(service, "userService", users);
        ReflectionTestUtils.setField(service, "configService", config);
        when(config.selectConfigByKey("sys.login.blackIPList")).thenReturn("");

        user = new SysUser(7L);
        user.setUserName(USERNAME); user.setDeptId(103L); user.setStatus("0"); user.setDelFlag("0");
        user.setPassword(new BCryptPasswordEncoder(4).encode(PASSWORD));
        principal = new LoginUser(7L, 103L, user, Set.of("system:user:list"));
        when(authentication.authenticate(any())).thenAnswer(invocation -> {
            assertEquals(USERNAME, AuthenticationContextHolder.getContext().getName());
            events.add("credentials-verified");
            return new UsernamePasswordAuthenticationToken(principal, null, List.of());
        });
        when(tokens.createToken(any())).thenAnswer(invocation -> {
            assertNull(AuthenticationContextHolder.getContext(), "Raw credential context must be cleared before the final fence");
            LoginUser login = invocation.getArgument(0);
            login.setToken(SESSION);
            events.add("session-created");
            return "signed-token";
        });
        doAnswer(invocation -> { events.add("login-info-written"); return null; })
                .when(users).updateLoginInfo(eq(7L), anyString(), any());
        doAnswer(invocation -> { events.add("session-revoked"); return null; })
                .when(tokens).delLoginUser(anyString());
    }

    @AfterEach void cleanup()
    {
        AuthenticationContextHolder.clearContext();
        RequestContextHolder.resetRequestAttributes();
        LocaleContextHolder.setLocaleContext(previousLocale);
        if (factories != null) factories.close();
        if (managers != null) managers.close();
        if (spring != null) spring.close();
    }

    @Test void successfulLoginConsumesCaptchaOnceAndQueuesSuccessOnlyAfterSessionAndLoginInfo()
    {
        enableCaptcha("answer");
        assertEquals("signed-token", login());
        assertEquals(List.of("credentials-verified", "session-created", "login-info-written",
                "audit-attempt:" + Constants.LOGIN_SUCCESS, "audit-queued:" + Constants.LOGIN_SUCCESS), events);
        assertAudit(Constants.LOGIN_SUCCESS, "Login succeeded.");
        verify(redis).getCacheObject(CAPTCHA); verify(redis).deleteObject(CAPTCHA);
        verify(authentication).authenticate(any()); verify(tokens).createToken(principal);
        verify(tokens, never()).delLoginUser(anyString());
        verify(users).updateLoginInfo(eq(7L), eq("192.0.2.7"), any());
        assertNull(AuthenticationContextHolder.getContext());
    }

    @Test void changedCredentialProofAfterProviderSuccessCannotReportLoginSuccessOrRepeatCredentialChecks()
    {
        useRealProvider();
        enableCaptcha("answer");
        ApiFailure changed = new ApiFailure(401, "AUTHENTICATION_FAILED", "An active account is required.");
        doThrow(changed).when(tokens).createToken(any(LoginUser.class));
        assertSame(changed, assertThrows(ApiFailure.class, this::login));
        assertFailureAudit();
        verify(users, never()).updateLoginInfo(anyLong(), anyString(), any());
        verify(users).selectUserByUserName(USERNAME); verify(redis).getCacheObject(CAPTCHA);
        verify(redis).deleteObject(CAPTCHA); verify(redis).getCacheObject(RETRIES);
        verify(redis, never()).setCacheObject(anyString(), any(), anyInt(), any(TimeUnit.class));
        verify(tokens, never()).delLoginUser(anyString());
        assertNull(AuthenticationContextHolder.getContext());
    }

    @ParameterizedTest
    @CsvSource({"AUTHORIZATION_UNAVAILABLE,Current authorization could not be verified.",
            "SESSION_STORE_UNAVAILABLE,The login session could not be verified."})
    void finalProofOrSessionStorageOutageStays503AndCannotEmitSuccess(String code, String detail)
    {
        ApiFailure unavailable = new ApiFailure(503, code, detail);
        unavailable.initCause(new DataAccessResourceFailureException(PRIVATE));
        doThrow(unavailable).when(tokens).createToken(principal);
        assertSame(unavailable, assertThrows(ApiFailure.class, this::login));
        assertFailureAudit();
        verify(users, never()).updateLoginInfo(anyLong(), anyString(), any());
        assertNull(AuthenticationContextHolder.getContext());
    }

    @Test void loginInfoFailureRevokesCreatedSessionAndRecordsOneSafeFailure()
    {
        RuntimeException database = new DataAccessResourceFailureException(PRIVATE);
        doThrow(database).when(users).updateLoginInfo(anyLong(), anyString(), any());
        ApiFailure failure = assertUnavailable(this::login);
        assertSame(database, failure.getCause());
        verify(tokens).delLoginUser(SESSION);
        assertFailureAudit();
        assertTrue(events.indexOf("session-revoked") < events.indexOf("audit-queued:" + Constants.LOGIN_FAIL));
        assertFalse(events.contains("audit-attempt:" + Constants.LOGIN_SUCCESS));
    }

    @Test void rejectedSuccessAuditRevokesSessionAndQueuesOnlyOneFailure()
    {
        rejectAudit = task -> Constants.LOGIN_SUCCESS.equals(task.status);
        ApiFailure failure = assertUnavailable(this::login);
        assertSame(queueFailure, failure.getCause());
        verify(tokens).delLoginUser(SESSION);
        assertFailureAudit();
        assertEquals(List.of("credentials-verified", "session-created", "login-info-written",
                "audit-attempt:" + Constants.LOGIN_SUCCESS, "session-revoked",
                "audit-attempt:" + Constants.LOGIN_FAIL, "audit-queued:" + Constants.LOGIN_FAIL), events);
    }

    @Test void failedCompensatingDeleteCannotMasqueradeAsSuccessfulLoginOrExposeInfrastructureText()
    {
        RuntimeException database = new DataAccessResourceFailureException(PRIVATE);
        ApiFailure revocation = new ApiFailure(503, "SESSION_STORE_UNAVAILABLE", "The login session could not be verified.");
        doThrow(database).when(users).updateLoginInfo(anyLong(), anyString(), any());
        doThrow(revocation).when(tokens).delLoginUser(SESSION);
        ApiFailure failure = assertUnavailable(this::login);
        assertSame(database, failure.getCause());
        assertArrayEquals(new Throwable[] {revocation}, database.getSuppressed());
        assertFailureAudit();
    }

    @Test void compensationReturningSameFailureDoesNotReplaceItWithSelfSuppressionError()
    {
        RuntimeException shared = new DataAccessResourceFailureException(PRIVATE);
        doThrow(shared).when(users).updateLoginInfo(anyLong(), anyString(), any());
        doThrow(shared).when(tokens).delLoginUser(SESSION);
        ApiFailure failure = assertUnavailable(this::login);
        assertSame(shared, failure.getCause()); assertEquals(0, shared.getSuppressed().length);
        assertFailureAudit();
    }

    @Test void failedFailureAuditDoesNotMaskTheOriginalAuthorizationOutageOrReportSuccess()
    {
        rejectAudit = ignored -> true;
        ApiFailure unavailable = new ApiFailure(503, "AUTHORIZATION_UNAVAILABLE", "Current authorization could not be verified.");
        doThrow(unavailable).when(tokens).createToken(principal);
        assertSame(unavailable, assertThrows(ApiFailure.class, this::login));
        assertArrayEquals(new Throwable[] {queueFailure}, unavailable.getSuppressed());
        assertTrue(queued.isEmpty());
        assertEquals(1, events.stream().filter(event -> event.startsWith("audit-attempt:")).count());
        verify(users, never()).updateLoginInfo(anyLong(), anyString(), any());
    }

    @Test void providerWrappingSqlFailureRemains503WithPrivateDetailsExcludedFromAuditAndResponse()
    {
        var database = new DataAccessResourceFailureException(PRIVATE);
        doThrow(new InternalAuthenticationServiceException(PRIVATE, database)).when(authentication).authenticate(any());
        assertUnavailable(this::login);
        assertFailureAudit(); verifyNoInteractions(tokens);
        assertNull(AuthenticationContextHolder.getContext());
    }

    @Test void arbitraryProviderMessageIsNeitherReturnedNorWrittenToAudit()
    {
        doThrow(new InternalAuthenticationServiceException(PRIVATE, new ServiceException(PRIVATE)))
                .when(authentication).authenticate(any());
        ServiceException failure = assertThrows(ServiceException.class, this::login);
        assertEquals("Login was rejected.", failure.getMessage());
        assertFailureAudit(); verifyNoInteractions(tokens);
        assertNull(AuthenticationContextHolder.getContext());
    }

    @Test void unapprovedUserExceptionResourceCannotBypassTheSafeBusinessMessageAllowlist()
    {
        doThrow(new InternalAuthenticationServiceException(PRIVATE, new UserException("internal.secret", null)))
                .when(authentication).authenticate(any());
        RuntimeException failure = assertThrows(RuntimeException.class, this::login);
        assertEquals("Login was rejected.", failure.getMessage());
        assertFailureAudit(); verifyNoInteractions(tokens);
    }

    @Test void initialConfigurationFailureIs503BeforeProviderAndHasOneSafeFailureAudit()
    {
        when(config.selectCaptchaEnabled()).thenThrow(new DataAccessResourceFailureException(PRIVATE));
        assertUnavailable(this::login);
        assertFailureAudit(); verifyNoInteractions(authentication, tokens, users);
    }

    @Test void captchaStoreFailureIs503WithoutCredentialCheckOrDuplicateFailureAudit()
    {
        enableCaptcha("answer");
        doThrow(new DataAccessResourceFailureException(PRIVATE)).when(redis).deleteObject(CAPTCHA);
        assertUnavailable(this::login);
        assertFailureAudit(); verifyNoInteractions(authentication, tokens, users);
        verify(redis).getCacheObject(CAPTCHA); verify(redis).deleteObject(CAPTCHA);
    }

    @Test void realProviderWrongPasswordKeepsBusinessMessageAndIncrementsRetryOnlyOnce()
    {
        useRealProvider();
        RuntimeException failure = assertThrows(RuntimeException.class,
                () -> service.login(USERNAME, "wrong-password", "answer", "captcha-id"));
        assertEquals("Password is incorrect.", failure.getMessage());
        assertAudit(Constants.LOGIN_FAIL, "Password is incorrect.");
        verify(redis).getCacheObject(RETRIES);
        verify(redis).setCacheObject(RETRIES, 1, 10, TimeUnit.MINUTES);
        verifyNoInteractions(tokens);
        verify(users, never()).updateLoginInfo(anyLong(), anyString(), any());
        assertNull(AuthenticationContextHolder.getContext());
    }

    @Test void realProviderPasswordLockKeepsRetryWindowMessageWithoutAnotherPasswordAttempt()
    {
        useRealProvider();
        when(redis.getCacheObject(RETRIES)).thenReturn(5);
        RuntimeException failure = assertThrows(RuntimeException.class, this::login);
        assertEquals("Password failed 5 times; retry after 10 minutes.", failure.getMessage());
        assertAudit(Constants.LOGIN_FAIL, "Password failed 5 times; retry after 10 minutes.");
        verify(redis).getCacheObject(RETRIES);
        verify(redis, never()).setCacheObject(anyString(), any(), anyInt(), any(TimeUnit.class));
        verify(redis, never()).hasKey(RETRIES);
        verifyNoInteractions(tokens);
        assertNull(AuthenticationContextHolder.getContext());
    }

    @ParameterizedTest
    @CsvSource({"missing,Account does not exist.", "deleted,Account was deleted.", "disabled,Account is disabled."})
    void realProviderAccountStateKeepsSafeBusinessMessageBeforePasswordChecks(String state, String message)
    {
        useRealProvider();
        if (state.equals("missing")) when(users.selectUserByUserName(USERNAME)).thenReturn(null);
        if (state.equals("deleted")) user.setDelFlag("2");
        if (state.equals("disabled")) user.setStatus("1");
        RuntimeException failure = assertThrows(RuntimeException.class, this::login);
        assertEquals(message, failure.getMessage());
        assertAudit(Constants.LOGIN_FAIL, message);
        verify(redis, never()).getCacheObject(RETRIES); verifyNoInteractions(tokens);
        assertNull(AuthenticationContextHolder.getContext());
    }

    @Test void directBadCredentialsUsesTheFixedBusinessMessageRatherThanProviderDetail()
    {
        doThrow(new BadCredentialsException(PRIVATE)).when(authentication).authenticate(any());
        RuntimeException failure = assertThrows(RuntimeException.class, this::login);
        assertEquals("Password is incorrect.", failure.getMessage());
        assertAudit(Constants.LOGIN_FAIL, "Password is incorrect.");
        verifyNoInteractions(tokens); assertNull(AuthenticationContextHolder.getContext());
    }

    @ParameterizedTest
    @CsvSource({"other,Captcha is incorrect.", "NULL,Captcha has expired."})
    void originalCaptchaFailuresRemainBusinessErrorsWithExactlyOneAudit(String cached, String message)
    {
        enableCaptcha(cached.equals("NULL") ? null : cached);
        RuntimeException failure = assertThrows(RuntimeException.class, this::login);
        assertFalse(failure instanceof ApiFailure, "Ordinary captcha rejection must not become a 503 outage");
        assertEquals(message, failure.getMessage()); assertAudit(Constants.LOGIN_FAIL, message);
        verifyNoInteractions(authentication, tokens, users);
        verify(redis, times(cached.equals("NULL") ? 0 : 1)).deleteObject(CAPTCHA);
    }

    @ParameterizedTest
    @ValueSource(strings = {"bad-credentials", "wrong-password", "locked", "disabled", "captcha-expired",
            "captcha-invalid", "empty-username", "short-password", "short-username", "blacklisted"})
    void rejectedBusinessAuditNeverLeaksQueueDetailsOrRetriesTheUnavailableAuditQueue(String scenario)
    {
        rejectAudit = ignored -> true;
        String username = USERNAME;
        String password = PASSWORD;
        switch (scenario)
        {
            case "bad-credentials" -> doThrow(new BadCredentialsException(PRIVATE))
                    .when(authentication).authenticate(any());
            case "wrong-password" -> { useRealProvider(); password = "wrong-password"; }
            case "locked" -> { useRealProvider(); when(redis.getCacheObject(RETRIES)).thenReturn(5); }
            case "disabled" -> { useRealProvider(); user.setStatus("1"); }
            case "captcha-expired" -> enableCaptcha(null);
            case "captcha-invalid" -> enableCaptcha("other");
            case "empty-username" -> username = "";
            case "short-password" -> password = "x";
            case "short-username" -> username = "x";
            case "blacklisted" -> when(config.selectConfigByKey("sys.login.blackIPList")).thenReturn("192.0.2.7");
            default -> throw new AssertionError("Unknown test scenario: " + scenario);
        }
        String attemptedUsername = username;
        String attemptedPassword = password;
        ApiFailure failure = assertUnavailable(() -> service.login(attemptedUsername, attemptedPassword, "answer", "captcha-id"));
        assertEquals("LOGIN_AUDIT_UNAVAILABLE", failure.code());
        assertSame(queueFailure, failure.getCause());
        assertTrue(queued.isEmpty());
        assertEquals(1, events.stream().filter(event -> event.startsWith("audit-attempt:")).count(),
                "An audit queue failure must not be retried through the generic login-failure path");
        verifyNoInteractions(tokens);
        verify(users, never()).updateLoginInfo(anyLong(), anyString(), any());
        assertNull(AuthenticationContextHolder.getContext());
    }

    @ParameterizedTest @ValueSource(strings = {"text", "extra", "missing", "none"})
    void lockMessageCannotExpandUntrustedOrMalformedArguments(String scenario)
    {
        Object[] arguments = switch (scenario)
        {
            case "text" -> new Object[] {5, PRIVATE};
            case "extra" -> new Object[] {5, 10, PRIVATE};
            case "missing" -> new Object[] {5};
            case "none" -> null;
            default -> throw new AssertionError("Unknown test scenario: " + scenario);
        };
        doThrow(new InternalAuthenticationServiceException(PRIVATE,
                new UserException("user.password.retry.limit.exceed", arguments)))
                .when(authentication).authenticate(any());
        RuntimeException failure = assertThrows(RuntimeException.class, this::login);
        assertEquals("Login was rejected.", failure.getMessage());
        assertFailureAudit(); verifyNoInteractions(tokens);
    }

    @Test void fixedBusinessResourceIgnoresUnexpectedExceptionArguments()
    {
        doThrow(new InternalAuthenticationServiceException(PRIVATE,
                new UserException("user.password.not.match", new Object[] {PRIVATE})))
                .when(authentication).authenticate(any());
        RuntimeException failure = assertThrows(RuntimeException.class, this::login);
        assertEquals("Password is incorrect.", failure.getMessage());
        assertAudit(Constants.LOGIN_FAIL, "Password is incorrect.");
        verifyNoInteractions(tokens);
    }

    private void useRealProvider()
    {
        SysPasswordService passwords = new SysPasswordService();
        ReflectionTestUtils.setField(passwords, "redisCache", redis);
        ReflectionTestUtils.setField(passwords, "maxRetryCount", 5);
        ReflectionTestUtils.setField(passwords, "lockTime", 10);
        UserDetailsServiceImpl details = new UserDetailsServiceImpl();
        ReflectionTestUtils.setField(details, "userService", users);
        ReflectionTestUtils.setField(details, "passwordService", passwords);
        SysPermissionService permissions = mock(SysPermissionService.class);
        when(permissions.getMenuPermission(any())).thenReturn(Set.of("system:user:list"));
        ReflectionTestUtils.setField(details, "permissionService", permissions);
        when(users.selectUserByUserName(USERNAME)).thenReturn(user);
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(details);
        provider.setPasswordEncoder(new BCryptPasswordEncoder(4));
        ReflectionTestUtils.setField(service, "authenticationManager", new ProviderManager(provider));
    }

    private void enableCaptcha(String value)
    {
        when(config.selectCaptchaEnabled()).thenReturn(true);
        when(redis.getCacheObject(CAPTCHA)).thenReturn(value);
    }

    private String login() { return service.login(USERNAME, PASSWORD, "answer", "captcha-id"); }

    private ApiFailure assertUnavailable(org.junit.jupiter.api.function.Executable action)
    {
        ApiFailure failure = assertThrows(ApiFailure.class, action);
        assertEquals(503, failure.status());
        assertFalse(failure.getMessage().contains("private"));
        assertFalse(failure.getMessage().contains("secret"));
        assertFalse(failure.getMessage().contains("internal.example"));
        return failure;
    }

    private void assertFailureAudit() { assertAudit(Constants.LOGIN_FAIL, "Login was not completed."); }

    private void assertAudit(String status, String message)
    {
        assertEquals(1, queued.size(), "Only one completed audit enqueue is expected");
        assertEquals(USERNAME, queued.get(0).username);
        assertEquals(status, queued.get(0).status); assertEquals(message, queued.get(0).message);
        assertFalse(queued.get(0).message.contains(PRIVATE));
    }

    private static final class AuditTask extends TimerTask
    {
        private final String username;
        private final String status;
        private final String message;
        AuditTask(String username, String status, String message)
        { this.username = username; this.status = status; this.message = message; }
        @Override public void run() { fail("Tests must never execute a real asynchronous task"); }
    }
}
