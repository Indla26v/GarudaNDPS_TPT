package com.garuda.entity;

import com.garuda.entity.enums.*;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Offender core identity — Sections 1 + 2 of the proforma.
 * Drug profile, identity docs, contacts, and financials are in separate tables.
 */
@Entity
@Table(name = "offenders")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class Offender {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "sl_no", length = 50)
    private String slNo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ps_id", nullable = false)
    private PoliceStation policeStation;

    @Column(name = "full_name", nullable = false, length = 200)
    private String fullName;

    @Column(length = 200)
    private String alias;

    @Column(name = "father_husband_name", length = 200)
    private String fatherHusbandName;

    private Integer age;

    @Enumerated(EnumType.STRING)
    @Column(columnDefinition = "gender_type")
    private GenderType gender;

    @Enumerated(EnumType.STRING)
    @Column(columnDefinition = "offender_category")
    private OffenderCategory category;

    @Enumerated(EnumType.STRING)
    @Column(name = "test_result", columnDefinition = "test_result")
    private TestResult testResult;

    // ---- Address ----

    @Column(name = "full_address", columnDefinition = "TEXT")
    private String fullAddress;

    @Column(name = "landmark_area", length = 200)
    private String landmarkArea;

    @Column(length = 100)
    private String district;

    @Column(length = 100)
    private String state;

    // ---- Occupation & Income ----

    @Column(length = 100)
    private String occupation;

    @Column(name = "monthly_income", precision = 12, scale = 2)
    private BigDecimal monthlyIncome;

    // ---- Photo ----

    @Column(name = "photo_url", length = 500)
    private String photoUrl;

    // ---- Status & Risk ----

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "offender_status")
    @Builder.Default
    private OffenderStatus status = OffenderStatus.ACTIVE;

    @Enumerated(EnumType.STRING)
    @Column(name = "risk_score", columnDefinition = "risk_score")
    private RiskScore riskScore;

    // ---- Metadata ----

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    // ---- Relationships ----

    @OneToOne(mappedBy = "offender", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    private OffenderIdentityDocs identityDocs;

    @OneToMany(mappedBy = "offender", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<OffenderContact> contacts = new ArrayList<>();

    @OneToMany(mappedBy = "offender", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<OffenderFinancial> financials = new ArrayList<>();

    @OneToOne(mappedBy = "offender", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    private OffenderDrugProfile drugProfile;

    @OneToMany(mappedBy = "offender", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<SupplyChainLink> supplyChainLinks = new ArrayList<>();

    @OneToMany(mappedBy = "offender", fetch = FetchType.LAZY)
    @Builder.Default
    private List<CaseAccused> caseAccusedList = new ArrayList<>();

    @OneToMany(mappedBy = "offender", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<SurveillanceRecord> surveillanceRecords = new ArrayList<>();
}
