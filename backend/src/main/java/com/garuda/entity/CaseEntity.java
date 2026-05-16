package com.garuda.entity;

import com.garuda.entity.enums.CaseStage;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Cases — Section 10 + Case Management module.
 */
@Entity
@Table(name = "cases")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class CaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "fir_no", nullable = false, length = 50)
    private String firNo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ps_id", nullable = false)
    private PoliceStation policeStation;

    @Column(name = "case_date")
    private LocalDate caseDate;

    @Column(name = "section_of_law", length = 300)
    private String sectionOfLaw;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "case_stage")
    @Builder.Default
    private CaseStage stage = CaseStage.FIR;

    @Column(name = "is_history_sheet", nullable = false)
    @Builder.Default
    private Boolean isHistorySheet = false;

    @Column(name = "is_rowdy_sheet", nullable = false)
    @Builder.Default
    private Boolean isRowdySheet = false;

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

    @OneToMany(mappedBy = "caseEntity", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<CaseAccused> accusedList = new ArrayList<>();

    @OneToMany(mappedBy = "caseEntity", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<Seizure> seizures = new ArrayList<>();
}
