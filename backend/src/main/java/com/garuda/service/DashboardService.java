package com.garuda.service;

import com.garuda.dto.dashboard.DashboardSummaryDto;
import com.garuda.dto.dashboard.PsWiseSummaryDto;
import com.garuda.entity.PoliceStation;
import com.garuda.entity.enums.ArrestStatus;
import com.garuda.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final PoliceStationRepository psRepository;
    private final CaseRepository caseRepository;
    private final OffenderRepository offenderRepository;
    private final CaseAccusedRepository caseAccusedRepository;
    private final SeizureRepository seizureRepository;

    @PreAuthorize("isAuthenticated()")
    public DashboardSummaryDto getSummary() {
        long totalCases = caseRepository.count();
        long totalOffenders = offenderRepository.count();
        long totalArrests = caseAccusedRepository.countByArrestStatus(ArrestStatus.ARRESTED);
        long totalAbsconders = caseAccusedRepository.countByArrestStatus(ArrestStatus.ABSCONDING);
        BigDecimal totalContraband = seizureRepository.sumTotalContrabandKg();
        BigDecimal totalCash = seizureRepository.sumTotalCashAmount();
        long totalVehicles = seizureRepository.sumTotalVehicles();

        List<PoliceStation> allPs = psRepository.findAll();
        List<PsWiseSummaryDto> psWise = allPs.stream().map(ps -> {
            Long psId = ps.getId();
            return PsWiseSummaryDto.builder()
                    .psId(psId)
                    .psName(ps.getName())
                    .psCode(ps.getPsCode())
                    .totalCases(caseRepository.countByPoliceStationId(psId))
                    .totalOffenders(offenderRepository.countByPoliceStationId(psId))
                    .totalArrests(caseAccusedRepository.countByPsIdAndStatus(psId, ArrestStatus.ARRESTED))
                    .totalAbsconders(caseAccusedRepository.countByPsIdAndStatus(psId, ArrestStatus.ABSCONDING))
                    .totalContrabandKg(seizureRepository.sumContrabandByPsId(psId))
                    .totalCashSeized(seizureRepository.sumCashByPsId(psId))
                    .build();
        }).collect(Collectors.toList());

        return DashboardSummaryDto.builder()
                .totalCases(totalCases)
                .totalOffenders(totalOffenders)
                .totalArrests(totalArrests)
                .totalAbsconders(totalAbsconders)
                .totalContrabandKg(totalContraband)
                .totalCashSeized(totalCash)
                .totalVehiclesSeized(totalVehicles)
                .psWiseData(psWise)
                .build();
    }
}
