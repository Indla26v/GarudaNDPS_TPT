package com.garuda.service;

import com.garuda.config.AuditLogger;
import com.garuda.dto.cases.*;
import com.garuda.entity.*;
import com.garuda.entity.enums.ArrestStatus;
import com.garuda.entity.enums.CaseStage;
import com.garuda.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CaseService {

    private final CaseRepository caseRepository;
    private final PoliceStationRepository psRepository;
    private final UserRepository userRepository;
    private final OffenderRepository offenderRepository;
    private final CaseAccusedRepository caseAccusedRepository;
    private final SeizureRepository seizureRepository;
    private final AuditLogger auditLogger;

    @PreAuthorize("hasAnyRole('ADMIN','SP','DSP','SHO','FIELD_OFFICER','DATA_ENTRY')")
    @Transactional
    public CaseResponse createCase(CaseRequest req) {
        PoliceStation ps = psRepository.findById(req.getPsId())
                .orElseThrow(() -> new IllegalArgumentException("Police station not found"));
        User currentUser = getCurrentUser();

        CaseEntity c = CaseEntity.builder()
                .firNo(req.getFirNo()).policeStation(ps)
                .sectionOfLaw(req.getSectionOfLaw()).caseDate(req.getCaseDate())
                .stage(req.getStage() != null ? CaseStage.valueOf(req.getStage().toUpperCase()) : CaseStage.FIR)
                .isHistorySheet(req.getIsHistorySheet() != null ? req.getIsHistorySheet() : false)
                .isRowdySheet(req.getIsRowdySheet() != null ? req.getIsRowdySheet() : false)
                .createdBy(currentUser).build();
        c = caseRepository.save(c);
        auditLogger.log("CREATE", "CASE", c.getId());
        return toResponse(c);
    }

    @PreAuthorize("isAuthenticated()")
    public Page<CaseResponse> getCases(Pageable pageable) {
        return caseRepository.findAll(pageable).map(this::toResponse);
    }

    @PreAuthorize("isAuthenticated()")
    public CaseResponse getCaseById(Long id) {
        CaseEntity c = caseRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Case not found: " + id));
        return toResponse(c);
    }

    @PreAuthorize("isAuthenticated()")
    public List<CaseResponse> getCasesByOffenderId(Long offenderId) {
        return caseRepository.findCasesByOffenderId(offenderId).stream()
                .map(this::toResponse).collect(Collectors.toList());
    }

    @PreAuthorize("hasAnyRole('ADMIN','SP','DSP','SHO','FIELD_OFFICER','DATA_ENTRY')")
    @Transactional
    public CaseResponse updateAccused(Long caseId, List<CaseAccusedDto> accusedList) {
        CaseEntity c = caseRepository.findById(caseId)
                .orElseThrow(() -> new IllegalArgumentException("Case not found: " + caseId));

        // Clear existing accused
        caseAccusedRepository.deleteAll(caseAccusedRepository.findByCaseEntityId(caseId));

        for (CaseAccusedDto dto : accusedList) {
            Offender offender = offenderRepository.findById(dto.getOffenderId())
                    .orElseThrow(() -> new IllegalArgumentException("Offender not found: " + dto.getOffenderId()));

            PoliceStation previousPs = dto.getPreviousPsId() != null
                    ? psRepository.findById(dto.getPreviousPsId()).orElse(null) : null;

            CaseAccused ca = CaseAccused.builder()
                    .caseEntity(c).offender(offender)
                    .previousCrNo(dto.getPreviousCrNo())
                    .previousPoliceStation(previousPs)
                    .arrestStatus(dto.getArrestStatus() != null
                            ? ArrestStatus.valueOf(dto.getArrestStatus().toUpperCase()) : ArrestStatus.ARRESTED)
                    .arrestDate(dto.getArrestDate()).bailDate(dto.getBailDate())
                    .bailConditions(dto.getBailConditions())
                    .build();
            caseAccusedRepository.save(ca);
        }
        auditLogger.log("UPDATE_ACCUSED", "CASE", caseId);
        return toResponse(c);
    }

    @PreAuthorize("hasAnyRole('ADMIN','SP','DSP','SHO','FIELD_OFFICER','DATA_ENTRY')")
    @Transactional
    public CaseResponse updateSeizure(Long caseId, SeizureDto dto) {
        CaseEntity c = caseRepository.findById(caseId)
                .orElseThrow(() -> new IllegalArgumentException("Case not found: " + caseId));

        // Replace existing seizures
        seizureRepository.deleteAll(seizureRepository.findByCaseEntityId(caseId));
        Seizure s = Seizure.builder()
                .caseEntity(c).contrabandKg(dto.getContrabandKg())
                .vehiclesCount(dto.getVehiclesCount() != null ? dto.getVehiclesCount() : 0)
                .cashAmount(dto.getCashAmount() != null ? dto.getCashAmount() : java.math.BigDecimal.ZERO)
                .parcelsCount(dto.getParcelsCount() != null ? dto.getParcelsCount() : 0)
                .otherItems(dto.getOtherItems()).seizureDate(dto.getSeizureDate())
                .build();
        seizureRepository.save(s);
        auditLogger.log("UPDATE_SEIZURE", "CASE", caseId);
        return toResponse(c);
    }

    private CaseResponse toResponse(CaseEntity c) {
        List<CaseAccusedDto> accused = caseAccusedRepository.findByCaseEntityId(c.getId()).stream()
                .map(ca -> CaseAccusedDto.builder()
                        .id(ca.getId()).offenderId(ca.getOffender().getId())
                        .offenderName(ca.getOffender().getFullName())
                        .previousCrNo(ca.getPreviousCrNo())
                        .previousPsId(ca.getPreviousPoliceStation() != null
                                ? ca.getPreviousPoliceStation().getId() : null)
                        .arrestStatus(ca.getArrestStatus().name())
                        .arrestDate(ca.getArrestDate()).bailDate(ca.getBailDate())
                        .bailConditions(ca.getBailConditions()).build())
                .collect(Collectors.toList());

        List<SeizureDto> seizures = seizureRepository.findByCaseEntityId(c.getId()).stream()
                .map(s -> SeizureDto.builder()
                        .id(s.getId()).contrabandKg(s.getContrabandKg())
                        .vehiclesCount(s.getVehiclesCount()).cashAmount(s.getCashAmount())
                        .parcelsCount(s.getParcelsCount()).otherItems(s.getOtherItems())
                        .seizureDate(s.getSeizureDate()).build())
                .collect(Collectors.toList());

        return CaseResponse.builder()
                .id(c.getId()).firNo(c.getFirNo())
                .psId(c.getPoliceStation().getId()).psName(c.getPoliceStation().getName())
                .sectionOfLaw(c.getSectionOfLaw()).caseDate(c.getCaseDate())
                .stage(c.getStage().name())
                .isHistorySheet(c.getIsHistorySheet())
                .isRowdySheet(c.getIsRowdySheet())
                .createdByName(c.getCreatedBy() != null ? c.getCreatedBy().getFullName() : null)
                .createdAt(c.getCreatedAt()).updatedAt(c.getUpdatedAt())
                .accused(accused).seizures(seizures)
                .build();
    }

    private User getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null) return userRepository.findByUsername(auth.getName()).orElse(null);
        return null;
    }
}
