package com.garuda.repository;

import com.garuda.entity.OffenderContact;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OffenderContactRepository extends JpaRepository<OffenderContact, Long> {

    List<OffenderContact> findByOffenderId(Long offenderId);

    void deleteByOffenderId(Long offenderId);
}
