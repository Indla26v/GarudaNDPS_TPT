package com.garuda.service;

import com.garuda.config.AuditLogger;
import com.garuda.dto.*;
import com.garuda.dto.offender.OffenderListDto;
import com.garuda.dto.offender.OffenderRequest;
import com.garuda.dto.offender.OffenderResponse;
import com.garuda.entity.*;
import com.garuda.entity.enums.*;
import com.garuda.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class OffenderService {

    private final OffenderRepository offenderRepository;
    private final PoliceStationRepository psRepository;
    private final UserRepository userRepository;
    private final OffenderContactRepository contactRepository;
    private final OffenderFinancialRepository financialRepository;
    private final OffenderIdentityDocsRepository identityDocsRepository;
    private final OffenderDrugProfileRepository drugProfileRepository;
    private final SupplyChainLinkRepository supplyChainRepository;
    private final CaseAccusedRepository caseAccusedRepository;
    private final AuditLogger auditLogger;

    @PreAuthorize("hasAnyRole('ADMIN','SP','DSP','SHO','FIELD_OFFICER','DATA_ENTRY')")
    @Transactional
    public OffenderResponse createOffender(OffenderRequest req) {
        PoliceStation ps = psRepository.findById(req.getPsId())
                .orElseThrow(() -> new IllegalArgumentException("Police station not found"));
        User currentUser = getCurrentUser();

        Offender o = Offender.builder()
                .slNo(req.getSlNo()).policeStation(ps)
                .fullName(req.getFullName()).alias(req.getAlias())
                .fatherHusbandName(req.getFatherHusbandName())
                .age(req.getAge()).gender(parseEnum(GenderType.class, req.getGender()))
                .category(parseEnum(OffenderCategory.class, req.getCategory()))
                .testResult(parseEnum(TestResult.class, req.getTestResult()))
                .fullAddress(req.getFullAddress()).landmarkArea(req.getLandmarkArea())
                .district(req.getDistrict()).state(req.getState())
                .occupation(req.getOccupation()).monthlyIncome(req.getMonthlyIncome())
                .photoUrl(req.getPhotoUrl())
                .status(req.getStatus() != null
                        ? parseEnum(OffenderStatus.class, req.getStatus()) : OffenderStatus.ACTIVE)
                .riskScore(parseEnum(RiskScore.class, req.getRiskScore()))
                .createdBy(currentUser)
                .build();
        o = offenderRepository.save(o);
        saveNestedData(o, req);
        auditLogger.log("CREATE", "OFFENDER", o.getId());
        return toFullResponse(o);
    }

    @PreAuthorize("isAuthenticated()")
    public Page<OffenderListDto> getOffenders(String query, Long psId, Pageable pageable) {
        Page<Offender> page;
        if ((query == null || query.isBlank()) && psId == null) {
            page = offenderRepository.findAll(pageable);
        } else {
            page = offenderRepository.searchWithFilters(
                    query != null && query.isBlank() ? null : query, psId, pageable);
        }
        return page.map(this::toListDto);
    }

    @PreAuthorize("isAuthenticated()")
    public OffenderResponse getOffenderById(Long id) {
        Offender o = offenderRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Offender not found: " + id));
        return toFullResponse(o);
    }

    @PreAuthorize("hasAnyRole('ADMIN','SP','DSP','SHO','FIELD_OFFICER','DATA_ENTRY')")
    @Transactional
    public OffenderResponse updateOffender(Long id, OffenderRequest req) {
        Offender o = offenderRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Offender not found: " + id));
        PoliceStation ps = psRepository.findById(req.getPsId())
                .orElseThrow(() -> new IllegalArgumentException("Police station not found"));

        o.setPoliceStation(ps); o.setSlNo(req.getSlNo());
        o.setFullName(req.getFullName()); o.setAlias(req.getAlias());
        o.setFatherHusbandName(req.getFatherHusbandName());
        o.setAge(req.getAge()); o.setGender(parseEnum(GenderType.class, req.getGender()));
        o.setCategory(parseEnum(OffenderCategory.class, req.getCategory()));
        o.setTestResult(parseEnum(TestResult.class, req.getTestResult()));
        o.setFullAddress(req.getFullAddress()); o.setLandmarkArea(req.getLandmarkArea());
        o.setDistrict(req.getDistrict()); o.setState(req.getState());
        o.setOccupation(req.getOccupation()); o.setMonthlyIncome(req.getMonthlyIncome());
        o.setPhotoUrl(req.getPhotoUrl());
        if (req.getStatus() != null) o.setStatus(parseEnum(OffenderStatus.class, req.getStatus()));
        o.setRiskScore(parseEnum(RiskScore.class, req.getRiskScore()));
        offenderRepository.save(o);

        // Replace nested data
        clearNestedData(id);
        saveNestedData(o, req);

        auditLogger.log("UPDATE", "OFFENDER", o.getId());
        return toFullResponse(o);
    }

    @PreAuthorize("isAuthenticated()")
    public Page<OffenderListDto> searchOffenders(String query, Pageable pageable) {
        return offenderRepository.searchByNameAliasOrMobile(query, pageable).map(this::toListDto);
    }

    // ---- Private Helpers ----

    private void clearNestedData(Long offenderId) {
        contactRepository.deleteAll(contactRepository.findByOffenderId(offenderId));
        financialRepository.deleteAll(financialRepository.findByOffenderId(offenderId));
        identityDocsRepository.findByOffenderId(offenderId).ifPresent(identityDocsRepository::delete);
        drugProfileRepository.findByOffenderId(offenderId).ifPresent(drugProfileRepository::delete);
        supplyChainRepository.deleteAll(supplyChainRepository.findByOffenderId(offenderId));
    }

    private void saveNestedData(Offender o, OffenderRequest req) {
        // Identity Docs
        if (req.getIdentityDocs() != null) {
            IdentityDocsDto idDto = req.getIdentityDocs();
            identityDocsRepository.save(OffenderIdentityDocs.builder()
                    .offender(o).aadhaarNo(idDto.getAadhaarNo())
                    .voterId(idDto.getVoterId()).panCard(idDto.getPanCard()).build());
        }

        // Contacts
        if (req.getContacts() != null) {
            for (ContactDto cd : req.getContacts()) {
                contactRepository.save(OffenderContact.builder()
                        .offender(o).contactType(ContactType.valueOf(cd.getContactType()))
                        .value(cd.getValue()).notes(cd.getNotes()).build());
            }
        }

        // Financials
        if (req.getFinancials() != null) {
            for (FinancialDto fd : req.getFinancials()) {
                financialRepository.save(OffenderFinancial.builder()
                        .offender(o).finType(FinType.valueOf(fd.getFinType()))
                        .value(fd.getValue()).bankName(fd.getBankName())
                        .notes(fd.getNotes()).build());
            }
        }

        // Drug Profile
        if (req.getDrugProfile() != null) {
            DrugProfileDto dp = req.getDrugProfile();
            drugProfileRepository.save(OffenderDrugProfile.builder()
                    .offender(o)
                    .addictionType(parseEnum(AddictionType.class, dp.getAddictionType()))
                    .consumptionFrequency(parseEnum(ConsumptionFrequency.class, dp.getConsumptionFrequency()))
                    .sourceOfProcurement(parseEnum(SourceOfProcurement.class, dp.getSourceOfProcurement()))
                    .modeOfPurchase(parseEnum(PurchaseMode.class, dp.getModeOfPurchase()))
                    .usualConsumptionSpot(dp.getUsualConsumptionSpot()).build());
        }

        // Supply Chain Links
        if (req.getSupplyChainLinks() != null) {
            for (SupplyChainLinkDto sld : req.getSupplyChainLinks()) {
                Offender linked = sld.getLinkedOffenderId() != null
                        ? offenderRepository.findById(sld.getLinkedOffenderId()).orElse(null) : null;
                supplyChainRepository.save(SupplyChainLink.builder()
                        .offender(o).linkedOffender(linked)
                        .linkType(SupplyLinkType.valueOf(sld.getLinkType()))
                        .linkedPersonName(sld.getLinkedPersonName())
                        .linkedPersonContact(sld.getLinkedPersonContact())
                        .notes(sld.getNotes()).build());
            }
        }
    }

    private OffenderListDto toListDto(Offender o) {
        String mobile = o.getContacts().stream()
                .filter(c -> c.getContactType() == ContactType.MOBILE_PRIMARY)
                .findFirst().map(OffenderContact::getValue).orElse(null);
        return OffenderListDto.builder()
                .id(o.getId()).slNo(o.getSlNo()).fullName(o.getFullName())
                .alias(o.getAlias())
                .category(o.getCategory() != null ? o.getCategory().name() : null)
                .status(o.getStatus() != null ? o.getStatus().name() : null)
                .riskScore(o.getRiskScore() != null ? o.getRiskScore().name() : null)
                .psName(o.getPoliceStation().getName()).district(o.getDistrict())
                .mobile(mobile)
                .totalCases(caseAccusedRepository.findByOffenderId(o.getId()).size())
                .build();
    }

    private OffenderResponse toFullResponse(Offender o) {
        // Contacts
        List<ContactDto> contacts = contactRepository.findByOffenderId(o.getId()).stream()
                .map(c -> ContactDto.builder().id(c.getId()).contactType(c.getContactType().name())
                        .value(c.getValue()).notes(c.getNotes()).build())
                .collect(Collectors.toList());

        // Financials
        List<FinancialDto> financials = financialRepository.findByOffenderId(o.getId()).stream()
                .map(f -> FinancialDto.builder().id(f.getId()).finType(f.getFinType().name())
                        .value(f.getValue()).bankName(f.getBankName()).notes(f.getNotes()).build())
                .collect(Collectors.toList());

        // Identity Docs
        IdentityDocsDto idDocs = identityDocsRepository.findByOffenderId(o.getId())
                .map(d -> IdentityDocsDto.builder().id(d.getId())
                        .aadhaarNo(d.getAadhaarNo()).voterId(d.getVoterId())
                        .panCard(d.getPanCard()).build())
                .orElse(null);

        // Drug Profile
        DrugProfileDto drugProfile = drugProfileRepository.findByOffenderId(o.getId())
                .map(dp -> DrugProfileDto.builder().id(dp.getId())
                        .addictionType(dp.getAddictionType() != null ? dp.getAddictionType().name() : null)
                        .consumptionFrequency(dp.getConsumptionFrequency() != null ? dp.getConsumptionFrequency().name() : null)
                        .sourceOfProcurement(dp.getSourceOfProcurement() != null ? dp.getSourceOfProcurement().name() : null)
                        .modeOfPurchase(dp.getModeOfPurchase() != null ? dp.getModeOfPurchase().name() : null)
                        .usualConsumptionSpot(dp.getUsualConsumptionSpot()).build())
                .orElse(null);

        // Supply Chain Links
        List<SupplyChainLinkDto> links = supplyChainRepository.findByOffenderId(o.getId()).stream()
                .map(scl -> SupplyChainLinkDto.builder().id(scl.getId())
                        .linkedOffenderId(scl.getLinkedOffender() != null ? scl.getLinkedOffender().getId() : null)
                        .linkType(scl.getLinkType().name())
                        .linkedPersonName(scl.getLinkedPersonName())
                        .linkedPersonContact(scl.getLinkedPersonContact())
                        .notes(scl.getNotes()).build())
                .collect(Collectors.toList());

        return OffenderResponse.builder()
                .id(o.getId()).slNo(o.getSlNo())
                .psId(o.getPoliceStation().getId()).psName(o.getPoliceStation().getName())
                .fullName(o.getFullName()).alias(o.getAlias())
                .fatherHusbandName(o.getFatherHusbandName()).age(o.getAge())
                .gender(o.getGender() != null ? o.getGender().name() : null)
                .category(o.getCategory() != null ? o.getCategory().name() : null)
                .testResult(o.getTestResult() != null ? o.getTestResult().name() : null)
                .fullAddress(o.getFullAddress()).landmarkArea(o.getLandmarkArea())
                .district(o.getDistrict()).state(o.getState())
                .occupation(o.getOccupation()).monthlyIncome(o.getMonthlyIncome())
                .photoUrl(o.getPhotoUrl())
                .status(o.getStatus() != null ? o.getStatus().name() : null)
                .riskScore(o.getRiskScore() != null ? o.getRiskScore().name() : null)
                .createdByName(o.getCreatedBy() != null ? o.getCreatedBy().getFullName() : null)
                .createdAt(o.getCreatedAt()).updatedAt(o.getUpdatedAt())
                .identityDocs(idDocs).contacts(contacts).financials(financials)
                .drugProfile(drugProfile).supplyChainLinks(links)
                .totalCases(caseAccusedRepository.findByOffenderId(o.getId()).size())
                .build();
    }

    private User getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null) return userRepository.findByUsername(auth.getName()).orElse(null);
        return null;
    }

    private <E extends Enum<E>> E parseEnum(Class<E> cls, String val) {
        if (val == null || val.isBlank()) return null;
        try { return Enum.valueOf(cls, val.toUpperCase()); } catch (Exception e) { return null; }
    }
}
