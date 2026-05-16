package com.garuda.repository;

import com.garuda.entity.CaseAccused;
import com.garuda.entity.enums.ArrestStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CaseAccusedRepository extends JpaRepository<CaseAccused, Long> {

    List<CaseAccused> findByCaseEntityId(Long caseId);

    List<CaseAccused> findByOffenderId(Long offenderId);

    List<CaseAccused> findByArrestStatus(ArrestStatus status);

    long countByArrestStatus(ArrestStatus status);

    /**
     * Count arrests per police station (via case → PS relationship).
     */
    @Query("""
        SELECT COUNT(ca) FROM CaseAccused ca
        WHERE ca.caseEntity.policeStation.id = :psId
          AND ca.arrestStatus = :status
    """)
    long countByPsIdAndStatus(@Param("psId") Long psId, @Param("status") ArrestStatus status);
}
