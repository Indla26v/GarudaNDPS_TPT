package com.garuda.dto.offender;

import com.garuda.dto.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

/**
 * Request DTO for creating/updating an offender profile.
 * Matches the revised proforma with all sections represented.
 */
@Data
@NoArgsConstructor @AllArgsConstructor @Builder
public class OffenderRequest {

    // ---- Section 1 + 2: Basic Identity ----
    private String slNo;

    @NotNull(message = "Police station ID is required")
    private Long psId;

    @NotBlank(message = "Full name is required")
    private String fullName;

    private String alias;
    private String fatherHusbandName;
    private Integer age;
    private String gender;          // MALE, FEMALE, OTHER
    private String category;        // CONSUMER, LOCAL_PEDDLER, LOCAL_SUPPLIER, etc.
    private String testResult;      // POSITIVE, NEGATIVE, PENDING

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
    private String status;          // ACTIVE, INACTIVE, ABSCONDING, ARRESTED, BAILED
    private String riskScore;       // LOW, MEDIUM, HIGH, CRITICAL

    // ---- Section 5: Identity Documents (embedded) ----
    private IdentityDocsDto identityDocs;

    // ---- Section 3: Contacts (embedded list) ----
    private List<ContactDto> contacts;

    // ---- Section 4: Financials (embedded list) ----
    private List<FinancialDto> financials;

    // ---- Section 7: Drug Profile (embedded) ----
    private DrugProfileDto drugProfile;

    // ---- Section 8: Supply Chain Links (embedded list) ----
    private List<SupplyChainLinkDto> supplyChainLinks;
}
