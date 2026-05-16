package com.garuda.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Identity documents for an offender — Section 5 of the proforma.
 * One row per offender.
 */
@Entity
@Table(name = "offender_identity_docs")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class OffenderIdentityDocs {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "offender_id", nullable = false)
    private Offender offender;

    @Column(name = "aadhaar_no", length = 12)
    private String aadhaarNo;

    @Column(name = "voter_id", length = 30)
    private String voterId;

    @Column(name = "pan_card", length = 10)
    private String panCard;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
