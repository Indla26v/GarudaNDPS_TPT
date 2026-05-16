package com.garuda.entity;

import com.garuda.entity.enums.*;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Offender drug profile — Section 7 of the proforma.
 * One profile per offender (unique constraint on offender_id).
 */
@Entity
@Table(name = "offender_drug_profile")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class OffenderDrugProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "offender_id", nullable = false, unique = true)
    private Offender offender;

    @Enumerated(EnumType.STRING)
    @Column(name = "addiction_type", columnDefinition = "addiction_type")
    private AddictionType addictionType;

    @Enumerated(EnumType.STRING)
    @Column(name = "consumption_frequency", columnDefinition = "consumption_frequency")
    private ConsumptionFrequency consumptionFrequency;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_of_procurement", columnDefinition = "source_of_procurement")
    private SourceOfProcurement sourceOfProcurement;

    @Enumerated(EnumType.STRING)
    @Column(name = "mode_of_purchase", columnDefinition = "purchase_mode")
    private PurchaseMode modeOfPurchase;

    @Column(name = "usual_consumption_spot", length = 200)
    private String usualConsumptionSpot;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
