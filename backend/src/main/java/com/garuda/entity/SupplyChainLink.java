package com.garuda.entity;

import com.garuda.entity.enums.SupplyLinkType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Supply chain links — Section 8 of the proforma.
 * Maps the intelligence network: consumer → peddler → supplier → kingpin.
 */
@Entity
@Table(name = "supply_chain_links")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class SupplyChainLink {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "offender_id", nullable = false)
    private Offender offender;

    @Enumerated(EnumType.STRING)
    @Column(name = "link_type", nullable = false, columnDefinition = "supply_link_type")
    private SupplyLinkType linkType;

    @Column(name = "linked_person_name", length = 200)
    private String linkedPersonName;

    @Column(name = "linked_person_contact", length = 100)
    private String linkedPersonContact;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "linked_offender_id")
    private Offender linkedOffender;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
