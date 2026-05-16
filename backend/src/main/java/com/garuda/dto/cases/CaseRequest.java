package com.garuda.dto.cases;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

/**
 * Request DTO for creating/updating a case.
 */
@Data
@NoArgsConstructor @AllArgsConstructor @Builder
public class CaseRequest {

    @NotBlank(message = "FIR number is required")
    private String firNo;

    @NotNull(message = "Police station ID is required")
    private Long psId;

    private String sectionOfLaw;
    private LocalDate caseDate;
    private String stage;
    private Boolean isHistorySheet;
    private Boolean isRowdySheet;
}
