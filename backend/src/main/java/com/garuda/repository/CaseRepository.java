package com.garuda.repository;

import com.garuda.entity.CaseEntity;
import com.garuda.entity.enums.CaseStage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CaseRepository extends JpaRepository<CaseEntity, Long> {

    Page<CaseEntity> findByPoliceStationId(Long psId, Pageable pageable);

    List<CaseEntity> findByStage(CaseStage stage);

    long countByPoliceStationId(Long psId);

    /**
     * Find all cases that an offender is accused in.
     */
    @Query("""
        SELECT c FROM CaseEntity c
        JOIN c.accusedList ca
        WHERE ca.offender.id = :offenderId
        ORDER BY c.caseDate DESC
    """)
    List<CaseEntity> findCasesByOffenderId(@Param("offenderId") Long offenderId);
}
