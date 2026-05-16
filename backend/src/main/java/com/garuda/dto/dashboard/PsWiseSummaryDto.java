package com.garuda.dto.dashboard;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * Per-police-station summary row for the dashboard table.
 */
@Data
@NoArgsConstructor @AllArgsConstructor @Builder
public class PsWiseSummaryDto {

    private Long psId;
    private String psName;
    private String psCode;
    private long totalCases;
    private long totalOffenders;
    private long totalArrests;
    private long totalAbsconders;
    private BigDecimal totalContrabandKg;
    private BigDecimal totalCashSeized;
}
