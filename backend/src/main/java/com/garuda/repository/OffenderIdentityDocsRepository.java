package com.garuda.repository;

import com.garuda.entity.OffenderIdentityDocs;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface OffenderIdentityDocsRepository extends JpaRepository<OffenderIdentityDocs, Long> {

    Optional<OffenderIdentityDocs> findByOffenderId(Long offenderId);

    void deleteByOffenderId(Long offenderId);
}
