package com.garuda.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Seizure records linked to a case.
 */
@Entity
@Table(name = "seizures")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class Seizure {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "case_id", nullable = false)
    private CaseEntity caseEntity;

    @Column(name = "contraband_kg", precision = 10, scale = 3)
    private BigDecimal contrabandKg;

    @Column(name = "vehicles_count", nullable = false)
    @Builder.Default
    private Integer vehiclesCount = 0;

    @Column(name = "cash_amount", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal cashAmount = BigDecimal.ZERO;

    @Column(name = "parcels_count", nullable = false)
    @Builder.Default
    private Integer parcelsCount = 0;

    @Column(name = "other_items", columnDefinition = "TEXT")
    private String otherItems;

    @Column(name = "seizure_date")
    private LocalDate seizureDate;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
