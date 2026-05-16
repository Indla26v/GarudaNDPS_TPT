package com.garuda.entity;

import com.garuda.entity.enums.ContactType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Offender contacts — Section 3 of the proforma.
 * One row per contact (mobiles, email, social media).
 */
@Entity
@Table(name = "offender_contacts")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class OffenderContact {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "offender_id", nullable = false)
    private Offender offender;

    @Enumerated(EnumType.STRING)
    @Column(name = "contact_type", nullable = false, columnDefinition = "contact_type")
    private ContactType contactType;

    @Column(nullable = false, length = 300)
    private String value;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
