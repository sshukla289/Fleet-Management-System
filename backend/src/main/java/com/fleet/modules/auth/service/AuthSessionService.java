package com.fleet.modules.auth.service;

import com.fleet.modules.auth.entity.AppUser;
import com.fleet.modules.auth.entity.AuthSession;
import com.fleet.modules.auth.repository.AuthSessionRepository;
import com.fleet.modules.auth.repository.AppUserRepository;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthSessionService {

    private final AuthSessionRepository authSessionRepository;
    private final AppUserRepository appUserRepository;
    private final Duration sessionTtl;

    public AuthSessionService(
        AuthSessionRepository authSessionRepository,
        AppUserRepository appUserRepository,
        @Value("${fleet.auth.session-ttl-hours:12}") long sessionTtlHours
    ) {
        this.authSessionRepository = authSessionRepository;
        this.appUserRepository = appUserRepository;
        this.sessionTtl = Duration.ofHours(Math.max(1, sessionTtlHours));
    }

    @Transactional
    public String createSession(AppUser user) {
        LocalDateTime now = LocalDateTime.now();
        authSessionRepository.deleteByExpiresAtBefore(now.minusDays(1));

        AuthSession session = new AuthSession();
        session.setToken("fleet-session-" + UUID.randomUUID());
        session.setUserId(user.getId());
        session.setCreatedAt(now);
        session.setExpiresAt(now.plus(sessionTtl));
        session.setRevokedAt(null);
        return authSessionRepository.save(session).getToken();
    }

    @Transactional(readOnly = true)
    public Optional<AppUser> resolveUser(String token) {
        if (token == null || token.isBlank()) {
            return Optional.empty();
        }

        LocalDateTime now = LocalDateTime.now();
        return authSessionRepository.findByTokenAndRevokedAtIsNull(token.trim())
            .filter(session -> session.getExpiresAt() != null && session.getExpiresAt().isAfter(now))
            .flatMap(session -> appUserRepository.findById(session.getUserId()))
            .filter(AppUser::isActiveAccount);
    }

    @Transactional
    public void revokeSession(String token) {
        if (token == null || token.isBlank()) {
            return;
        }

        authSessionRepository.findByTokenAndRevokedAtIsNull(token.trim()).ifPresent(session -> {
            session.setRevokedAt(LocalDateTime.now());
            authSessionRepository.save(session);
        });
    }

    @Transactional
    public void revokeSessionsForUser(String userId) {
        if (userId == null || userId.isBlank()) {
            return;
        }

        LocalDateTime now = LocalDateTime.now();
        authSessionRepository.findByUserIdAndRevokedAtIsNull(userId.trim())
            .forEach(session -> {
                session.setRevokedAt(now);
                authSessionRepository.save(session);
            });
    }
}
