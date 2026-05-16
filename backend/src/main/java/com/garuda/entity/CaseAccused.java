package com.garuda.entity;

import com.garuda.entity.enums.ArrestStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Case accused — links offenders to cases with arrest details.
 * Also carries previous case references (replacing the old criminal_history table).
 */
@Entity
@Table(name = "case_accused",
       uniqueConstraints = @UniqueConstraint(columnNames = {"case_id", "offender_id"}))
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class CaseAccused {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "case_id", nullable = false)
    private CaseEntity caseEntity;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "offender_id", nullable = false)
    private Offender offender;

    @Column(name = "previous_cr_no", length = 50)
    private String previousCrNo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "previous_ps_id")
    private PoliceStation previousPoliceStation;

    @Enumerated(EnumType.STRING)
    @Column(name = "arrest_status", nullable = false, columnDefinition = "arrest_status")
    @Builder.Default
    private ArrestStatus arrestStatus = ArrestStatus.ARRESTED;

    @Column(name = "arrest_date")
    private LocalDate arrestDate;

    @Column(name = "bail_date")
    private LocalDate bailDate;

    @Column(name = "bail_conditions", columnDefinition = "TEXT")
    private String bailConditions;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
