package com.garuda.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO for supply chain links (Section 8 of proforma).
 */
@Data
@NoArgsConstructor @AllArgsConstructor @Builder
public class SupplyChainLinkDto {

    private Long id;
    private String linkType;              // CO_CONSUMER, PEDDLER, SUPPLIER, TRANSPORTER, KINGPIN
    private String linkedPersonName;
    private String linkedPersonContact;
    private Long linkedOffenderId;        // nullable — only if linked person is in the system
    private String notes;
}
