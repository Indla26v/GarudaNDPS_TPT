# Phase 1 Completion — Implementation Plan

**Goal:** Bring Phase 1 from ~90% → 100%  
**Estimated Effort:** ~5–7 working days  
**Last Updated:** 2026-06-23  
**Reference:** `status_report.md`, `NDPS_IMPLEMENTATION_ROADMAP.md`

---

## Overview

Phase 1 has 7 remaining tasks. This document details **what** to build, **where** to change files, **how** to implement, and **how** to verify — for each one.

| # | Task | Priority | Effort | Dependencies |
|---|------|----------|--------|-------------|
| 1 | [IMEI Tracking Register](#1-imei-tracking-register) | High | 1.5 days | Schema migration |
| 2 | [PDF History Sheet Export](#2-pdf-history-sheet-export) | High | 1 day | npm package |
| 3 | [Divisions Table + DSP Scoping](#3-divisions-table--dsp-scoping) | High | 1 day | Schema migration |
| 4 | [Charge Sheet Overdue Alerts](#4-charge-sheet-overdue-alerts) | Medium | 0.5 day | Scheduler exists |
| 5 | [Excise Officer Station Scoping](#5-excise-officer-station-scoping) | Medium | 0.5 day | Seed data |
| 6 | [Page-level RBAC Matrix Completion](#6-page-level-rbac-matrix-completion) | Medium | 0.5 day | roles.ts exists |
| 7 | [Automated Testing Setup](#7-automated-testing-setup) | High | 1.5 days | npm packages |

```mermaid
gantt
  title Phase 1 Completion Timeline
  dateFormat YYYY-MM-DD
  section Schema
  IMEI Register (schema + API + UI)   :t1, 2026-06-24, 2d
  Divisions Table + DSP scoping       :t3, after t1, 1d
  section Features
  PDF History Sheet                   :t2, 2026-06-24, 1d
  Charge Sheet Alerts                 :t4, after t2, 1d
  Excise Scoping                      :t5, after t3, 1d
  RBAC Matrix                         :t6, after t5, 1d
  section Testing
  Automated Testing Setup             :t7, after t4, 2d
```

---

## 1. IMEI Tracking Register

### What
Track IMEI numbers associated with offenders' mobile devices. Each offender can have multiple IMEI records with SIM swap history. This is referenced in the Roadmap §1.2 (Page 2 — Offender Database) and the DPR field explanations doc under "Mobile & Communication Intelligence".

### Current State
- `offender_contacts` table stores mobile numbers but **no IMEI field**
- No `imei_records` table exists in `schema.prisma`
- No API endpoints for IMEI CRUD
- `OffenderForm.jsx` has contacts section but no IMEI fields

### Implementation

#### 1.1 Schema — Add `imei_records` model

**File:** [schema.prisma](file:///c:/Projects/GarudaNDPS_TPT/backend/prisma/schema.prisma)

Add after the `offender_contacts` model (line ~134):

```prisma
model imei_records {
  id            BigInt    @id @default(autoincrement())
  offender_id   BigInt
  imei_number   String    @db.VarChar(20)
  device_make   String?   @db.VarChar(100)
  device_model  String?   @db.VarChar(100)
  sim_number    String?   @db.VarChar(30)
  sim_provider  String?   @db.VarChar(100)
  mobile_number String?   @db.VarChar(20)
  status        imei_status @default(ACTIVE)
  first_seen    DateTime  @default(now()) @db.Timestamp(6)
  last_seen     DateTime? @db.Timestamp(6)
  notes         String?
  created_by    BigInt?
  created_at    DateTime  @default(now()) @db.Timestamp(6)

  offenders     offenders @relation(fields: [offender_id], references: [id], onDelete: Cascade, onUpdate: NoAction)
  users         users?    @relation("imei_created_by", fields: [created_by], references: [id], onDelete: NoAction, onUpdate: NoAction)

  @@index([offender_id], map: "idx_imei_offender")
  @@index([imei_number], map: "idx_imei_number")
  @@index([mobile_number], map: "idx_imei_mobile")
}

enum imei_status {
  ACTIVE
  SWAPPED
  DEACTIVATED
  SUSPICIOUS
}
```

Also add the reverse relation to the `offenders` model (line ~179):
```prisma
imei_records  imei_records[]
```

And to the `users` model (line ~428):
```prisma
imei_records_created  imei_records[]  @relation("imei_created_by")
```

#### 1.2 Migration

```bash
cd backend
npx prisma db push
# OR create a formal migration:
npx prisma migrate dev --name add_imei_records
npx prisma generate
```

#### 1.3 Backend API — IMEI Controller

**File [NEW]:** `backend/src/controllers/imei.controller.ts`

```typescript
import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { successResponse } from '../utils/transformers';
import { logAudit } from '../utils/auditLogger';

// GET /api/offenders/:offenderId/imei
export const getImeiRecords = async (req: Request, res: Response) => {
  try {
    const offenderId = BigInt(req.params.offenderId);
    const records = await prisma.imei_records.findMany({
      where: { offender_id: offenderId },
      orderBy: { created_at: 'desc' },
    });
    const data = records.map(r => ({
      id: r.id.toString(),
      imeiNumber: r.imei_number,
      deviceMake: r.device_make,
      deviceModel: r.device_model,
      simNumber: r.sim_number,
      simProvider: r.sim_provider,
      mobileNumber: r.mobile_number,
      status: r.status,
      firstSeen: r.first_seen,
      lastSeen: r.last_seen,
      notes: r.notes,
    }));
    res.json(successResponse(data));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch IMEI records' });
  }
};

// POST /api/offenders/:offenderId/imei
export const createImeiRecord = async (req: Request, res: Response) => {
  try {
    const offenderId = BigInt(req.params.offenderId);
    const userId = (req as any).user?.userId ? BigInt((req as any).user.userId) : null;
    const { imeiNumber, deviceMake, deviceModel, simNumber, simProvider, mobileNumber, notes } = req.body;

    if (!imeiNumber || imeiNumber.length < 15) {
      return res.status(400).json({ message: 'Valid IMEI number (15 digits) is required' });
    }

    const record = await prisma.imei_records.create({
      data: {
        offender_id: offenderId,
        imei_number: imeiNumber,
        device_make: deviceMake || null,
        device_model: deviceModel || null,
        sim_number: simNumber || null,
        sim_provider: simProvider || null,
        mobile_number: mobileNumber || null,
        notes: notes || null,
        created_by: userId,
      },
    });

    await logAudit('CREATE', 'IMEI_RECORD', record.id, req, 
      `IMEI ${imeiNumber} linked to offender #${offenderId}`);

    res.status(201).json(successResponse({ id: record.id.toString() }, 'IMEI record added'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to create IMEI record' });
  }
};

// PUT /api/offenders/:offenderId/imei/:id  (update status e.g. SWAPPED)
export const updateImeiRecord = async (req: Request, res: Response) => {
  try {
    const id = BigInt(req.params.id);
    const { status, lastSeen, notes } = req.body;

    const updated = await prisma.imei_records.update({
      where: { id },
      data: {
        status: status || undefined,
        last_seen: lastSeen ? new Date(lastSeen) : undefined,
        notes: notes !== undefined ? notes : undefined,
      },
    });

    await logAudit('UPDATE', 'IMEI_RECORD', id, req, `IMEI status → ${status}`);
    res.json(successResponse({ id: updated.id.toString() }));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to update IMEI record' });
  }
};
```

#### 1.4 Backend Routes

**File [MODIFY]:** [offenders.routes.ts](file:///c:/Projects/GarudaNDPS_TPT/backend/src/routes/offenders.routes.ts)

Add at the end, before `export default router;`:

```typescript
import { getImeiRecords, createImeiRecord, updateImeiRecord } from '../controllers/imei.controller';

router.get('/:offenderId/imei', getImeiRecords);
router.post('/:offenderId/imei', createImeiRecord);
router.put('/:offenderId/imei/:id', updateImeiRecord);
```

#### 1.5 Frontend — IMEI Tab in Offender Panels

**File [MODIFY]:** [OffenderPhase1Panels.jsx](file:///c:/Projects/GarudaNDPS_TPT/frontend/src/components/OffenderPhase1Panels.jsx)

Add a new `ImeiPanel` component that:
- Fetches `GET /api/offenders/:id/imei` on mount
- Displays IMEI records in a table (IMEI No, Device, SIM, Provider, Mobile, Status)
- Has an "Add IMEI" form with fields: imeiNumber (15 digits), deviceMake, deviceModel, simNumber, simProvider, mobileNumber
- Status badges: ACTIVE (green), SWAPPED (amber), DEACTIVATED (gray), SUSPICIOUS (red)
- PUT to update status (dropdown to mark as SWAPPED/DEACTIVATED)

Add a new tab `{ label: 'IMEI Register', key: 'imei' }` to the existing tabs array.

### Verification
- [ ] Create an offender, go to edit → IMEI tab → add IMEI → verify it appears in the list
- [ ] Update IMEI status to SWAPPED → verify badge changes
- [ ] Audit log records IMEI creation with details
- [ ] Search offender by mobile → the IMEI-linked mobile should be queryable

---

## 2. PDF History Sheet Export

### What
Currently `GET /offenders/:id/history-sheet` returns JSON data for the history sheet. There is a print button that renders HTML in the browser. We need to add a **PDF download** endpoint that generates a formatted PDF server-side.

### Current State
- [export.controller.ts](file:///c:/Projects/GarudaNDPS_TPT/backend/src/controllers/export.controller.ts) — `getOffenderHistorySheet` (line 258) returns JSON
- Frontend has a print-via-browser mechanism
- No PDF generation library installed

### Implementation

#### 2.1 Install PDF Library

```bash
cd backend
npm install pdfkit @types/pdfkit
```

> **Why pdfkit over puppeteer:** pdfkit is lightweight (~2MB), has no browser dependency (works on Vercel), and generates vector PDFs. Puppeteer is 100MB+ and requires a Chromium binary.

#### 2.2 PDF Generator Utility

**File [NEW]:** `backend/src/utils/pdfHistorySheet.ts`

```typescript
import PDFDocument from 'pdfkit';

interface HistorySheetData {
  offender: {
    fullName: string;
    alias?: string;
    fatherHusbandName?: string;
    age?: number;
    category?: string;
    address?: string;
    psName?: string;
    mobile?: string;
  };
  timeline: Array<{
    firNo: string;
    psName?: string;
    caseDate?: Date | string;
    stage?: string;
    sectionOfLaw?: string;
    contrabandType?: string;
    arrestStatus?: string;
  }>;
  generatedAt: string;
}

export function generateHistorySheetPdf(data: HistorySheetData): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  // Header
  doc.fontSize(16).font('Helvetica-Bold')
     .text('GARUDA — NDPS History Sheet', { align: 'center' });
  doc.fontSize(9).font('Helvetica')
     .text('Tirupati District Police & Excise Department', { align: 'center' });
  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.5);

  // Offender Details
  const o = data.offender;
  doc.fontSize(12).font('Helvetica-Bold').text('Offender Details');
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica');
  
  const detailRows = [
    ['Full Name', o.fullName || '—'],
    ['Alias', o.alias || '—'],
    ['Father/Husband', o.fatherHusbandName || '—'],
    ['Age', o.age ? `${o.age} Yrs` : '—'],
    ['Category', o.category || '—'],
    ['Police Station', o.psName || '—'],
    ['Address', o.address || '—'],
    ['Mobile', o.mobile || '—'],
  ];

  for (const [label, value] of detailRows) {
    doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
    doc.font('Helvetica').text(value);
  }

  doc.moveDown(1);

  // Case Timeline Table
  doc.fontSize(12).font('Helvetica-Bold').text('Case History Timeline');
  doc.moveDown(0.5);

  if (data.timeline.length === 0) {
    doc.fontSize(10).font('Helvetica').text('No cases on record.');
  } else {
    // Table header
    const tableTop = doc.y;
    const colWidths = [60, 80, 70, 80, 100, 70];
    const headers = ['FIR No', 'PS', 'Date', 'Stage', 'Section', 'Arrest'];
    
    doc.fontSize(8).font('Helvetica-Bold');
    let xPos = 50;
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], xPos, tableTop, { width: colWidths[i] });
      xPos += colWidths[i];
    }

    doc.moveTo(50, tableTop + 12).lineTo(545, tableTop + 12).stroke();

    // Table rows
    doc.font('Helvetica').fontSize(8);
    let y = tableTop + 16;

    for (const row of data.timeline) {
      if (y > 750) { // page break
        doc.addPage();
        y = 50;
      }
      xPos = 50;
      const vals = [
        row.firNo || '—',
        row.psName || '—',
        row.caseDate ? new Date(row.caseDate).toLocaleDateString('en-IN') : '—',
        row.stage || '—',
        row.sectionOfLaw || '—',
        row.arrestStatus || '—',
      ];
      for (let i = 0; i < vals.length; i++) {
        doc.text(vals[i], xPos, y, { width: colWidths[i] });
        xPos += colWidths[i];
      }
      y += 14;
    }
  }

  // Footer
  doc.moveDown(2);
  doc.fontSize(8).font('Helvetica')
     .text(`Generated: ${data.generatedAt}`, { align: 'right' });
  doc.text('GARUDA — Confidential', { align: 'right' });

  return doc;
}
```

#### 2.3 Add PDF Endpoint to Export Controller

**File [MODIFY]:** [export.controller.ts](file:///c:/Projects/GarudaNDPS_TPT/backend/src/controllers/export.controller.ts)

Add a new export at the end:

```typescript
import { generateHistorySheetPdf } from '../utils/pdfHistorySheet';

export const getOffenderHistorySheetPdf = async (req: Request, res: Response) => {
  try {
    const id = BigInt(String(req.params.id));
    const offender = await prisma.offenders.findUnique({
      where: { id },
      include: {
        police_stations: true,
        offender_contacts: true,
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

    const data = {
      generatedAt: new Date().toISOString(),
      offender: {
        fullName: offender.full_name,
        alias: offender.alias || undefined,
        fatherHusbandName: offender.father_husband_name || undefined,
        age: offender.age || undefined,
        category: offender.category || undefined,
        address: offender.full_address || undefined,
        psName: offender.police_stations?.name || undefined,
        mobile: offender.offender_contacts.find((c) => c.contact_type === 'MOBILE_PRIMARY')?.value,
      },
      timeline,
    };

    await logAudit('EXPORT', 'OFFENDER', id, req, `PDF history sheet exported for ${offender.full_name}`);

    const doc = generateHistorySheetPdf(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="history-sheet-${offender.full_name.replace(/\s/g, '_')}.pdf"`);
    doc.pipe(res);
    doc.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to generate PDF' });
  }
};
```

#### 2.4 Add Route

**File [MODIFY]:** [offenders.routes.ts](file:///c:/Projects/GarudaNDPS_TPT/backend/src/routes/offenders.routes.ts)

```typescript
import { getOffenderHistorySheetPdf } from '../controllers/export.controller';

router.get('/:id/history-sheet-pdf', getOffenderHistorySheetPdf);
```

#### 2.5 Frontend — Add PDF Download Button

**File [MODIFY]:** [OffenderPhase1Panels.jsx](file:///c:/Projects/GarudaNDPS_TPT/frontend/src/components/OffenderPhase1Panels.jsx)

In the History Sheet tab/panel, add alongside the existing Print button:

```jsx
<button
  className="btn btn-sm"
  onClick={() => {
    window.open(`${API_BASE}/offenders/${offenderId}/history-sheet-pdf`, '_blank');
  }}
  style={{ background: '#ef4444', color: '#fff', borderColor: '#ef4444' }}
>
  ⬇ Download PDF
</button>
```

### Verification
- [ ] Navigate to offender detail → History Sheet tab → click "Download PDF"
- [ ] PDF opens in browser with correct offender details and case timeline table
- [ ] PDF footer shows generation timestamp and GARUDA branding
- [ ] Audit log records the PDF export event

---

## 3. Divisions Table + DSP Scoping

### What
Currently `users.division_id` exists as a plain `String?` field (line 437 in schema). The SDPO (DSP equivalent) role already has scoping logic in [scope.ts](file:///c:/Projects/GarudaNDPS_TPT/backend/src/utils/scope.ts) (lines 34–38, 64–68, 93–97) that filters by `police_stations.sdpo` matching `user.divisionId`. 

The `police_stations` table already has an `sdpo` field (line 309). What's missing is a **proper `divisions` table** to formalize this and ensure SDPO assignment is validated.

### Current State
- `police_stations.sdpo` — `String?` field exists, some stations may have values from seed
- `users.division_id` — `String?` field exists
- `scope.ts` — SDPO scoping already works by matching `police_stations.sdpo === user.divisionId`
- No `divisions` table for managing SDPO/division assignments

### Implementation

#### 3.1 Schema — Add `divisions` model

**File [MODIFY]:** [schema.prisma](file:///c:/Projects/GarudaNDPS_TPT/backend/prisma/schema.prisma)

```prisma
model divisions {
  id         BigInt   @id @default(autoincrement())
  name       String   @unique @db.VarChar(200)
  code       String   @unique @db.VarChar(20)
  district   String   @default("Tirupati") @db.VarChar(100)
  sdpo_name  String?  @db.VarChar(200)
  is_active  Boolean  @default(true)
  created_at DateTime @default(now()) @db.Timestamp(6)

  @@index([district], map: "idx_div_district")
}
```

#### 3.2 Seed Divisions Data

**File [MODIFY]:** `backend/seed-full.ts`

Add division seeding based on Tirupati district organizational structure:

```typescript
const DIVISIONS = [
  { name: 'Tirupati Urban', code: 'TPT-URBAN' },
  { name: 'Tirupati Rural', code: 'TPT-RURAL' },
  { name: 'Chandragiri', code: 'CHANDRAGIRI' },
  { name: 'Srikalahasti', code: 'SRIKALAHASTI' },
  { name: 'Sullurpeta', code: 'SULLURPETA' },
  { name: 'Gudur', code: 'GUDUR' },
];

for (const div of DIVISIONS) {
  await prisma.divisions.upsert({
    where: { code: div.code },
    update: {},
    create: { name: div.name, code: div.code, district: 'Tirupati' },
  });
}
```

#### 3.3 Update Police Stations Seed

Update `seed-full.ts` to assign `sdpo` values to police stations, matching division codes:

```typescript
// Example: Assign police stations to divisions
await prisma.police_stations.updateMany({
  where: { name: { in: ['I Town PS', 'II Town PS', 'III Town PS'] } },
  data: { sdpo: 'TPT-URBAN' },
});
```

#### 3.4 Admin UI — Division Management

**File [MODIFY]:** [UserManagement.jsx](file:///c:/Projects/GarudaNDPS_TPT/frontend/src/pages/admin/UserManagement.jsx)

When creating/editing an SDPO user, show a **Division dropdown** (fetched from `GET /api/admin/divisions` or a simple static list) that sets `divisionId` on the user record. This ensures that when an SDPO logs in, their `divisionId` is populated in the JWT, and `scope.ts` can filter by `police_stations.sdpo`.

#### 3.5 Verify SDPO Token Contains divisionId

**File [VERIFY]:** [auth.controller.ts](file:///c:/Projects/GarudaNDPS_TPT/backend/src/controllers/auth.controller.ts)

Check that the JWT payload includes `divisionId` from the user record. If not, add it:

```typescript
const payload = {
  userId: user.id.toString(),
  role: user.role,
  department: user.department,
  policeStationId: user.police_station_id?.toString() || null,
  district: user.district || null,
  divisionId: user.division_id || null,  // ← Ensure this line exists
};
```

### Verification
- [ ] Run seed → divisions table has 6 entries
- [ ] Police stations have `sdpo` assigned correctly
- [ ] Create an SDPO user with `divisionId = 'TPT-URBAN'`
- [ ] Login as SDPO → dashboard shows only cases from stations with `sdpo = 'TPT-URBAN'`
- [ ] Offender list is also filtered by the SDPO's division stations

---

## 4. Charge Sheet Overdue Alerts

### What
Generate automated alerts when a case is past 60 days (or 180 days for special cases) from FIR date without a charge sheet filed. The absconder scheduler infrastructure already exists in [scheduler.ts](file:///c:/Projects/GarudaNDPS_TPT/backend/src/utils/scheduler.ts).

### Current State
- `scheduler.ts` runs `checkAbsconderAlerts()` every 6 hours
- `reports.controller.ts` has `getPendingChargeSheetsReport` (line 246) that queries cases with `stage = 'FIR'` and `case_date < 60 days ago`
- No automated charge sheet alert exists
- SSE broadcast infrastructure exists via `broadcastEvent()`

### Implementation

#### 4.1 Add Charge Sheet Alert Check to Scheduler

**File [MODIFY]:** [scheduler.ts](file:///c:/Projects/GarudaNDPS_TPT/backend/src/utils/scheduler.ts)

Add a new function after `checkAbsconderAlerts()`:

```typescript
async function checkChargeSheetAlerts() {
  try {
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const pendingCases = await prisma.cases.findMany({
      where: {
        stage: 'FIR',
        case_date: { lt: sixtyDaysAgo },
      },
      include: {
        police_stations: { select: { name: true } },
      },
      orderBy: { case_date: 'asc' },
    });

    const alerts = pendingCases.map(c => {
      const daysPending = c.case_date
        ? Math.floor((Date.now() - new Date(c.case_date).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      return {
        caseId: c.id.toString(),
        firNo: c.fir_no,
        psName: c.police_stations?.name || '?',
        daysPending,
        severity: daysPending > 180 ? 'CRITICAL' : daysPending > 90 ? 'HIGH' : 'MEDIUM',
      };
    });

    if (alerts.length > 0) {
      broadcastEvent('chargesheet_overdue_alerts', {
        count: alerts.length,
        criticalCount: alerts.filter(a => a.severity === 'CRITICAL').length,
        topAlerts: alerts.slice(0, 20),
        checkedAt: new Date().toISOString(),
      });

      console.log(
        `[Scheduler] CS overdue check: ${alerts.length} cases pending >60 days`
      );
    }
  } catch (error) {
    console.error('[Scheduler] CS overdue check failed:', error);
  }
}
```

Add call to `startAbsconderAlertScheduler()` (rename to `startAlertScheduler` or add `checkChargeSheetAlerts()` alongside the existing absconder check):

```typescript
setTimeout(() => {
  checkAbsconderAlerts();
  checkChargeSheetAlerts();  // ← Add this
}, 10000);

intervalHandle = setInterval(() => {
  checkAbsconderAlerts();
  checkChargeSheetAlerts();  // ← Add this
}, intervalMs);
```

#### 4.2 Dashboard — Show CS Overdue Alert

**File [MODIFY]:** [Dashboard.jsx](file:///c:/Projects/GarudaNDPS_TPT/frontend/src/pages/Dashboard.jsx)

Listen for SSE events of type `chargesheet_overdue_alerts` and display an alert card in the dashboard alert feed section:

```jsx
// In the SSE event listener
if (event.type === 'chargesheet_overdue_alerts') {
  setChargeSheetAlerts(event.data);
}
```

Add a banner or card:
```jsx
{chargeSheetAlerts?.count > 0 && (
  <div className="card p-4 rounded-xl border-l-4 border-amber-500">
    <h4 className="text-sm font-bold text-amber-400">
      ⚠ {chargeSheetAlerts.count} Cases Pending Charge Sheet >60 days
    </h4>
    <p className="text-xs text-slate-400 mt-1">
      {chargeSheetAlerts.criticalCount} critical (>180 days)
    </p>
  </div>
)}
```

### Verification
- [ ] Seed a case with `case_date` > 60 days ago and `stage = 'FIR'`
- [ ] Wait for scheduler tick (or manually call `checkChargeSheetAlerts()`)
- [ ] SSE event is broadcast
- [ ] Dashboard shows the CS overdue alert card

---

## 5. Excise Officer Station Scoping

### What
Ensure that users assigned to Excise-type police stations (`station_type = 'EXCISE'`) only see data from Excise stations. The schema is ready — `police_stations.station_type` exists with `POLICE | EXCISE` enum.

### Current State
- `police_stations` has `station_type` (line 308 in schema)
- 12 Excise PS seeded (from `seed-full.ts`)
- Scope filters work by `ps_id` for station-level users
- No Excise-specific demo user accounts exist for testing

### Implementation

#### 5.1 Add Excise Test Users to Seed

**File [MODIFY]:** `backend/seed-full.ts`

```typescript
// Find an Excise station to assign
const excisePS = await prisma.police_stations.findFirst({
  where: { station_type: 'EXCISE' },
});

if (excisePS) {
  await prisma.users.upsert({
    where: { username: 'excise_si' },
    update: {},
    create: {
      username: 'excise_si',
      password_hash: await bcrypt.hash('password123', 10),
      full_name: 'Excise SI Demo',
      role: 'SHO',
      department: 'EXCISE',
      police_station_id: excisePS.id,
      district: 'Tirupati',
    },
  });
}
```

#### 5.2 Verify Scoping Works

Login as `excise_si` → the user should only see:
- Offenders with `ps_id` matching the Excise station
- Cases with `ps_id` matching the Excise station
- Dashboard KPIs scoped to their Excise station

**No code changes needed in `scope.ts`** — the existing PS-level scoping handles this automatically because Excise users are assigned to an Excise-type station.

#### 5.3 Optional: Excise Department Filter on Dashboard

If the SP/ASP wants to filter dashboard by `station_type`, add a filter toggle:

**File [MODIFY]:** [dashboard.controller.ts](file:///c:/Projects/GarudaNDPS_TPT/backend/src/controllers/dashboard.controller.ts)

Accept an optional `stationType` query parameter:

```typescript
const stationType = req.query.stationType as string | undefined;
if (stationType) {
  psFilter.police_stations = {
    ...psFilter.police_stations,
    station_type: stationType as any,
  };
}
```

### Verification
- [ ] Run seed → `excise_si` user created with Excise PS assignment
- [ ] Login as `excise_si` → only Excise station data visible
- [ ] Login as SP → can see both Police and Excise data
- [ ] Dashboard "EXCISE" filter (if added) shows only Excise station KPIs

---

## 6. Page-level RBAC Matrix Completion

### What
The spec §3–4 defines detailed page-level access matrices. The current [roles.ts](file:///c:/Projects/GarudaNDPS_TPT/backend/src/config/roles.ts) and [usePermissions.js](file:///c:/Projects/GarudaNDPS_TPT/frontend/src/hooks/usePermissions.js) have a good permission system but are missing a few granular controls mentioned in the spec.

### Current State
- `roles.ts` has 27 permission keys covering all 9 pages
- `usePermissions.js` mirrors these exactly
- Backend `authorize.middleware.ts` enforces `requirePermission()`
- Missing: `DELETE_OFFENDER`, `IMPORT_DATA`, `VEHICLE_VIEW`, `VEHICLE_EDIT` specific permissions

### Implementation

#### 6.1 Add Missing Permission Keys

**File [MODIFY]:** [roles.ts](file:///c:/Projects/GarudaNDPS_TPT/backend/src/config/roles.ts)

Add to the `PERMISSIONS` object:

```typescript
// Offender deletion (separate from edit)
OFFENDER_DELETE:      { minRole: 'SP' },

// Data import
IMPORT_DATA:          { minRole: 'SP' },

// Vehicles (Seized)
VEHICLE_VIEW:         { minRole: 'CONSTABLE' },
VEHICLE_EDIT:         { minRole: 'SHO' },

// Intelligence module
INTEL_VIEW:           { minRole: 'SHO' },
INTEL_CREATE:         { minRole: 'SHO' },

// Excise-specific (EXCISE department can access their own station's core pages)
EXCISE_OFFENDER_VIEW: { minRole: 'CONSTABLE', departments: ['EXCISE'] },
EXCISE_CASE_VIEW:     { minRole: 'CONSTABLE', departments: ['EXCISE'] },
```

#### 6.2 Mirror in Frontend

**File [MODIFY]:** [usePermissions.js](file:///c:/Projects/GarudaNDPS_TPT/frontend/src/hooks/usePermissions.js)

Add matching entries in `PERM_MAP`:

```javascript
OFFENDER_DELETE:     () => role === 'SP',
IMPORT_DATA:         () => role === 'SP',
VEHICLE_VIEW:        () => hasMinRole('CONSTABLE'),
VEHICLE_EDIT:        () => hasMinRole('SHO'),
INTEL_VIEW:          () => hasMinRole('SHO'),
INTEL_CREATE:        () => hasMinRole('SHO'),
```

Add convenience shortcuts:

```javascript
canDeleteOffender: role === 'SP',
canImportData: role === 'SP',
canViewVehicles: hasMinRole('CONSTABLE'),
canEditVehicles: hasMinRole('SHO'),
canViewIntel: hasMinRole('SHO'),
canCreateIntel: hasMinRole('SHO'),
```

#### 6.3 Apply Permission Guards on Routes

**File [MODIFY]:** [admin.routes.ts](file:///c:/Projects/GarudaNDPS_TPT/backend/src/routes/admin.routes.ts)

Ensure import route uses `requirePermission('IMPORT_DATA')`.

**File [MODIFY]:** [vehicles.routes.ts](file:///c:/Projects/GarudaNDPS_TPT/backend/src/routes/vehicles.routes.ts)

Already has `requirePermission('EDIT_RECORDS')` — update to `requirePermission('VEHICLE_EDIT')` for consistency.

### Verification
- [ ] Constable can view vehicles but not edit
- [ ] Only SP can access import functionality
- [ ] SHO can create intelligence inputs
- [ ] Constable cannot access intelligence module
- [ ] Frontend sidebar items respect new permission keys

---

## 7. Automated Testing Setup

### What
Set up Jest for backend API tests and optionally Playwright for frontend E2E. Focus on critical paths: auth, scope, offender CRUD, case lifecycle.

### Current State
- No testing framework installed
- No test files exist
- `package.json` has no test script

### Implementation

#### 7.1 Install Dependencies

```bash
cd backend
npm install -D jest ts-jest @types/jest supertest @types/supertest
```

#### 7.2 Jest Configuration

**File [NEW]:** `backend/jest.config.ts`

```typescript
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterSetup: ['<rootDir>/src/__tests__/setup.ts'],
  testTimeout: 15000,
};

export default config;
```

#### 7.3 Test Setup

**File [NEW]:** `backend/src/__tests__/setup.ts`

```typescript
// Global test setup — import prisma mock or test DB connection
import dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });

// Increase timeout for DB-connected tests
jest.setTimeout(15000);
```

#### 7.4 Core Test Files

**File [NEW]:** `backend/src/__tests__/auth.test.ts`

Test cases:
- Login with valid credentials → 200 + JWT
- Login with wrong password → 401
- Login lockout after 5 failures → 423
- Access protected route without token → 401
- Access protected route with expired token → 403

**File [NEW]:** `backend/src/__tests__/scope.test.ts`

Test cases (unit tests for `scope.ts`):
- `getCaseWhere` for SP → returns empty (all access)
- `getCaseWhere` for SHO with ps_id → returns `{ ps_id: BigInt(X) }`
- `getCaseWhere` for SDPO with divisionId → returns subdivision filter
- `getDashboardScope` for SP → `isStationLevel = false`
- `getDashboardScope` for SHO → `isStationLevel = true`

**File [NEW]:** `backend/src/__tests__/offenders.test.ts`

Test cases (integration tests using supertest):
- GET /api/offenders → 200 with array
- POST /api/offenders with valid data → 201
- GET /api/offenders/:id → 200 with offender details
- GET /api/offenders/export → CSV file response
- Scope enforcement: SHO can only see their PS offenders

**File [NEW]:** `backend/src/__tests__/cases.test.ts`

Test cases:
- POST /api/cases → creates case with CR auto-format
- GET /api/cases/:id → returns case with accused and seizures
- PUT /api/cases/:id → updates case fields
- Case lifecycle: charge sheet → court hearing → bail record

#### 7.5 Package.json Script

**File [MODIFY]:** `backend/package.json`

```json
{
  "scripts": {
    "test": "jest --runInBand --forceExit",
    "test:watch": "jest --watch --runInBand",
    "test:coverage": "jest --coverage --runInBand --forceExit"
  }
}
```

#### 7.6 Environment for Tests

**File [NEW]:** `backend/.env.test`

```env
DATABASE_URL="postgresql://user:pass@localhost:5432/garuda_test"
JWT_SECRET="test-secret-key-for-testing-only"
```

### Verification
- [ ] `npm test` runs without errors
- [ ] scope.test.ts passes all unit tests
- [ ] Auth tests verify login, lockout, and JWT validation
- [ ] Coverage report shows >70% on `scope.ts`, `auth.controller.ts`

---

## Exit Criteria (Phase 1 → 100%)

When all 7 tasks are complete, verify these final exit criteria from the roadmap:

- [x] SP views district dashboard with live DB data *(already done)*
- [x] Full case lifecycle fields capturable *(already done)*
- [x] Excel DPR import succeeds *(already done)*
- [ ] **IMEI record can be added and queried per offender** *(Task 1)*
- [ ] **PDF history sheet downloads correctly** *(Task 2)*
- [ ] **SDPO sees only their division's stations** *(Task 3)*
- [ ] **Charge sheet overdue alerts fire via scheduler** *(Task 4)*
- [ ] **Excise officer sees only Excise station data** *(Task 5)*
- [ ] **All page-level permissions enforced** *(Task 6)*
- [ ] **`npm test` passes with >70% coverage on core utils** *(Task 7)*
- [x] Interrogation session saved and linked to accused *(already done)*

---

## File Change Summary

| Action | File | Task |
|--------|------|------|
| **MODIFY** | `backend/prisma/schema.prisma` | 1, 3 |
| **NEW** | `backend/src/controllers/imei.controller.ts` | 1 |
| **MODIFY** | `backend/src/routes/offenders.routes.ts` | 1, 2 |
| **MODIFY** | `frontend/src/components/OffenderPhase1Panels.jsx` | 1, 2 |
| **NEW** | `backend/src/utils/pdfHistorySheet.ts` | 2 |
| **MODIFY** | `backend/src/controllers/export.controller.ts` | 2 |
| **MODIFY** | `backend/seed-full.ts` | 3, 5 |
| **MODIFY** | `backend/src/utils/scheduler.ts` | 4 |
| **MODIFY** | `frontend/src/pages/Dashboard.jsx` | 4 |
| **MODIFY** | `backend/src/config/roles.ts` | 6 |
| **MODIFY** | `frontend/src/hooks/usePermissions.js` | 6 |
| **MODIFY** | `backend/src/routes/admin.routes.ts` | 6 |
| **MODIFY** | `backend/src/routes/vehicles.routes.ts` | 6 |
| **NEW** | `backend/jest.config.ts` | 7 |
| **NEW** | `backend/src/__tests__/setup.ts` | 7 |
| **NEW** | `backend/src/__tests__/auth.test.ts` | 7 |
| **NEW** | `backend/src/__tests__/scope.test.ts` | 7 |
| **NEW** | `backend/src/__tests__/offenders.test.ts` | 7 |
| **NEW** | `backend/src/__tests__/cases.test.ts` | 7 |
| **NEW** | `backend/.env.test` | 7 |
| **MODIFY** | `backend/package.json` | 7 |

**Total: 10 new files, 12 modified files**

---

*Prepared for: Tirupati District Police & Excise Department — GARUDA (GarudaNDPS_TPT)*
