package com.garuda.dto.offender;

import com.garuda.dto.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Full offender response DTO with all nested data.
 */
@Data
@NoArgsConstructor @AllArgsConstructor @Builder
public class OffenderResponse {

    private Long id;
    private String slNo;

    // ---- Police Station ----
    private Long psId;
    private String psName;

    // ---- Basic Identity ----
    private String fullName;
    private String alias;
    private String fatherHusbandName;
    private Integer age;
    private String gender;
    private String category;
    private String testResult;

    // ---- Address ----
    private String fullAddress;
    private String landmarkArea;
    private String district;
    private String state;

    // ---- Occupation & Income ----
    private String occupation;
    private BigDecimal monthlyIncome;

    // ---- Photo ----
    private String photoUrl;

    // ---- Status & Risk ----
    private String status;
    private String riskScore;

    // ---- Metadata ----
    private String createdByName;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // ---- Nested Collections ----
    private IdentityDocsDto identityDocs;
    private List<ContactDto> contacts;
    private List<FinancialDto> financials;
    private DrugProfileDto drugProfile;
    private List<SupplyChainLinkDto> supplyChainLinks;

    // ---- Stats ----
    private Integer totalCases;
}
