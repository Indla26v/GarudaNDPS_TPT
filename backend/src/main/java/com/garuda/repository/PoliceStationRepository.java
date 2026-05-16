package com.garuda.repository;

import com.garuda.entity.PoliceStation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PoliceStationRepository extends JpaRepository<PoliceStation, Long> {

    Optional<PoliceStation> findByPsCode(String psCode);

    boolean existsByPsCode(String psCode);
}
