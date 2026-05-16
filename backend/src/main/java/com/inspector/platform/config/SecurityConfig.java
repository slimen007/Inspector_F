package com.inspector.platform.config;

import com.inspector.platform.security.JwtAuthenticationFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthFilter;
    private final UserDetailsService userDetailsService;

    @Value("${app.cors.allowed-origins}")
    private String allowedOrigins;

    @Value("${app.cors.allowed-origin-patterns:}")
    private String allowedOriginPatterns;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/register").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/forgot-password").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/reset-password").permitAll()

                        .requestMatchers(HttpMethod.GET, "/api/inspector/profile/ranks").hasAnyRole("INSPECTOR", "ADMIN", "TEACHER")
                        .requestMatchers(HttpMethod.GET, "/api/inspector/profile/subjects").hasAnyRole("INSPECTOR", "ADMIN", "TEACHER")
                        .requestMatchers(HttpMethod.GET, "/api/inspector/profile/school-levels").hasAnyRole("INSPECTOR", "ADMIN", "TEACHER")
                        .requestMatchers(HttpMethod.GET, "/api/inspector/profile/delegations").hasAnyRole("INSPECTOR", "ADMIN", "TEACHER")
                        .requestMatchers(HttpMethod.GET, "/api/inspector/profile/dependencies").hasAnyRole("INSPECTOR", "ADMIN", "TEACHER")
                        .requestMatchers(HttpMethod.GET, "/api/inspector/profile/departments").hasAnyRole("INSPECTOR", "ADMIN", "TEACHER")
                        .requestMatchers(HttpMethod.GET, "/api/inspector/profile/etablissements").hasAnyRole("INSPECTOR", "ADMIN", "TEACHER")

                        .requestMatchers("/api/admin/**").hasRole("ADMIN")

                        .requestMatchers("/api/inspector/profile").hasRole("INSPECTOR")
                        .requestMatchers("/api/inspector/activities/**").hasRole("INSPECTOR")
                        .requestMatchers("/api/inspector/reports/**").hasRole("INSPECTOR")
                        .requestMatchers("/api/inspector/analytics/**").hasRole("INSPECTOR")
                        .requestMatchers("/api/inspector/courses/**").hasRole("INSPECTOR")
                        .requestMatchers("/api/teacher/profile").hasRole("TEACHER")
                        .requestMatchers("/api/teacher/activities/**").hasRole("TEACHER")
                        .requestMatchers("/api/teacher/courses/**").hasRole("TEACHER")
                        .requestMatchers("/api/dashboard/inspector").hasRole("INSPECTOR")
                        .requestMatchers("/api/dashboard/teacher").hasRole("TEACHER")
                        .requestMatchers("/api/dashboard/responsible").hasRole("PEDAGOGICAL_RESPONSIBLE")
                        .requestMatchers("/api/dashboard/admin").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/healthz").permitAll()
                        .requestMatchers(HttpMethod.GET, "/actuator/health").permitAll()
                        .requestMatchers("/actuator/**").hasRole("ADMIN")

                        .requestMatchers("/uploads/**").permitAll()
                        .requestMatchers("/api/messages/files/**").permitAll()
                        .requestMatchers("/ws/**").permitAll()
                        .anyRequest().authenticated())
                .authenticationProvider(authenticationProvider())
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public CorsFilter corsFilter() {
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        CorsConfiguration config = new CorsConfiguration();
        
        List<String> origins = Arrays.stream(allowedOrigins.split(","))
                                     .map(String::trim)
                                     .filter(s -> !s.isEmpty())
                                     .toList();

        List<String> originPatterns = Arrays.stream(allowedOriginPatterns.split(","))
                                            .map(String::trim)
                                            .filter(s -> !s.isEmpty())
                                            .toList();
        
        config.setAllowedOrigins(origins);
        if (!originPatterns.isEmpty()) {
            config.setAllowedOriginPatterns(originPatterns);
        }
        config.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        config.setAllowedHeaders(Arrays.asList("*"));
        config.setExposedHeaders(Arrays.asList("Authorization", "Content-Type"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);
        
        source.registerCorsConfiguration("/**", config);
        System.out.println("Consolidated CORS Filter Origins: " + origins);
        System.out.println("Consolidated CORS Filter Origin Patterns: " + originPatterns);
        return new CorsFilter(source);
    }
}
