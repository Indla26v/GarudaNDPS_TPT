package com.garuda.dto.dashboard;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

/**
 * Dashboard summary DTO for the SP landing screen.
 */
@Data
@NoArgsConstructor @AllArgsConstructor @Builder
public class DashboardSummaryDto {

    // ---- Top-Level Metrics ----
    private long totalCases;
    private long totalOffenders;
    private long totalArrests;
    private long totalAbsconders;
    private BigDecimal totalContrabandKg;
    private BigDecimal totalCashSeized;
    private long totalVehiclesSeized;

    // ---- PS-wise Breakdown ----
    private List<PsWiseSummaryDto> psWiseData;
}
