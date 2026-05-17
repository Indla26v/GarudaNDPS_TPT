import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { successResponse } from '../utils/transformers';
import { logAudit } from '../utils/auditLogger';

export const getOffenders = async (req: Request, res: Response) => {
  try {
    const { query, psId, page = 0, size = 10 } = req.query;
    
    // Build where clause
    let whereClause: any = {};
    if (psId) {
      whereClause.ps_id = BigInt(psId as string);
    }
    if (query) {
      const q = String(query);
      whereClause.OR = [
        { full_name: { contains: q, mode: 'insensitive' } },
        { alias: { contains: q, mode: 'insensitive' } }
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
          case_accused: true
        },
        skip,
        take
      }),
      prisma.offenders.count({ where: whereClause })
    ]);

    const formatted = offenders.map(o => ({
      id: o.id.toString(),
      sl_no: o.sl_no,
      full_name: o.full_name,
      alias: o.alias,
      category: o.category,
      status: o.status,
      risk_score: o.risk_score,
      ps_name: o.police_stations?.name,
      district: o.district,
      mobile: o.offender_contacts?.[0]?.value || null,
      total_cases: o.case_accused.length
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
    const o = await prisma.offenders.findUnique({
      where: { id: BigInt(id) },
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
      identityDocs: o.offender_identity_docs?.[0] || null,
      contacts: o.offender_contacts.map(c => ({...c, id: c.id.toString(), offender_id: undefined})),
      financials: o.offender_financials.map(f => ({...f, id: f.id.toString(), offender_id: undefined})),
      drugProfile: o.offender_drug_profile || null,
      supplyChainLinks: o.supply_chain_links_supply_chain_links_offender_idTooffenders.map(link => ({
        id: link.id.toString(),
        linkedOffenderId: link.linked_offender_id?.toString(),
        linkType: link.link_type,
        linkedPersonName: link.linked_person_name,
        linkedPersonContact: link.linked_person_contact,
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

    const identityDocsCreate = data.identityDocs ? {
      aadhaar_no: data.identityDocs.aadhaarNo,
      voter_id: data.identityDocs.voterId,
      pan_card: data.identityDocs.panCard
    } : undefined;

    const financialsCreate = data.financials ? data.financials.map((f: any) => ({
      fin_type: f.finType || f.fin_type,
      value: f.value,
      bank_name: f.bankName || f.bank_name,
      notes: f.notes
    })) : [];

    const drugProfileCreate = data.drugProfile ? {
      addiction_type: data.drugProfile.addictionType,
      consumption_frequency: data.drugProfile.consumptionFrequency,
      source_of_procurement: data.drugProfile.sourceOfProcurement,
      mode_of_purchase: data.drugProfile.modeOfPurchase,
      usual_consumption_spot: data.drugProfile.usualConsumptionSpot
    } : undefined;

    const newOffender = await prisma.offenders.create({
      data: {
        sl_no: data.slNo || data.sl_no,
        full_name: data.fullName || data.full_name,
        alias: data.alias,
        father_husband_name: data.fatherHusbandName || data.father_husband_name,
        age: data.age,
        gender: data.gender,
        category: data.category,
        test_result: data.testResult || data.test_result,
        full_address: data.fullAddress || data.full_address,
        landmark_area: data.landmarkArea || data.landmark_area,
        district: data.district,
        state: data.state,
        occupation: data.occupation,
        monthly_income: data.monthlyIncome || data.monthly_income,
        photo_url: data.photoUrl || data.photo_url,
        status: data.status || 'ACTIVE',
        risk_score: data.riskScore || data.risk_score,
        ps_id: BigInt(data.psId || data.ps_id),
        created_by: userId,
        offender_contacts: contactsCreate.length > 0 ? { create: contactsCreate } : undefined,
        offender_identity_docs: identityDocsCreate ? { create: identityDocsCreate } : undefined,
        offender_financials: financialsCreate.length > 0 ? { create: financialsCreate } : undefined,
        offender_drug_profile: drugProfileCreate ? { create: drugProfileCreate } : undefined,
      }
    });
    
    if (data.supplyChainLinks && data.supplyChainLinks.length > 0) {
       await prisma.supply_chain_links.createMany({
          data: data.supplyChainLinks.map((s: any) => ({
            offender_id: newOffender.id,
            linked_offender_id: s.linkedOffenderId ? BigInt(s.linkedOffenderId) : null,
            link_type: s.linkType || s.link_type,
            linked_person_name: s.linkedPersonName || s.linked_person_name,
            linked_person_contact: s.linkedPersonContact || s.linked_person_contact,
            notes: s.notes
          }))
       });
    }

    await logAudit('CREATE', 'OFFENDER', newOffender.id, req);

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
    
    // Find first
    const existing = await prisma.offenders.findUnique({ where: { id: BigInt(id) } });
    if (!existing) return res.status(404).json({ message: 'Offender not found' });

    // Transaction for safe nested updates (delete then recreate)
    await prisma.$transaction(async (tx) => {
       await tx.offenders.update({
          where: { id: BigInt(id) },
          data: {
            sl_no: data.slNo || data.sl_no,
            full_name: data.fullName || data.full_name,
            alias: data.alias,
            father_husband_name: data.fatherHusbandName || data.father_husband_name,
            age: data.age,
            gender: data.gender,
            category: data.category,
            test_result: data.testResult || data.test_result,
            full_address: data.fullAddress || data.full_address,
            landmark_area: data.landmarkArea || data.landmark_area,
            district: data.district,
            state: data.state,
            occupation: data.occupation,
            monthly_income: data.monthlyIncome || data.monthly_income,
            photo_url: data.photoUrl || data.photo_url,
            status: data.status,
            risk_score: data.riskScore || data.risk_score,
            ps_id: BigInt(data.psId || data.ps_id),
          }
       });

       // Delete nested
       await tx.offender_contacts.deleteMany({ where: { offender_id: BigInt(id) } });
       await tx.offender_identity_docs.deleteMany({ where: { offender_id: BigInt(id) } });
       await tx.offender_financials.deleteMany({ where: { offender_id: BigInt(id) } });
       await tx.offender_drug_profile.deleteMany({ where: { offender_id: BigInt(id) } });
       await tx.supply_chain_links.deleteMany({ where: { offender_id: BigInt(id) } });

       // Recreate nested (same logic as create)
       if (data.contacts) {
         await tx.offender_contacts.createMany({
           data: data.contacts.map((c: any) => ({
             offender_id: BigInt(id),
             contact_type: c.contactType || c.contact_type,
             value: c.value,
             notes: c.notes
           }))
         });
       }
       if (data.identityDocs) {
         await tx.offender_identity_docs.create({
           data: {
             offender_id: BigInt(id),
             aadhaar_no: data.identityDocs.aadhaarNo,
             voter_id: data.identityDocs.voterId,
             pan_card: data.identityDocs.panCard
           }
         });
       }
       if (data.financials) {
         await tx.offender_financials.createMany({
           data: data.financials.map((f: any) => ({
            offender_id: BigInt(id),
            fin_type: f.finType || f.fin_type,
            value: f.value,
            bank_name: f.bankName || f.bank_name,
            notes: f.notes
           }))
         });
       }
       if (data.drugProfile) {
         await tx.offender_drug_profile.create({
           data: {
             offender_id: BigInt(id),
             addiction_type: data.drugProfile.addictionType,
             consumption_frequency: data.drugProfile.consumptionFrequency,
             source_of_procurement: data.drugProfile.sourceOfProcurement,
             mode_of_purchase: data.drugProfile.modeOfPurchase,
             usual_consumption_spot: data.drugProfile.usualConsumptionSpot
           }
         });
       }
       if (data.supplyChainLinks) {
         await tx.supply_chain_links.createMany({
          data: data.supplyChainLinks.map((s: any) => ({
            offender_id: BigInt(id),
            linked_offender_id: s.linkedOffenderId ? BigInt(s.linkedOffenderId) : null,
            link_type: s.linkType || s.link_type,
            linked_person_name: s.linkedPersonName || s.linked_person_name,
            linked_person_contact: s.linkedPersonContact || s.linked_person_contact,
            notes: s.notes
          }))
         });
       }
    });

    await logAudit('UPDATE', 'OFFENDER', id, req);

    res.json(successResponse({ id }, 'Offender updated successfully'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
