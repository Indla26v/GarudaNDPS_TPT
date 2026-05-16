package com.garuda.controller;

import com.garuda.dto.ApiResponse;
import com.garuda.dto.auth.LoginRequest;
import com.garuda.dto.auth.RefreshRequest;
import com.garuda.dto.auth.TokenResponse;
import com.garuda.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<TokenResponse>> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest httpRequest) {
        TokenResponse token = authService.login(request, httpRequest.getRemoteAddr());
        return ResponseEntity.ok(ApiResponse.ok(token, "Login successful"));
    }

    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<TokenResponse>> refresh(
            @Valid @RequestBody RefreshRequest request) {
        TokenResponse token = authService.refresh(request);
        return ResponseEntity.ok(ApiResponse.ok(token, "Token refreshed"));
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(
            Authentication authentication,
            HttpServletRequest httpRequest) {
        authService.logout(authentication.getName(), httpRequest.getRemoteAddr());
        return ResponseEntity.ok(ApiResponse.ok(null, "Logged out successfully"));
    }
}
