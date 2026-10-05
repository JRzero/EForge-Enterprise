package io.eforge.enterprise.framework.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.authentication.logout.LogoutFilter;
import org.springframework.security.web.authentication.session.NullAuthenticatedSessionStrategy;
import org.springframework.web.filter.CorsFilter;

import io.eforge.enterprise.framework.config.properties.PermitAllUrlProperties;
import io.eforge.enterprise.framework.security.filter.JwtAuthenticationTokenFilter;
import io.eforge.enterprise.framework.security.handle.AuthenticationEntryPointImpl;
import io.eforge.enterprise.framework.security.handle.LogoutSuccessHandlerImpl;
import io.eforge.enterprise.framework.security.handle.ApiSecurityProblemHandler;

/**
 * Spring Security configuration.
 *
 * Backend authorization remains the security boundary. Diagnostic endpoints
 * are not anonymously exposed by default.
 */
@EnableMethodSecurity(prePostEnabled = true, securedEnabled = true)
@Configuration
public class SecurityConfig
{
    @Autowired
    private AuthenticationEntryPointImpl unauthorizedHandler;

    @Autowired
    private ApiSecurityProblemHandler apiProblemHandler;

    @Autowired
    private LogoutSuccessHandlerImpl logoutSuccessHandler;

    @Autowired
    private JwtAuthenticationTokenFilter authenticationTokenFilter;

    @Autowired
    private CorsFilter corsFilter;

    @Autowired
    private PermitAllUrlProperties permitAllUrl;

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authenticationConfiguration)
            throws Exception
    {
        return authenticationConfiguration.getAuthenticationManager();
    }

    @Bean
    protected SecurityFilterChain filterChain(HttpSecurity httpSecurity) throws Exception
    {
        return httpSecurity
            .csrf(csrf -> csrf.disable())
            // Keep Spring Security's default response headers. Only allow
            // same-origin framing for compatibility with trusted diagnostics.
            .headers(headers -> headers.frameOptions(options -> options.sameOrigin()))
            .exceptionHandling(exception -> exception
                .authenticationEntryPoint((request, response, failure) -> {
                    if (ApiSecurityProblemHandler.isApiRequest(request))
                        apiProblemHandler.commence(request, response, failure);
                    else
                        unauthorizedHandler.commence(request, response, failure);
                })
                .accessDeniedHandler((request, response, failure) -> {
                    if (ApiSecurityProblemHandler.isApiRequest(request))
                        apiProblemHandler.handle(request, response, failure);
                    else
                        response.sendError(403);
                }))
            // JWTs are re-authenticated on every request. Rotating a servlet session here
            // races concurrent Druid assets and destroys its independent inner login.
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
                .sessionAuthenticationStrategy(new NullAuthenticatedSessionStrategy()))
            .authorizeHttpRequests(requests -> {
                permitAllUrl.getUrls().forEach(url -> requests.requestMatchers(url).permitAll());

                requests.requestMatchers("/login", "/register", "/captchaImage").permitAll()
                    .requestMatchers(HttpMethod.POST, "/api/v1/auth/login").permitAll()
                    // Preserve upstream public uploaded-resource behavior.
                    .requestMatchers(HttpMethod.GET, "/profile/**").permitAll()
                    // OpenAPI/Swagger/Druid are authenticated whenever enabled.
                    .anyRequest().authenticated();
            })
            .logout(logout -> logout.logoutUrl("/logout").logoutSuccessHandler(logoutSuccessHandler))
            .addFilterBefore(authenticationTokenFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(corsFilter, JwtAuthenticationTokenFilter.class)
            .addFilterBefore(corsFilter, LogoutFilter.class)
            .build();
    }

    @Bean
    public BCryptPasswordEncoder bCryptPasswordEncoder()
    {
        return new BCryptPasswordEncoder();
    }
}
