package com.garuda.controller;

import com.garuda.dto.ApiResponse;
import com.garuda.dto.cases.*;
import com.garuda.service.CaseService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/cases")
@RequiredArgsConstructor
public class CaseController {

    private final CaseService caseService;

    @PostMapping
    public ResponseEntity<ApiResponse<CaseResponse>> create(
            @Valid @RequestBody CaseRequest request) {
        CaseResponse response = caseService.createCase(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(response, "Case created"));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<Page<CaseResponse>>> getAll(
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(ApiResponse.ok(caseService.getCases(pageable)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<CaseResponse>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(caseService.getCaseById(id)));
    }

    @PutMapping("/{id}/accused")
    public ResponseEntity<ApiResponse<CaseResponse>> updateAccused(
            @PathVariable Long id,
            @Valid @RequestBody List<CaseAccusedDto> accused) {
        return ResponseEntity.ok(ApiResponse.ok(
                caseService.updateAccused(id, accused), "Accused list updated"));
    }

    @PutMapping("/{id}/seizure")
    public ResponseEntity<ApiResponse<CaseResponse>> updateSeizure(
            @PathVariable Long id,
            @Valid @RequestBody SeizureDto seizure) {
        return ResponseEntity.ok(ApiResponse.ok(
                caseService.updateSeizure(id, seizure), "Seizure updated"));
    }
}
