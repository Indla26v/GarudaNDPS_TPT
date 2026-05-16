package com.garuda.entity;

import com.garuda.entity.enums.FinType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Offender financial instruments — Section 4 of the proforma.
 * One row per financial instrument (UPI, bank account, etc.).
 */
@Entity
@Table(name = "offender_financials")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class OffenderFinancial {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "offender_id", nullable = false)
    private Offender offender;

    @Enumerated(EnumType.STRING)
    @Column(name = "fin_type", nullable = false, columnDefinition = "fin_type")
    private FinType finType;

    @Column(nullable = false, length = 300)
    private String value;

    @Column(name = "bank_name", length = 200)
    private String bankName;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
