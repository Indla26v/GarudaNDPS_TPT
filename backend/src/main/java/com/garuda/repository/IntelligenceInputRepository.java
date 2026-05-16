package com.garuda.repository;

import com.garuda.entity.IntelligenceInput;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface IntelligenceInputRepository extends JpaRepository<IntelligenceInput, Long> {

    List<IntelligenceInput> findByOffenderId(Long offenderId);

    Page<IntelligenceInput> findByPoliceStationId(Long psId, Pageable pageable);

    long countByPoliceStationId(Long psId);
}
