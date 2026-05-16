package com.garuda.repository;

import com.garuda.entity.OffenderDrugProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface OffenderDrugProfileRepository extends JpaRepository<OffenderDrugProfile, Long> {

    Optional<OffenderDrugProfile> findByOffenderId(Long offenderId);

    void deleteByOffenderId(Long offenderId);
}
