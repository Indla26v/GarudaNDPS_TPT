package com.garuda.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO for offender financial instruments (Section 4 of proforma).
 */
@Data
@NoArgsConstructor @AllArgsConstructor @Builder
public class FinancialDto {

    private Long id;
    private String finType;       // UPI_ID, BANK_ACCOUNT_NO, etc.
    private String value;
    private String bankName;
    private String notes;
}
