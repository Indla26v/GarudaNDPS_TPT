package com.garuda.dto.cases;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Full case response DTO with accused and seizure details.
 */
@Data
@NoArgsConstructor @AllArgsConstructor @Builder
public class CaseResponse {

    private Long id;
    private String firNo;

    // ---- Police Station ----
    private Long psId;
    private String psName;

    private String sectionOfLaw;
    private LocalDate caseDate;
    private String stage;
    private Boolean isHistorySheet;
    private Boolean isRowdySheet;

    private String createdByName;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // ---- Nested ----
    private List<CaseAccusedDto> accused;
    private List<SeizureDto> seizures;
}
