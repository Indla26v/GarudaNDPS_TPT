package com.garuda.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO for offender contacts (Section 3 of proforma).
 */
@Data
@NoArgsConstructor @AllArgsConstructor @Builder
public class ContactDto {

    private Long id;
    private String contactType;   // MOBILE_PRIMARY, GMAIL, WHATSAPP, etc.
    private String value;
    private String notes;
}
