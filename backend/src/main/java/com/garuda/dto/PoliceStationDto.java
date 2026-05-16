package com.garuda.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor @AllArgsConstructor @Builder
public class PoliceStationDto {

    private Long id;
    private String name;
    private String district;
    private String state;
    private String psCode;
}
