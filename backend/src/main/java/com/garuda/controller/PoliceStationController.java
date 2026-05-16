package com.garuda.controller;

import com.garuda.dto.ApiResponse;
import com.garuda.dto.PoliceStationDto;
import com.garuda.service.PoliceStationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/ps")
@RequiredArgsConstructor
public class PoliceStationController {

    private final PoliceStationService psService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<PoliceStationDto>>> getAll() {
        return ResponseEntity.ok(ApiResponse.ok(psService.getAllPoliceStations()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<PoliceStationDto>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(psService.getPoliceStationById(id)));
    }
}
