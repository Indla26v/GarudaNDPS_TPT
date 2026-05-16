package com.garuda.repository;

import com.garuda.entity.SupplyChainLink;
import com.garuda.entity.enums.SupplyLinkType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SupplyChainLinkRepository extends JpaRepository<SupplyChainLink, Long> {

    List<SupplyChainLink> findByOffenderId(Long offenderId);

    List<SupplyChainLink> findByLinkedOffenderId(Long linkedOffenderId);

    List<SupplyChainLink> findByLinkType(SupplyLinkType linkType);

    /**
     * Find all network connections for an offender (either as source or linked).
     */
    List<SupplyChainLink> findByOffenderIdOrLinkedOffenderId(Long offenderId, Long linkedOffenderId);
}
