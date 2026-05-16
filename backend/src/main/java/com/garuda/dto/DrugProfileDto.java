package com.garuda.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO for offender drug profile (Section 7 of proforma).
 */
@Data
@NoArgsConstructor @AllArgsConstructor @Builder
public class DrugProfileDto {

    private Long id;
    private String addictionType;            // GANJA_ONLY, GANJA_ALCOHOL, etc.
    private String consumptionFrequency;     // DAILY, WEEKLY, OCCASIONAL
    private String sourceOfProcurement;      // LOCAL, OUTSIDE_DISTRICT, ONLINE, COURIER
    private String modeOfPurchase;           // CASH, UPI, CREDIT, BARTER, MIXED
    private String usualConsumptionSpot;
}
