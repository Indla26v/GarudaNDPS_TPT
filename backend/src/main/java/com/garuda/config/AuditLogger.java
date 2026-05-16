package com.garuda.config;

import com.garuda.entity.AuditLog;
import com.garuda.entity.User;
import com.garuda.entity.enums.AuditAction;
import com.garuda.repository.AuditLogRepository;
import com.garuda.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * Audit logging helper — records user actions on entities.
 * Called from service layer methods.
 */
@Component
@RequiredArgsConstructor
public class AuditLogger {

    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;

    /**
     * Log an auditable action.
     *
     * @param action     e.g., "CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT"
     * @param entityType e.g., "OFFENDER", "CASE", "USER"
     * @param entityId   the ID of the affected entity (nullable)
     * @param ipAddress  the client IP address (nullable)
     * @param userAgent  the client User-Agent header (nullable)
     */
    public void log(String action, String entityType, Long entityId, String ipAddress, String userAgent) {
        User currentUser = getCurrentUser();

        AuditAction auditAction;
        try {
            auditAction = AuditAction.valueOf(action.toUpperCase());
        } catch (IllegalArgumentException e) {
            // Fallback: non-standard actions are logged as CREATE
            auditAction = AuditAction.CREATE;
        }

        AuditLog auditLog = AuditLog.builder()
                .user(currentUser)
                .action(auditAction)
                .entityType(entityType)
                .entityId(entityId)
                .ipAddress(ipAddress)
                .userAgent(userAgent)
                .timestamp(LocalDateTime.now())
                .build();

        auditLogRepository.save(auditLog);
    }

    /**
     * Convenience overload without IP or User-Agent.
     */
    public void log(String action, String entityType, Long entityId) {
        log(action, entityType, entityId, null, null);
    }

    /**
     * Convenience overload with IP but no User-Agent.
     */
    public void log(String action, String entityType, Long entityId, String ipAddress) {
        log(action, entityType, entityId, ipAddress, null);
    }

    private User getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getName() != null && !"anonymousUser".equals(auth.getName())) {
            return userRepository.findByUsername(auth.getName()).orElse(null);
        }
        return null;
    }
}
