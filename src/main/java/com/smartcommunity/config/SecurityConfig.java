package com.smartcommunity.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Spring Security Configuration.
 * Enforces BCrypt password hashing and strict role-based endpoint authorization
 * for Administrator, Resident, and Maintenance Worker roles.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(10);
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/", "/index.html", "/css/**", "/js/**", "/images/**", "/api/auth/**").permitAll()
                .requestMatchers("/api/admin/**", "/api/flats/**", "/api/workers/**", "/api/reports/**").hasRole("ADMIN")
                .requestMatchers("/api/complaints/*/assign").hasRole("ADMIN")
                .requestMatchers("/api/complaints/*/worker-*").hasRole("WORKER")
                .requestMatchers("/api/payments/*/resident-pay").hasRole("RESIDENT")
                .anyRequest().authenticated()
            );
        return http.build();
    }
}
