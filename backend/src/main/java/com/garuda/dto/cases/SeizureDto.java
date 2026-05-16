package com.garuda.dto.cases;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * DTO for seizure data attached to a case.
 */
@Data
@NoArgsConstructor @AllArgsConstructor @Builder
public class SeizureDto {

    private Long id;
    private BigDecimal contrabandKg;
    private Integer vehiclesCount;
    private BigDecimal cashAmount;
    private Integer parcelsCount;
    private String otherItems;
    private LocalDate seizureDate;
}
