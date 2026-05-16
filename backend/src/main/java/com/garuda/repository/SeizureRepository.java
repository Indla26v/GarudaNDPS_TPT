package com.garuda.repository;

import com.garuda.entity.Seizure;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;

@Repository
public interface SeizureRepository extends JpaRepository<Seizure, Long> {

    List<Seizure> findByCaseEntityId(Long caseId);

    /**
     * Total contraband seized (all PS).
     */
    @Query("SELECT COALESCE(SUM(s.contrabandKg), 0) FROM Seizure s")
    BigDecimal sumTotalContrabandKg();

    /**
     * Total cash seized (all PS).
     */
    @Query("SELECT COALESCE(SUM(s.cashAmount), 0) FROM Seizure s")
    BigDecimal sumTotalCashAmount();

    /**
     * Total vehicles seized (all PS).
     */
    @Query("SELECT COALESCE(SUM(s.vehiclesCount), 0) FROM Seizure s")
    long sumTotalVehicles();

    /**
     * Contraband seized per PS.
     */
    @Query("""
        SELECT COALESCE(SUM(s.contrabandKg), 0)
        FROM Seizure s
        WHERE s.caseEntity.policeStation.id = :psId
    """)
    BigDecimal sumContrabandByPsId(@Param("psId") Long psId);

    /**
     * Cash seized per PS.
     */
    @Query("""
        SELECT COALESCE(SUM(s.cashAmount), 0)
        FROM Seizure s
        WHERE s.caseEntity.policeStation.id = :psId
    """)
    BigDecimal sumCashByPsId(@Param("psId") Long psId);
}
