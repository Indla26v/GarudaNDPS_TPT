package com.garuda.entity;

import com.garuda.entity.enums.SourceType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Intelligence inputs — from the DPR Intelligence Module.
 * Stores source intelligence about offenders and supply routes.
 */
@Entity
@Table(name = "intelligence_inputs")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class IntelligenceInput {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "offender_id")
    private Offender offender;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ps_id", nullable = false)
    private PoliceStation policeStation;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", nullable = false, columnDefinition = "source_type")
    private SourceType sourceType;

    @Column(name = "input_text", columnDefinition = "TEXT")
    private String inputText;

    @Column(name = "supply_route", columnDefinition = "TEXT")
    private String supplyRoute;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
