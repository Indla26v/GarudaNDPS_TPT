package com.garuda.repository;

import com.garuda.entity.SurveillanceRecord;
import com.garuda.entity.enums.VerificationStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SurveillanceRecordRepository extends JpaRepository<SurveillanceRecord, Long> {

    List<SurveillanceRecord> findByOffenderId(Long offenderId);

    Page<SurveillanceRecord> findByOffenderId(Long offenderId, Pageable pageable);

    long countByVerificationStatus(VerificationStatus status);

    List<SurveillanceRecord> findByVerificationStatus(VerificationStatus status);
}
