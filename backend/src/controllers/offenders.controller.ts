import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { successResponse } from '../utils/transformers';
import { logAudit } from '../utils/auditLogger';
import { getOffenderWhere } from '../utils/scope';
import { paramId } from '../utils/params';
import { maskAadhaar, canRevealAadhaar } from '../utils/pii';
import { broadcastEvent } from './sse.controller';

const STATE_CODES: Record<string, string> = {
  'andhra pradesh': 'AP',
  'ap': 'AP',
  'kerala': 'KL',
  'kl': 'KL',
  'karnataka': 'KA',
  'ka': 'KA',
  'telangana': 'TS',
  'ts': 'TS',
};

const DISTRICT_NUMBERS: Record<string, string> = {
  'tirupati': '39',
  'chittoor': '03',
};

export const getOffenders = async (req: Request, res: Response) => {
  try {
    const { query, psId, category, page = 0, size = 10 } = req.query;
    
    let whereClause: any = { ...getOffenderWhere((req as any).user) };
    if (psId) {
      whereClause.ps_id = BigInt(psId as string);
    } else if (psId === '') {
      delete whereClause.ps_id;
    }
    if (category) {
      whereClause.category = category as any;
    }
    if (query) {
      const q = String(query);
      whereClause.OR = [
        { full_name: { contains: q, mode: 'insensitive' } },
        { alias: { contains: q, mode: 'insensitive' } },
        { offender_identity_docs: { some: { OR: [
          { aadhaar_no: { contains: q, mode: 'insensitive' } },
          { voter_id: { contains: q, mode: 'insensitive' } },
          { pan_card: { contains: q, mode: 'insensitive' } }
        ] } } },
        { offender_contacts: { some: { value: { contains: q, mode: 'insensitive' } } } },
        { case_accused: { some: { cases: { fir_no: { contains: q, mode: 'insensitive' } } } } }
      ];
    }

    const skip = Number(page) * Number(size);
    const take = Number(size);

    const [offenders, total] = await Promise.all([
      prisma.offenders.findMany({
        where: whereClause,
        include: {
          police_stations: true,
          offender_contacts: { where: { contact_type: 'MOBILE_PRIMARY' } },
          case_accused: {
            include: {
              cases: {
                select: {
                  fir_no: true
                }
              }
            }
          }
        },
        skip,
        take
      }),
      prisma.offenders.count({ where: whereClause })
    ]);

    const formatted = offenders.map(o => ({
      id: o.id.toString(),
      slNo: o.sl_no,
      crNo: o.case_accused.map(ca => ca.cases?.fir_no).filter(Boolean).join(', ') || null,
      fullName: o.full_name,
      alias: o.alias,
      category: o.category,
      status: o.status,
      riskScore: o.risk_score,
      psName: o.police_stations?.name,
      district: o.district,
      mobile: o.offender_contacts?.[0]?.value || null,
      totalCases: o.case_accused.length,
      photoUrl: o.photo_url
    }));

    res.json(successResponse({ content: formatted, totalElements: total, totalPages: Math.ceil(total / take) }));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getOffenderById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // ── SECURITY FIX #5: Apply row-level scope to prevent IDOR
    // Without this, any authenticated user could enumerate all offenders
    // by ID regardless of their police station or district assignment.
    const scope = getOffenderWhere((req as any).user);
    const o = await prisma.offenders.findFirst({
      where: { id: BigInt(id as string), ...scope },
      include: {
        police_stations: true,
        users: true,
        offender_identity_docs: true,
        offender_contacts: true,
        offender_financials: true,
        offender_drug_profile: true,
        supply_chain_links_supply_chain_links_offender_idTooffenders: true,
        case_accused: true
      }
    });

    if (!o) return res.status(404).json({ message: 'Offender not found' });

    const userRole = (req as any).user?.role || '';
    const reveal = req.query.reveal === 'true' && canRevealAadhaar(userRole);
    const rawAadhaar = o.offender_identity_docs?.[0]?.aadhaar_no ?? null;

    if (reveal && rawAadhaar) {
      await logAudit('VIEW', 'OFFENDER', o.id, req, 'PII_REVEALED: aadhaar');
    }
    
    // Transform to response like OffenderResponse
    const response = {
      id: o.id.toString(),
      slNo: o.sl_no,
      psId: o.ps_id.toString(),
      psName: o.police_stations?.name,
      fullName: o.full_name,
      alias: o.alias,
      fatherHusbandName: o.father_husband_name,
      age: o.age,
      gender: o.gender,
      category: o.category,
      testResult: o.test_result,
      fullAddress: o.full_address,
      landmarkArea: o.landmark_area,
      district: o.district,
      state: o.state,
      occupation: o.occupation,
      monthlyIncome: o.monthly_income,
      photoUrl: o.photo_url,
      status: o.status,
      riskScore: o.risk_score,
      createdByName: o.users?.full_name,
      createdAt: o.created_at,
      updatedAt: o.updated_at,
      identityDocs: o.offender_identity_docs?.[0]
        ? {
            id: o.offender_identity_docs[0].id.toString(),
            aadhaarNo: reveal ? rawAadhaar : maskAadhaar(rawAadhaar),
            aadhaarMasked: !reveal,
            voterId: o.offender_identity_docs[0].voter_id,
            panCard: o.offender_identity_docs[0].pan_card,
          }
        : null,
      aadhaarNo: reveal ? rawAadhaar : maskAadhaar(rawAadhaar),
      voterId: o.offender_identity_docs?.[0]?.voter_id || null,
      panCard: o.offender_identity_docs?.[0]?.pan_card || null,
      addictionType: o.offender_drug_profile?.addiction_type || null,
      consumptionFrequency: o.offender_drug_profile?.consumption_frequency || null,
      sourceOfProcurement: o.offender_drug_profile?.source_of_procurement || null,
      modeOfPurchase: o.offender_drug_profile?.mode_of_purchase || null,
      usualConsumptionSpot: o.offender_drug_profile?.usual_consumption_spot || null,
      sectionOfLaw: o.offender_drug_profile?.section_of_law || null,
      drugProfile: o.offender_drug_profile
        ? {
            id: o.offender_drug_profile.id.toString(),
            addictionType: o.offender_drug_profile.addiction_type,
            consumptionFrequency: o.offender_drug_profile.consumption_frequency,
            sourceOfProcurement: o.offender_drug_profile.source_of_procurement,
            modeOfPurchase: o.offender_drug_profile.mode_of_purchase,
            usualConsumptionSpot: o.offender_drug_profile.usual_consumption_spot,
            sectionOfLaw: o.offender_drug_profile.section_of_law,
          }
        : null,
      contacts: o.offender_contacts.map(c => ({
        id: c.id.toString(),
        contactType: c.contact_type,
        value: c.value,
        notes: c.notes
      })),
      financials: o.offender_financials.map(f => ({
        id: f.id.toString(),
        finType: f.fin_type,
        value: f.value,
        bankName: f.bank_name,
        notes: f.notes
      })),
      supplyChainLinks: o.supply_chain_links_supply_chain_links_offender_idTooffenders.map(link => ({
        id: link.id.toString(),
        linkedOffenderId: link.linked_offender_id?.toString(),
        linkType: link.link_type,
        linkedName: link.linked_person_name,
        linkedContact: link.linked_person_contact,
        notes: link.notes
      })),
      totalCases: o.case_accused.length
    };

    res.json(successResponse(response));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createOffender = async (req: Request, res: Response) => {
  try {
    const data = req.body;

    if (data.financials && Array.isArray(data.financials)) {
      const hasBankAccount = data.financials.some((f: any) => (f.finType === 'BANK_ACCOUNT_NO' || f.fin_type === 'BANK_ACCOUNT_NO') && f.value?.trim());
      const hasIfsc = data.financials.some((f: any) => (f.finType === 'IFSC_CODE' || f.fin_type === 'IFSC_CODE') && f.value?.trim());
      
      if (hasBankAccount && !hasIfsc) {
        return res.status(400).json({ message: 'An IFSC Code is required when a Bank Account Number is provided.' });
      }

      const hasUpiId = data.financials.some((f: any) => (f.finType === 'UPI_ID' || f.fin_type === 'UPI_ID') && f.value?.trim());
      const hasUpiMobile = data.financials.some((f: any) => (f.finType === 'UPI_LINKED_MOBILE' || f.fin_type === 'UPI_LINKED_MOBILE') && f.value?.trim());
      
      if (hasUpiId && !hasUpiMobile) {
        return res.status(400).json({ message: 'A UPI Linked Phone Number is required when a UPI ID is provided.' });
      }
    }
    
    let userId = null;
    if ((req as any).user) {
       userId = BigInt((req as any).user.userId);
    }
    
    // Build nested creations safely
    const contactsCreate = data.contacts ? data.contacts.map((c: any) => ({
      contact_type: c.contactType || c.contact_type,
      value: c.value,
      notes: c.notes
    })) : [];

    const aadhaarNo = data.aadhaarNo ?? data.identityDocs?.aadhaarNo ?? null;
    const voterId = data.voterId ?? data.identityDocs?.voterId ?? null;
    const panCard = data.panCard ?? data.identityDocs?.panCard ?? null;

    const identityDocsCreate = (aadhaarNo || voterId || panCard) ? {
      aadhaar_no: aadhaarNo,
      voter_id: voterId,
      pan_card: panCard
    } : undefined;

    const financialsCreate = data.financials ? data.financials.map((f: any) => ({
      fin_type: f.finType || f.fin_type,
      value: f.value,
      bank_name: f.bankName || f.bank_name,
      notes: f.notes
    })) : [];

    const addictionType = data.addictionType ?? data.drugProfile?.addictionType ?? null;
    const consumptionFrequency = data.consumptionFrequency ?? data.drugProfile?.consumptionFrequency ?? null;
    const sourceOfProcurement = data.sourceOfProcurement ?? data.drugProfile?.sourceOfProcurement ?? null;
    const modeOfPurchase = data.modeOfPurchase ?? data.drugProfile?.modeOfPurchase ?? null;
    const usualConsumptionSpot = data.usualConsumptionSpot ?? data.drugProfile?.usualConsumptionSpot ?? null;
    const sectionOfLaw = data.sectionOfLaw ?? data.drugProfile?.sectionOfLaw ?? null;
 
    const drugProfileCreate = (addictionType || consumptionFrequency || sourceOfProcurement || modeOfPurchase || usualConsumptionSpot || sectionOfLaw) ? {
      addiction_type: addictionType,
      consumption_frequency: consumptionFrequency,
      source_of_procurement: sourceOfProcurement,
      mode_of_purchase: modeOfPurchase,
      usual_consumption_spot: usualConsumptionSpot,
      section_of_law: sectionOfLaw
    } : undefined;

    let slNo = data.slNo || data.sl_no || null;
    if (!slNo) {
      let offenderDistrict = data.district || '';
      let offenderState = data.state || '';
      
      if (!offenderDistrict || !offenderState) {
        const ps = await prisma.police_stations.findUnique({
          where: { id: BigInt(data.psId || data.ps_id) }
        });
        if (ps) {
          if (!offenderDistrict) offenderDistrict = ps.district;
          if (!offenderState) offenderState = ps.state;
        }
      }

      const stateCode = STATE_CODES[offenderState.toLowerCase().trim()];
      const districtNum = DISTRICT_NUMBERS[offenderDistrict.toLowerCase().trim()];

      // ── SECURITY FIX #9: Race Condition in SL No Generation
      // Instead of count() + 1, we save the prefix and update after creation
      let prefix = 'SL-';
      if (stateCode && districtNum) {
        prefix = `${stateCode}${districtNum}-`;
      }
      
      // Temporary sl_no if needed, but it's optional in schema. We omit it here.
      slNo = null as any; // Will be set after creation
    }

    const dataObj: any = {
      // sl_no: slNo, (omitted to set atomically)
      full_name: data.fullName || data.full_name,
      alias: data.alias || null,
      father_husband_name: data.fatherHusbandName || data.father_husband_name || null,
      age: data.age,
      gender: data.gender,
      category: data.category,
      test_result: data.testResult || data.test_result,
      full_address: data.fullAddress || data.full_address || null,
      landmark_area: data.landmarkArea || data.landmark_area || null,
      district: data.district,
      state: data.state,
      occupation: data.occupation,
      monthly_income: data.monthlyIncome || data.monthly_income || null,
      photo_url: data.photoUrl || data.photo_url || null,
      status: data.status || 'ACTIVE',
      risk_score: data.riskScore || data.risk_score,
      ps_id: BigInt(data.psId || data.ps_id),
      created_by: userId,
    };

    if (slNo && data.slNo) {
       dataObj.sl_no = slNo; // if it was explicitly provided
    }

    if (contactsCreate.length > 0) dataObj.offender_contacts = { create: contactsCreate };
    if (identityDocsCreate) dataObj.offender_identity_docs = { create: identityDocsCreate };
    if (financialsCreate.length > 0) dataObj.offender_financials = { create: financialsCreate };
    if (drugProfileCreate) dataObj.offender_drug_profile = { create: drugProfileCreate };

    const newOffender = await prisma.offenders.create({
      data: dataObj
    });

    // ── SECURITY FIX #9: Set SL No using atomic ID
    if (!data.sl_no && !data.slNo) {
      const stateCode = STATE_CODES[(data.state || 'Andhra Pradesh').toLowerCase().trim()];
      const districtNum = DISTRICT_NUMBERS[(data.district || '').toLowerCase().trim()];
      
      let finalSlNo = `SL-${100 + Number(newOffender.id)}`;
      if (stateCode && districtNum) {
        finalSlNo = `${stateCode}${districtNum}-${String(newOffender.id).padStart(4, '0')}`;
      }

      await prisma.offenders.update({
        where: { id: newOffender.id },
        data: { sl_no: finalSlNo }
      });
    }
    
    if (data.supplyChainLinks && data.supplyChainLinks.length > 0) {
       await prisma.supply_chain_links.createMany({
          data: data.supplyChainLinks.map((s: any) => ({
            offender_id: newOffender.id,
            linked_offender_id: s.linkedOffenderId ? BigInt(s.linkedOffenderId) : null,
            link_type: s.linkType || s.link_type,
            linked_person_name: s.linkedName || s.linkedPersonName || s.linked_person_name,
            linked_person_contact: s.linkedContact || s.linkedPersonContact || s.linked_person_contact,
            notes: s.notes
          }))
       });
    }

    await logAudit('CREATE', 'OFFENDER', newOffender.id, req);
    broadcastEvent('offender_created', { id: newOffender.id.toString() });
    res.status(201).json(successResponse({ id: newOffender.id.toString() }, 'Offender created successfully'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateOffender = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;

    if (data.financials && Array.isArray(data.financials)) {
      const hasBankAccount = data.financials.some((f: any) => (f.finType === 'BANK_ACCOUNT_NO' || f.fin_type === 'BANK_ACCOUNT_NO') && f.value?.trim());
      const hasIfsc = data.financials.some((f: any) => (f.finType === 'IFSC_CODE' || f.fin_type === 'IFSC_CODE') && f.value?.trim());
      
      if (hasBankAccount && !hasIfsc) {
        return res.status(400).json({ message: 'An IFSC Code is required when a Bank Account Number is provided.' });
      }

      const hasUpiId = data.financials.some((f: any) => (f.finType === 'UPI_ID' || f.fin_type === 'UPI_ID') && f.value?.trim());
      const hasUpiMobile = data.financials.some((f: any) => (f.finType === 'UPI_LINKED_MOBILE' || f.fin_type === 'UPI_LINKED_MOBILE') && f.value?.trim());
      
      if (hasUpiId && !hasUpiMobile) {
        return res.status(400).json({ message: 'A UPI Linked Phone Number is required when a UPI ID is provided.' });
      }
    }
    
    // ── SECURITY FIX #8: Apply row-level scope to prevent cross-PS record tampering
    const scope = getOffenderWhere((req as any).user);
    const existing = await prisma.offenders.findFirst({ where: { id: BigInt(id as string), ...scope } });
    if (!existing) return res.status(404).json({ message: 'Offender not found or access denied' });

    // Transaction for safe nested updates (delete then recreate)
    await prisma.$transaction(async (tx) => {
       const updateDataObj: any = {
         full_name: data.fullName || data.full_name,
         status: data.status,
         ps_id: BigInt(data.psId || data.ps_id),
       };
       if (data.slNo !== undefined || data.sl_no !== undefined) updateDataObj.sl_no = data.slNo || data.sl_no || null;
       if (data.alias !== undefined) updateDataObj.alias = data.alias || null;
       if (data.fatherHusbandName !== undefined || data.father_husband_name !== undefined) {
         updateDataObj.father_husband_name = data.fatherHusbandName || data.father_husband_name || null;
       }
       if (data.age !== undefined) updateDataObj.age = data.age;
       if (data.gender !== undefined) updateDataObj.gender = data.gender;
       if (data.category !== undefined) updateDataObj.category = data.category;
       if (data.testResult !== undefined || data.test_result !== undefined) {
         updateDataObj.test_result = data.testResult || data.test_result;
       }
       if (data.fullAddress !== undefined || data.full_address !== undefined) {
         updateDataObj.full_address = data.fullAddress || data.full_address || null;
       }
       if (data.landmarkArea !== undefined || data.landmark_area !== undefined) {
         updateDataObj.landmark_area = data.landmarkArea || data.landmark_area || null;
       }
       if (data.district !== undefined) updateDataObj.district = data.district;
       if (data.state !== undefined) updateDataObj.state = data.state;
       if (data.occupation !== undefined) updateDataObj.occupation = data.occupation;
       if (data.monthlyIncome !== undefined || data.monthly_income !== undefined) {
         updateDataObj.monthly_income = data.monthlyIncome || data.monthly_income || null;
       }
       if (data.photoUrl !== undefined || data.photo_url !== undefined) {
         updateDataObj.photo_url = data.photoUrl || data.photo_url || null;
       }
       if (data.riskScore !== undefined || data.risk_score !== undefined) {
         updateDataObj.risk_score = data.riskScore || data.risk_score;
       }

       await tx.offenders.update({
          where: { id: BigInt(id as string) },
          data: updateDataObj
       });

       // Delete nested
       await tx.offender_contacts.deleteMany({ where: { offender_id: BigInt(id as string) } });
       await tx.offender_identity_docs.deleteMany({ where: { offender_id: BigInt(id as string) } });
       await tx.offender_financials.deleteMany({ where: { offender_id: BigInt(id as string) } });
       await tx.offender_drug_profile.deleteMany({ where: { offender_id: BigInt(id as string) } });
       await tx.supply_chain_links.deleteMany({ where: { offender_id: BigInt(id as string) } });

       // Recreate nested (same logic as create)
       if (data.contacts) {
         await tx.offender_contacts.createMany({
           data: data.contacts.map((c: any) => ({
             offender_id: BigInt(id as string),
             contact_type: c.contactType || c.contact_type,
             value: c.value,
             notes: c.notes
           }))
         });
       }
       const aadhaarNo = data.aadhaarNo ?? data.identityDocs?.aadhaarNo ?? null;
       const voterId = data.voterId ?? data.identityDocs?.voterId ?? null;
       const panCard = data.panCard ?? data.identityDocs?.panCard ?? null;

       if (aadhaarNo || voterId || panCard) {
         await tx.offender_identity_docs.create({
           data: {
             offender_id: BigInt(id as string),
             aadhaar_no: aadhaarNo,
             voter_id: voterId,
             pan_card: panCard
           }
         });
       }
       if (data.financials) {
         await tx.offender_financials.createMany({
           data: data.financials.map((f: any) => ({
            offender_id: BigInt(id as string),
            fin_type: f.finType || f.fin_type,
            value: f.value,
            bank_name: f.bankName || f.bank_name,
            notes: f.notes
           }))
         });
       }
       const addictionType = data.addictionType ?? data.drugProfile?.addictionType ?? null;
       const consumptionFrequency = data.consumptionFrequency ?? data.drugProfile?.consumptionFrequency ?? null;
       const sourceOfProcurement = data.sourceOfProcurement ?? data.drugProfile?.sourceOfProcurement ?? null;
       const modeOfPurchase = data.modeOfPurchase ?? data.drugProfile?.modeOfPurchase ?? null;
       const usualConsumptionSpot = data.usualConsumptionSpot ?? data.drugProfile?.usualConsumptionSpot ?? null;
       const sectionOfLaw = data.sectionOfLaw ?? data.drugProfile?.sectionOfLaw ?? null;

       if (addictionType || consumptionFrequency || sourceOfProcurement || modeOfPurchase || usualConsumptionSpot || sectionOfLaw) {
         await tx.offender_drug_profile.create({
           data: {
             offender_id: BigInt(id as string),
             addiction_type: addictionType,
             consumption_frequency: consumptionFrequency,
             source_of_procurement: sourceOfProcurement,
             mode_of_purchase: modeOfPurchase,
             usual_consumption_spot: usualConsumptionSpot,
             section_of_law: sectionOfLaw
           }
         });
       }
       if (data.supplyChainLinks) {
         await tx.supply_chain_links.createMany({
          data: data.supplyChainLinks.map((s: any) => ({
            offender_id: BigInt(id as string),
            linked_offender_id: s.linkedOffenderId ? BigInt(s.linkedOffenderId) : null,
            link_type: s.linkType || s.link_type,
            linked_person_name: s.linkedName || s.linkedPersonName || s.linked_person_name,
            linked_person_contact: s.linkedContact || s.linkedPersonContact || s.linked_person_contact,
            notes: s.notes
          }))
         });
       }
    });

    await logAudit('UPDATE', 'OFFENDER', BigInt(id as string), req);
    broadcastEvent('data_updated', { entity: 'offender', id });
    res.json(successResponse({ id }, 'Offender updated successfully'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
