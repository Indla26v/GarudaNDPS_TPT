package com.garuda.service;

import com.garuda.config.AuditLogger;
import com.garuda.dto.auth.LoginRequest;
import com.garuda.dto.auth.RefreshRequest;
import com.garuda.dto.auth.TokenResponse;
import com.garuda.entity.RefreshToken;
import com.garuda.entity.User;
import com.garuda.repository.RefreshTokenRepository;
import com.garuda.repository.UserRepository;
import com.garuda.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final AuditLogger auditLogger;

    /**
     * Authenticate user and return access + refresh tokens.
     */
    @Transactional
    public TokenResponse login(LoginRequest request, String ipAddress) {
        // Authenticate credentials via Spring Security
        Authentication auth = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.getUsername(), request.getPassword()
                )
        );

        UserDetails userDetails = (UserDetails) auth.getPrincipal();
        User user = userRepository.findByUsername(userDetails.getUsername())
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));

        // Update last login
        user.setLastLogin(LocalDateTime.now());
        userRepository.save(user);

        // Generate tokens
        String accessToken = jwtUtil.generateAccessToken(userDetails);
        String refreshToken = jwtUtil.generateRefreshToken(userDetails);

        // Store refresh token in DB for revocation
        RefreshToken rt = RefreshToken.builder()
                .user(user)
                .token(refreshToken)
                .expiryDate(LocalDateTime.now().plusSeconds(jwtUtil.getRefreshTokenExpiryMs() / 1000))
                .revoked(false)
                .build();
        refreshTokenRepository.save(rt);

        // Audit
        auditLogger.log("LOGIN", "USER", user.getId(), ipAddress);

        return TokenResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .expiresIn(jwtUtil.getAccessTokenExpiryMs() / 1000)
                .username(user.getUsername())
                .fullName(user.getFullName())
                .role(user.getRole().name())
                .build();
    }

    /**
     * Refresh an access token using a valid refresh token.
     */
    @Transactional
    public TokenResponse refresh(RefreshRequest request) {
        String token = request.getRefreshToken();

        RefreshToken stored = refreshTokenRepository.findByToken(token)
                .orElseThrow(() -> new IllegalArgumentException("Invalid refresh token"));

        if (!stored.isUsable()) {
            throw new IllegalArgumentException("Refresh token expired or revoked");
        }

        User user = stored.getUser();
        UserDetails userDetails = org.springframework.security.core.userdetails.User.builder()
                .username(user.getUsername())
                .password(user.getPasswordHash())
                .authorities("ROLE_" + user.getRole().name())
                .build();

        // Generate new access token (keep same refresh token)
        String newAccessToken = jwtUtil.generateAccessToken(userDetails);

        return TokenResponse.builder()
                .accessToken(newAccessToken)
                .refreshToken(token)
                .expiresIn(jwtUtil.getAccessTokenExpiryMs() / 1000)
                .username(user.getUsername())
                .fullName(user.getFullName())
                .role(user.getRole().name())
                .build();
    }

    /**
     * Logout — revoke all refresh tokens for the user.
     */
    @Transactional
    public void logout(String username, String ipAddress) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));
        refreshTokenRepository.revokeAllByUserId(user.getId());
        auditLogger.log("LOGOUT", "USER", user.getId(), ipAddress);
    }
}
