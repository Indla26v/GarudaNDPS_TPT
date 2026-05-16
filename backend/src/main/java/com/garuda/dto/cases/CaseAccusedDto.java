package com.garuda.dto.cases;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

/**
 * DTO for linking an offender to a case as an accused.
 * Now includes previous case references (replacing criminal_history).
 */
@Data
@NoArgsConstructor @AllArgsConstructor @Builder
public class CaseAccusedDto {

    private Long id;

    @NotNull(message = "Offender ID is required")
    private Long offenderId;

    private String offenderName;
    private String previousCrNo;
    private Long previousPsId;
    private String arrestStatus;
    private LocalDate arrestDate;
    private LocalDate bailDate;
    private String bailConditions;
}
