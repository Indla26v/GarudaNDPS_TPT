package com.garuda.entity;

import com.garuda.entity.enums.VerificationStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Surveillance records — from the DPR Surveillance Module.
 * Tracks scheduled verifications of offenders.
 */
@Entity
@Table(name = "surveillance_records")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class SurveillanceRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "offender_id", nullable = false)
    private Offender offender;

    @Column(name = "scheduled_date")
    private LocalDate scheduledDate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "verified_by")
    private User verifiedBy;

    @Enumerated(EnumType.STRING)
    @Column(name = "verification_status", nullable = false, columnDefinition = "verification_status")
    @Builder.Default
    private VerificationStatus verificationStatus = VerificationStatus.PENDING;

    @Column(name = "current_address", columnDefinition = "TEXT")
    private String currentAddress;

    @Column(name = "current_occupation", length = 200)
    private String currentOccupation;

    @Column(name = "associates_noted", columnDefinition = "TEXT")
    private String associatesNoted;

    @Column(name = "geo_lat", precision = 10, scale = 7)
    private BigDecimal geoLat;

    @Column(name = "geo_lng", precision = 10, scale = 7)
    private BigDecimal geoLng;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
