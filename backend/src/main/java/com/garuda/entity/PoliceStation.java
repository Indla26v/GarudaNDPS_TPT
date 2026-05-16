package com.garuda.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "police_stations")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class PoliceStation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(nullable = false, length = 100)
    private String district;

    @Column(nullable = false, length = 100)
    private String state;

    @Column(name = "ps_code", nullable = false, unique = true, length = 20)
    private String psCode;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    // ---- Relationships ----

    @OneToMany(mappedBy = "policeStation", fetch = FetchType.LAZY)
    @Builder.Default
    private List<User> users = new ArrayList<>();

    @OneToMany(mappedBy = "policeStation", fetch = FetchType.LAZY)
    @Builder.Default
    private List<Offender> offenders = new ArrayList<>();

    @OneToMany(mappedBy = "policeStation", fetch = FetchType.LAZY)
    @Builder.Default
    private List<CaseEntity> cases = new ArrayList<>();
}
