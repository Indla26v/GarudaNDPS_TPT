package com.garuda.service;

import com.garuda.dto.PoliceStationDto;
import com.garuda.entity.PoliceStation;
import com.garuda.repository.PoliceStationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PoliceStationService {

    private final PoliceStationRepository psRepository;

    @PreAuthorize("isAuthenticated()")
    public List<PoliceStationDto> getAllPoliceStations() {
        return psRepository.findAll().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @PreAuthorize("isAuthenticated()")
    public PoliceStationDto getPoliceStationById(Long id) {
        PoliceStation ps = psRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Police station not found: " + id));
        return toDto(ps);
    }

    private PoliceStationDto toDto(PoliceStation ps) {
        return PoliceStationDto.builder()
                .id(ps.getId())
                .name(ps.getName())
                .district(ps.getDistrict())
                .state(ps.getState())
                .psCode(ps.getPsCode())
                .build();
    }
}
