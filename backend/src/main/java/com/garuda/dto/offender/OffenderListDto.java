package com.garuda.dto.offender;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Lightweight offender DTO for list/search results.
 */
@Data
@NoArgsConstructor @AllArgsConstructor @Builder
public class OffenderListDto {

    private Long id;
    private String slNo;
    private String fullName;
    private String alias;
    private String category;
    private String status;          // ACTIVE, INACTIVE, ABSCONDING, etc.
    private String riskScore;       // LOW, MEDIUM, HIGH, CRITICAL
    private String psName;
    private String district;
    private String mobile;          // Primary mobile from contacts
    private Integer totalCases;
}
