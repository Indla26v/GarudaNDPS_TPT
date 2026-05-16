package com.garuda.repository;

import com.garuda.entity.Offender;
import com.garuda.entity.enums.OffenderCategory;
import com.garuda.entity.enums.OffenderStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OffenderRepository extends JpaRepository<Offender, Long> {

    Page<Offender> findByPoliceStationId(Long psId, Pageable pageable);

    Page<Offender> findByCategory(OffenderCategory category, Pageable pageable);

    List<Offender> findByStatus(OffenderStatus status);

    /**
     * Multi-field search: name, alias, or primary mobile number (via contacts).
     */
    @Query("""
        SELECT DISTINCT o FROM Offender o
        LEFT JOIN o.contacts c
        WHERE o.status <> com.garuda.entity.enums.OffenderStatus.INACTIVE
          AND (
            LOWER(o.fullName) LIKE LOWER(CONCAT('%', :query, '%'))
            OR LOWER(o.alias) LIKE LOWER(CONCAT('%', :query, '%'))
            OR (c.contactType IN (com.garuda.entity.enums.ContactType.MOBILE_PRIMARY, com.garuda.entity.enums.ContactType.MOBILE_SECONDARY)
                AND c.value LIKE CONCAT('%', :query, '%'))
          )
    """)
    Page<Offender> searchByNameAliasOrMobile(@Param("query") String query, Pageable pageable);

    /**
     * Search with optional PS filter.
     */
    @Query("""
        SELECT DISTINCT o FROM Offender o
        LEFT JOIN o.contacts c
        WHERE o.status <> com.garuda.entity.enums.OffenderStatus.INACTIVE
          AND (:psId IS NULL OR o.policeStation.id = :psId)
          AND (
            :query IS NULL
            OR LOWER(o.fullName) LIKE LOWER(CONCAT('%', :query, '%'))
            OR LOWER(o.alias) LIKE LOWER(CONCAT('%', :query, '%'))
            OR (c.contactType IN (com.garuda.entity.enums.ContactType.MOBILE_PRIMARY, com.garuda.entity.enums.ContactType.MOBILE_SECONDARY)
                AND c.value LIKE CONCAT('%', :query, '%'))
          )
    """)
    Page<Offender> searchWithFilters(@Param("query") String query, @Param("psId") Long psId, Pageable pageable);

    long countByPoliceStationId(Long psId);
}
