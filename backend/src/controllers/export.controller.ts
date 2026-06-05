import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { getOffenderWhere } from '../utils/scope';
import { maskAadhaar } from '../utils/pii';
import { logAudit } from '../utils/auditLogger';

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function formatMobileForCsv(val: string | null | undefined): string {
  if (!val) return '';
  let clean = val.trim();
  if (/e/i.test(clean)) {
    const parsed = Number(clean);
    if (!isNaN(parsed)) {
      clean = String(parsed);
    }
  }
  const digits = clean.replace(/\D/g, '');
  if (digits.length >= 10) {
    const tenDigits = digits.slice(-10);
    return `'+91${tenDigits}`;
  }
  return clean ? `'${clean}` : '';
}

function formatAadhaarForCsv(val: string | null | undefined): string {
  if (!val) return '';
  let clean = val.trim();
  if (/e/i.test(clean)) {
    const parsed = Number(clean);
    if (!isNaN(parsed)) {
      clean = String(parsed);
    }
  }
  const digits = clean.replace(/\D/g, '');
  if (digits.length === 12) {
    return `'${digits}`;
  }
  return `'${clean}`;
}

export const exportOffendersCsv = async (req: Request, res: Response) => {
  try {
    const where = getOffenderWhere((req as any).user);
    const { psId, query, category } = req.query;
    if (psId) (where as any).ps_id = BigInt(String(psId));
    if (category) (where as any).category = String(category) as any;
    if (query) {
      const q = String(query);
      (where as any).OR = [
        { full_name: { contains: q, mode: 'insensitive' } },
        { alias: { contains: q, mode: 'insensitive' } },
      ];
    }

    const offenders = await prisma.offenders.findMany({
      where,
      include: {
        police_stations: true,
        offender_contacts: true,
        offender_identity_docs: true,
        offender_drug_profile: true,
        offender_financials: true,
        supply_chain_links_supply_chain_links_offender_idTooffenders: true,
        case_accused: {
          include: {
            cases: {
              include: {
                police_stations: true,
              },
            },
          },
        },
        interrogation_sessions: {
          include: {
            users: true,
          },
        },
      },
      orderBy: { full_name: 'asc' },
      take: 5000,
    });

    const headers = [
      'SL No', 'Full Name', 'Alias', 'Father/Husband Name', 'Age', 'Gender', 'Category', 'Status',
      'Police Station', 'District', 'State', 'Occupation', 'Monthly Income', 'Full Address', 'Landmark/Area',
      'Primary Mobile', 'Secondary Mobile', 'Other Contacts', 'Aadhaar No', 'Voter ID', 'PAN Card',
      'Photo URL', 'Test Result', 'Risk Score', 'Addiction Type', 'Consumption Frequency',
      'Source of Procurement', 'Mode of Purchase', 'Usual Consumption Spot', 'Financial Details',
      'Supply Chain Links', 'Total Cases', 'Linked Cases / FIRs', 'Interrogation Sessions'
    ];
    const lines = [headers.join(',')];

    for (const o of offenders) {
      const slNo = o.sl_no || '';
      const fullName = o.full_name || '';
      const alias = o.alias || '';
      const fatherHusbandName = o.father_husband_name || '';
      const age = o.age != null ? String(o.age) : '';
      const gender = o.gender || '';
      const categoryVal = o.category || '';
      const statusVal = o.status || '';
      const psName = o.police_stations?.name || '';
      const district = o.district || '';
      const state = o.state || '';
      const occupation = o.occupation || '';
      const monthlyIncome = o.monthly_income != null ? String(o.monthly_income) : '';
      const fullAddress = o.full_address || '';
      const landmarkArea = o.landmark_area || '';

      // Contacts
      const primaryMobileContact = o.offender_contacts.find(c => c.contact_type === 'MOBILE_PRIMARY') || o.offender_contacts.find(c => c.contact_type.startsWith('MOBILE'));
      const primaryMobile = formatMobileForCsv(primaryMobileContact?.value);
      
      const secondaryMobileContact = o.offender_contacts.find(c => c.contact_type === 'MOBILE_SECONDARY');
      const secondaryMobile = formatMobileForCsv(secondaryMobileContact?.value);
      
      const otherContacts = o.offender_contacts
        .filter(c => c.id !== primaryMobileContact?.id && c.id !== secondaryMobileContact?.id)
        .map(c => `${c.contact_type}: ${c.value}${c.notes ? ` (${c.notes})` : ''}`)
        .join('; ');

      // Identity docs
      const aadhaar = o.offender_identity_docs?.[0]?.aadhaar_no;
      const formattedAadhaar = formatAadhaarForCsv(aadhaar);
      const voterId = o.offender_identity_docs?.[0]?.voter_id ? `'${o.offender_identity_docs[0].voter_id}` : '';
      const panCard = o.offender_identity_docs?.[0]?.pan_card ? `'${o.offender_identity_docs[0].pan_card}` : '';

      const photoUrl = o.photo_url || '';
      const testResult = o.test_result || '';
      const riskScore = o.risk_score || '';

      // Drug Profile
      const addictionType = o.offender_drug_profile?.addiction_type || '';
      const consumptionFrequency = o.offender_drug_profile?.consumption_frequency || '';
      const sourceOfProcurement = o.offender_drug_profile?.source_of_procurement || '';
      const modeOfPurchase = o.offender_drug_profile?.mode_of_purchase || '';
      const usualConsumptionSpot = o.offender_drug_profile?.usual_consumption_spot || '';

      // Financials
      const financialDetails = o.offender_financials.map(f => {
        const bank = f.bank_name ? ` (${f.bank_name})` : '';
        const notes = f.notes ? ` - ${f.notes}` : '';
        return `${f.fin_type}: ${f.value}${bank}${notes}`;
      }).join('; ');

      // Supply chain links
      const supplyChainLinks = o.supply_chain_links_supply_chain_links_offender_idTooffenders.map(s => {
        const name = s.linked_person_name ? ` ${s.linked_person_name}` : '';
        const contact = s.linked_person_contact ? ` (${s.linked_person_contact})` : '';
        const notes = s.notes ? ` - ${s.notes}` : '';
        return `${s.link_type}:${name}${contact}${notes}`;
      }).join('; ');

      const totalCases = String(o.case_accused.length);

      // Case history
      const linkedCases = o.case_accused.map(ca => {
        const c = ca.cases;
        if (!c) return '';
        const ps = c.police_stations?.name ? ` in ${c.police_stations.name}` : '';
        const date = c.case_date ? ` on ${new Date(c.case_date).toLocaleDateString('en-IN')}` : '';
        const law = c.section_of_law ? ` (Sec: ${c.section_of_law})` : '';
        return `FIR ${c.fir_no}${ps}${date}${law}`;
      }).filter(Boolean).join('; ');

      // Interrogations
      const interrogationSessions = o.interrogation_sessions.map(s => {
        const date = new Date(s.session_at).toLocaleDateString('en-IN');
        const officer = s.users?.full_name ? ` by ${s.users.full_name}` : '';
        const info = s.source_info ? ` [Source: ${s.source_info}]` : '';
        const notes = s.notes ? `: ${s.notes}` : '';
        return `${date}${officer}${info}${notes}`;
      }).join('; ');

      lines.push(
        [
          slNo,
          fullName,
          alias,
          fatherHusbandName,
          age,
          gender,
          categoryVal,
          statusVal,
          psName,
          district,
          state,
          occupation,
          monthlyIncome,
          fullAddress,
          landmarkArea,
          primaryMobile,
          secondaryMobile,
          otherContacts,
          formattedAadhaar,
          voterId,
          panCard,
          photoUrl,
          testResult,
          riskScore,
          addictionType,
          consumptionFrequency,
          sourceOfProcurement,
          modeOfPurchase,
          usualConsumptionSpot,
          financialDetails,
          supplyChainLinks,
          totalCases,
          linkedCases,
          interrogationSessions
        ]
          .map(csvEscape)
          .join(',')
      );
    }

    await logAudit('EXPORT', 'OFFENDER', null, req, `Exported ${offenders.length} offenders`);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="offenders-${Date.now()}.csv"`);
    res.send('\uFEFF' + lines.join('\n'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Export failed' });
  }
}

export const getOffenderHistorySheet = async (req: Request, res: Response) => {
  try {
    const id = BigInt(String(req.params.id));
    const offender = await prisma.offenders.findUnique({
      where: { id },
      include: {
        police_stations: true,
        offender_contacts: true,
        offender_identity_docs: true,
        case_accused: {
          include: {
            cases: { include: { police_stations: true, seizures: true } },
          },
        },
      },
    });

    if (!offender) return res.status(404).json({ message: 'Offender not found' });

    const timeline = offender.case_accused
      .map((ca) => ca.cases)
      .filter(Boolean)
      .sort((a, b) => (b!.case_date?.getTime() || 0) - (a!.case_date?.getTime() || 0))
      .map((c) => ({
        firNo: c!.fir_no,
        psName: c!.police_stations?.name,
        caseDate: c!.case_date,
        stage: c!.stage,
        sectionOfLaw: c!.section_of_law,
        contrabandType: c!.contraband_type,
        arrestStatus: offender.case_accused.find((ca) => ca.case_id === c!.id)?.arrest_status,
      }));

    res.json({
      generatedAt: new Date().toISOString(),
      offender: {
        fullName: offender.full_name,
        alias: offender.alias,
        fatherHusbandName: offender.father_husband_name,
        age: offender.age,
        category: offender.category,
        address: offender.full_address,
        psName: offender.police_stations?.name,
        mobile: offender.offender_contacts.find((c) => c.contact_type === 'MOBILE_PRIMARY')?.value,
      },
      timeline,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};
