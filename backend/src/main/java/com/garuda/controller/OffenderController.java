package com.garuda.controller;

import com.garuda.dto.ApiResponse;
import com.garuda.dto.cases.CaseResponse;
import com.garuda.dto.offender.OffenderListDto;
import com.garuda.dto.offender.OffenderRequest;
import com.garuda.dto.offender.OffenderResponse;
import com.garuda.service.CaseService;
import com.garuda.service.OffenderService;
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
@RequestMapping("/api/offenders")
@RequiredArgsConstructor
public class OffenderController {

    private final OffenderService offenderService;
    private final CaseService caseService;

    @PostMapping
    public ResponseEntity<ApiResponse<OffenderResponse>> create(
            @Valid @RequestBody OffenderRequest request) {
        OffenderResponse response = offenderService.createOffender(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(response, "Offender created"));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<Page<OffenderListDto>>> getAll(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Long psId,
            @PageableDefault(size = 20) Pageable pageable) {
        Page<OffenderListDto> page = offenderService.getOffenders(q, psId, pageable);
        return ResponseEntity.ok(ApiResponse.ok(page));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<OffenderResponse>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(offenderService.getOffenderById(id)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<OffenderResponse>> update(
            @PathVariable Long id,
            @Valid @RequestBody OffenderRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(offenderService.updateOffender(id, request), "Offender updated"));
    }

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<Page<OffenderListDto>>> search(
            @RequestParam String q,
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(ApiResponse.ok(offenderService.searchOffenders(q, pageable)));
    }

    @GetMapping("/{id}/cases")
    public ResponseEntity<ApiResponse<List<CaseResponse>>> getOffenderCases(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(caseService.getCasesByOffenderId(id)));
    }
}
