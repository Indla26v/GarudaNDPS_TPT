package com.garuda.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO for offender identity documents (Section 5 of proforma).
 */
@Data
@NoArgsConstructor @AllArgsConstructor @Builder
public class IdentityDocsDto {

    private Long id;
    private String aadhaarNo;
    private String voterId;
    private String panCard;
}
