# GARUDA — Project Status & Implementation Roadmap

**Project:** NDPS Accused Monitoring & Intelligence Management System  
**Client:** Tirupati District Police & Excise Department  
**Last Updated:** 2026-06-23  
**Classification:** Official Use Only

---

## 1. Executive Summary

The project is currently in **Phase 1 (~90% complete)** with significant progress into **Phase 2 (Operations)** features. Below is a comprehensive accounting of all requirements extracted from the documentation vs. what is actually implemented in the codebase.

| Phase | Status | Completion |
|-------|--------|------------|
| Phase 0 — Stabilization | ✅ Complete | 100% |
| Phase 1 — Core (Months 1–3) | ⚠️ Nearly Complete | ~90% |
| Phase 2 — Operations (Months 4–5) | 🔶 Partially Started | ~40% |
| Phase 3 — Intelligence (Months 6–8) | 🔴 UI Shells Only | ~10% |
| Phase 4 — Enhancement (Month 9+) | 🔴 Not Started | ~2% |

---

## 2. What Is Implemented (Verified Against Codebase)

### ✅ Authentication & Authorization
- JWT-based login with 8h expiry + refresh tokens (`auth.controller.ts`, `auth.routes.ts`)
- Login lockout: 5 failures → 15 min lockout
- RBAC with rank + department model (`roles.ts`)
- Row-level scoping by PS for CI/SI/DSP/Constable (`scope.ts`)
- District-level access for SP/ASP/ADMIN
- PII masking (Aadhaar) with reveal + audit logging (`pii.ts`)
- NoAccess page for unauthorized access (`NoAccess.jsx`)
- RoleGuard component with department-based checks (`RoleGuard.jsx`)

### ✅ Dashboard (Page 1) — ~85%
- Live KPIs from database (`dashboard.controller.ts` — 17.7 KB)
- Drug type breakdown from `cases.contraband_type`
- Year-wise trend from DB + baseline
- Alert feed + absconder ticker
- PS-wise data breakdown
- Station-level vs district-level scoping
- District Analytics page (`DistrictAnalytics.jsx`)

### ✅ Offender Database (Page 2) — ~80%
- Full CRUD operations (`offenders.controller.ts` — 23 KB, `OffenderForm.jsx` — 70.9 KB)
- Search/filter with scope enforcement (`OffenderList.jsx` — 27.3 KB)
- CSV export (`export.controller.ts` — 11.4 KB)
- Aadhaar mask/reveal with audit trail
- Case history timeline per offender
- Interrogation sessions CRUD (`case_lifecycle.controller.ts`)
- Offender Phase 1 panels (case history, interrogation, supply chain) (`OffenderPhase1Panels.jsx`)
- History sheet (HTML print via `GET /:id/history-sheet`)

### ✅ Case Management (Page 3) — ~85%
- Extended case fields: contraband, quantity, route, intel, department
- Full CRUD + PUT for edit (`cases.controller.ts` — 21 KB)
- Case form with accused search + seizure block (`CaseForm.jsx` — 51 KB)
- Case detail with status timeline (`CaseDetail.jsx` — 19.1 KB)
- Case lifecycle panel: charge sheets, court hearings, bail records (`CaseLifecyclePanel.jsx`)
- CR auto-format `PS-CODE/YEAR/SEQ` on create
- Case management list with filters (`CaseManagement.jsx` — 16.1 KB)

### ✅ Admin Panel (Page 9) — ~75%
- User management (`UserManagement.jsx` — 30.4 KB)
- Team management (`TeamManagement.jsx` — 15.6 KB)
- Audit logs viewer (`AuditLogs.jsx` — 13.3 KB)
- DPR Excel import (`DataImport.jsx` — 28.6 KB, `import.controller.ts` — 29.9 KB)

### ✅ Workflows
- Deletion request approval chain (`deletion.controller.ts`, `deletion.routes.ts`)
- Edit request create/approve/reject with apply-on-approve (`edit_request.controller.ts`)

### ✅ Enforcement Module (NEW — Beyond Original Roadmap)
- Full enforcement checking system (`enforcement.controller.ts` — 85.3 KB!)
- 14 enforcement form types implemented in frontend:
  - NDPS Verification (`NdpsVerificationForm.jsx` — 20.9 KB)
  - Village Visit, Lodge Check, Drunk Drive
  - Courier Check, Railway Check, Bus Stand Check
  - Rowdy Sheeter, Bound Over, Vehicle Check
  - MV Act, Petty Cases, Palle Nidra, Drone Surveillance
- Enforcement summary & user logs API
- SHO+ review workflow for pending checks
- Offender search from enforcement module

### ✅ Vehicles (Seized) Module (NEW — Beyond Original Roadmap)
- Seized vehicles list and detail (`vehicles.controller.ts` — 5.4 KB)
- Vehicle status modal (`VehicleStatusModal.jsx`)
- Vehicles page (`VehiclesSeized.jsx` — 20.1 KB)

### ✅ Reports Module (Page 8) — ~60% (UPGRADED from 10%)
Backend reports API is now **fully implemented** with 9 report types:
- Absconder list report (with CSV export, severity levels, min-days filter)
- Monthly station abstract
- Yearly comparison report (5-year)
- Pending charge sheets (60-day overdue)
- Bail expiry alerts
- Court pending report
- Drug seizures breakdown
- Top repeat offenders
- DPR Export (Excel .xlsx format)
- All reports scoped by user role/station
- **Frontend UI exists** (`Reports.jsx` — 47 KB) — needs verification of wiring to backend

### ✅ Intelligence Module — Basic API
- Intelligence inputs CRUD (`intelligence.controller.ts`, `intelligence.routes.ts`)
- GET/POST for intelligence inputs with scoping
- Linked to offenders and police stations

### ✅ Infrastructure & Real-time
- SSE heartbeat (`sse.controller.ts`, `sse.routes.ts`)
- Absconder alert scheduler (`scheduler.ts`)
- Security headers (X-Content-Type-Options, X-Frame-Options, etc.)
- CORS restriction to known origins
- JSON body size limit (1MB)
- Static uploads with security headers
- Health check & DB warm-up endpoints
- Vercel deployment support (`vercel.json`)

---

## 3. What Needs To Be Implemented

### 🔴 HIGH PRIORITY — Phase 1 Remaining (~10%)

| # | Feature | Source Doc | Current Status | Effort |
|---|---------|-----------|----------------|--------|
| 1.1 | **IMEI Tracking/Register** | Roadmap §1.2, Field Explanation, Ganja Note | No `imei_records` table or API | Medium |
| 1.2 | **PDF History Sheet Export** | Roadmap §1.2 | HTML print only; no PDF engine (puppeteer/pdfkit) | Medium |
| 1.3 | **Divisions Table + DSP Scoping** | Roadmap §6.3 | `division_id` exists as string only; no `divisions` table | Medium |
| 1.4 | **Excise Officer Station Scoping** | Roadmap §1.1 Exit Criteria | Schema ready but no excise user accounts + PS assignment testing | Low |
| 1.5 | **Automated Testing** | Roadmap §10 | No Jest/API tests, no Playwright E2E tests | High |
| 1.6 | **Charge Sheet 60/180-day Overdue Alerts** | Roadmap §1.3, §2.4 | Pending CS report exists, but no automated notification/alert | Medium |
| 1.7 | **Page-level RBAC Matrices per Spec §3-4** | Roadmap §1.1 | Partial — rank+dept enforced, but not full spec matrices | Medium |

---

### 🟡 MEDIUM PRIORITY — Phase 2 Operations

#### 2.1 Reports Enhancement
| # | Feature | Status | Effort |
|---|---------|--------|--------|
| 2.1.1 | **Wire Reports UI to Backend APIs** | Reports.jsx exists (47KB) but needs verification that all 9 report types are connected | Low-Medium |
| 2.1.2 | **Court Diary (Next 7/30 days)** | Not built — query `court_hearings` | Medium |
| 2.1.3 | **Performance Dashboard (SP/DSP station comparison)** | Not built — new page or dashboard tab | Medium |
| 2.1.4 | **Custom Report Builder** | Not built — field/date/station filters | High |
| 2.1.5 | **PDF Report Export** | Only CSV/Excel currently; no PDF generation | Medium |

#### 2.2 Field Staff / Mobile (Page 4)
| # | Feature | Status | Effort |
|---|---------|--------|--------|
| 2.2.1 | **Mobile-Responsive Quick Case Entry** | `FieldStaff.jsx` is a placeholder (3.9 KB) | High |
| 2.2.2 | **GPS Surveillance Report** | No GPS integration yet | High |
| 2.2.3 | **Photo/Video Upload** | Multer exists for Excel; no evidence photo flow | Medium |
| 2.2.4 | **Accused Verification Search (Mobile)** | Not built for mobile field use | Medium |
| 2.2.5 | **Checkpoint / Nakabandhi Log** | Partially covered by enforcement vehicle check forms | Low |
| 2.2.6 | **Informer Module (Restricted)** | No `informers` table or API | High |

#### 2.3 Admin Completion (Page 9)
| # | Feature | Status | Effort |
|---|---------|--------|--------|
| 2.3.1 | **Role Permission UI (Toggle per module)** | Not built | Medium |
| 2.3.2 | **Notification Thresholds Config** | Not built — no config table | Medium |
| 2.3.3 | **System Health Panel** | Not built — active users, DB size, backup info | Medium |
| 2.3.4 | **DPR Generate/Export from System** | ✅ Done — `getDprExport` in reports controller | — |

#### 2.4 Notifications v1
| # | Feature | Status | Effort |
|---|---------|--------|--------|
| 2.4.1 | **In-app Notifications** | SSE exists but no notification dispatch | Medium |
| 2.4.2 | **Charge Sheet Overdue Alerts** | Scheduler exists for absconders; extend for CS | Medium |
| 2.4.3 | **Court Hearing Tomorrow Alert** | Not built | Medium |
| 2.4.4 | **New Case Registered Alert** | Not built | Low |
| 2.4.5 | **Absconder > 30 days Alert** | ✅ Scheduler implemented (`scheduler.ts`) | — |
| 2.4.6 | **SMS Gateway Stub (MSG91/BSNL)** | Not built | Medium |

---

### 🔴 LOW PRIORITY — Phase 3 Intelligence

#### 3.1 Technical Surveillance (Page 5)
| # | Feature | Status | Effort |
|---|---------|--------|--------|
| 3.1.1 | **IMEI Records Table + API** | No table or API | High |
| 3.1.2 | **SIM Swap History** | Not built | Medium |
| 3.1.3 | **Mobile Number Analysis** | Not built | Medium |
| 3.1.4 | **Social Media Intel Logging** | Not built | Medium |
| 3.1.5 | **Intelligence Inputs Full UI** | Basic API exists; `Surveillance.jsx` is a shell (4.3 KB) | Medium |
| 3.1.6 | **Correlation Engine (Duplicate Mobile)** | Not built — SQL views needed | High |
| 3.1.7 | **Geo Map (Leaflet/OSM)** | Not built | High |
| 3.1.8 | **CDR Analysis Module** | Not built | High |
| 3.1.9 | **Telegram/WhatsApp Intelligence Inputs** | Not built | Medium |

#### 3.2 Financial Analysis (Page 6)
| # | Feature | Status | Effort |
|---|---------|--------|--------|
| 3.2.1 | **Transaction Records Table + API** | No table or API | High |
| 3.2.2 | **Financier Flag on Accused** | Not built | Low |
| 3.2.3 | **Asset Seizure Register** | Not built | Medium |
| 3.2.4 | **Money Flow Graph (react-flow/Cytoscape)** | Not built; `FinancialAnalysis.jsx` is a shell (4.1 KB) | High |
| 3.2.5 | **UPI Pattern Analysis** | Not built | Medium |
| 3.2.6 | **Bank Account / Transaction Monitoring** | Not built | High |

#### 3.3 Network & Chain (Page 7)
| # | Feature | Status | Effort |
|---|---------|--------|--------|
| 3.3.1 | **Interactive Network Graph** | Not built; `NetworkMap.jsx` is a shell (5.2 KB) | High |
| 3.3.2 | **Interstate Route Map** | Not built | High |
| 3.3.3 | **Network Clusters (Auto-cluster)** | Not built | High |
| 3.3.4 | **Kingpin Flag + Dossier View** | `risk_score` on offenders exists; no dossier UI | Medium |
| 3.3.5 | **Case Linkage (Shared Networks)** | Not built | High |
| 3.3.6 | **Supply Chain Hierarchy Mapping** | `supply_chain_links` on offender form; no graph API | Medium |

#### 3.4 Advanced Dashboard
| # | Feature | Status | Effort |
|---|---------|--------|--------|
| 3.4.1 | **Analyst View (All Data, PII Masked)** | PII masking exists; no analyst-specific view | Medium |
| 3.4.2 | **Department-specific KPI Views** | Not built | Medium |

---

### 🔴 FUTURE — Phase 4 Enhancement

| # | Feature | Status | Effort |
|---|---------|--------|--------|
| 4.1 | **React Native Mobile App** | Not started | Very High |
| 4.2 | **Offline Queue / Certificate Pinning** | Not started | Very High |
| 4.3 | **Redis Caching** | Not started | Medium |
| 4.4 | **MinIO/S3 Evidence Photos** | Not started | Medium |
| 4.5 | **Docker + Nginx Deployment** | Not started (Vercel only) | Medium |
| 4.6 | **2FA for SP/DSP/Admin** | Not started | Medium |
| 4.7 | **Aadhaar Encryption at Rest (AES-256)** | Not started | Medium |
| 4.8 | **Telugu Localization for Field App** | Not started | Medium |
| 4.9 | **SMS/WhatsApp API Integration** | Not started | Medium |
| 4.10 | **NIC e-Court API** | Not started | Medium |
| 4.11 | **SCRB Cross-check** | Not started | Medium |
| 4.12 | **ED API Integration** | Not started | Low |
| 4.13 | **WCAG 2.1 AA Compliance** | Not started | Medium |
| 4.14 | **Load Test (200 users)** | Not started | Medium |
| 4.15 | **10-year Audit Retention Policy** | Not started | Low |

---

### 🔵 AI-BASED ANALYTICS (from Additional Section doc)

All AI features are **future scope** and not yet implemented:

| # | Feature | Status |
|---|---------|--------|
| AI.1 | Predictive Crime Analytics (Hotspot Prediction) | Not started |
| AI.2 | Repeat Offender Risk Scoring Engine | `risk_score` field exists on offenders; no AI engine |
| AI.3 | Criminal Network & Link Analysis | Not started |
| AI.4 | Geo-Spatial AI Analytics | Not started |
| AI.5 | Behavioral Pattern Analysis | Not started |
| AI.6 | Facial Recognition Integration | Not started (future) |
| AI.7 | Vehicle Intelligence Analytics | Basic seized vehicles module exists |
| AI.8 | Mobile & Communication Intelligence | Not started |
| AI.9 | AI-Based Intelligence Alerts | Not started |
| AI.10 | Social Media Monitoring Analytics | Not started |
| AI.11 | AI Dashboard Widgets | Not started |

---

### 🔵 DPR/SRS Requirements (from Complete DPR Format & Web App Proposal)

| # | Requirement | Status |
|---|-------------|--------|
| DPR.1 | Centralized Accused Database | ✅ Implemented |
| DPR.2 | Case Management (FIR, Arrest, Seizure, CS, Court, Bail) | ✅ Implemented |
| DPR.3 | Surveillance Module (History sheets, Monitoring, Field Reports) | 🔴 Shell only |
| DPR.4 | Intelligence Module (Source inputs, Confidential notes) | 🟡 Basic API only |
| DPR.5 | Search & Analytics (Name, Mobile, Vehicle, FIR, Aadhaar) | ✅ Partially (name, query search works) |
| DPR.6 | Alerts & Notifications (Bail, Repeat, Interstate, Surveillance) | 🟡 Absconder scheduler only |
| DPR.7 | GIS Mapping (Hotspots, Routes, Heatmaps) | 🔴 Not started |
| DPR.8 | User Management & RBAC | ✅ Implemented |
| DPR.9 | Audit Trails | ✅ Implemented |
| DPR.10 | Reports (District-wise, Repeat offenders, Bail monitoring) | 🟡 Backend done, UI wiring needed |
| DPR.11 | Mobile App / PWA | 🔴 Placeholder only |
| DPR.12 | HTTPS/SSL, Encryption | 🟡 Partial (JWT, security headers; no full TLS config) |
| DPR.13 | Integration (CCTNS, GIS, SMS, WhatsApp, Aadhaar) | 🔴 Not started |
| DPR.14 | Photograph Storage per Accused | 🔴 Placeholder URL field only |
| DPR.15 | Vehicle Details per Accused | 🟡 Seized vehicles module exists |
| DPR.16 | Biometrics Integration | 🔴 Not started (future) |

---

### 🔵 Ganja Database Fields (from Google Sheet Proforma)

| # | Field Category | Status |
|---|---------------|--------|
| GS.1 | Basic ID (Sl.No, PS, Name, Test results, Category) | ✅ Offender model covers this |
| GS.2 | Address Details (Full, Landmark, District, State) | ✅ Implemented |
| GS.3 | Contact Details (Mobile 1&2, Siblings, Gmail, Social Media) | ✅ Partial (contacts stored; siblings/social media incomplete) |
| GS.4 | Financial Transaction (UPI ID, Mobile, Bank, IFSC, ATM) | 🟡 `offender_financials` nested exists; UPI/bank fields partial |
| GS.5 | Identity (Aadhaar, Voter ID, PAN) | ✅ Aadhaar implemented with masking; Voter/PAN fields may need addition |
| GS.6 | Socio-Economic Profile (Occupation, Income) | 🟡 May need fields added |
| GS.7 | Drug Consumption Pattern (Addiction type, Frequency, Source) | 🟡 Partial through case fields |
| GS.8 | Drug Supply Chain Mapping | ✅ `supply_chain_links` on offender |
| GS.9 | Purchase Modus Operandi (Mode, Spot) | 🟡 Partial through case fields |
| GS.10 | Criminal History (Previous CR, PS, Sections, Stage) | ✅ Via case history timeline |

---

## 4. Technical Debt & Maintenance

| # | Item | Priority | Status |
|---|------|----------|--------|
| TD.1 | Automated tests (Jest API + Playwright E2E) | High | 🔴 Not started |
| TD.2 | `divisions` table + DSP row-level filter | Medium | 🔴 Not started |
| TD.3 | Aadhaar encryption at rest (AES) | Medium | 🔴 Not started |
| TD.4 | JWT dev fallback string in `auth.middleware.ts` | Low | ⚠️ Still has dev fallback |
| TD.5 | Documentation sync (`walkthrough.md` references old `GarudaNDPC` paths) | Low | ⚠️ Needs update |
| TD.6 | No 2FA | Low | 🔴 Phase 4 |
| TD.7 | Mobile search in offender API | Low | 🔴 Not implemented |

---

## 5. Codebase Statistics (As-Built)

### Backend (`backend/src/`)
| Component | Files | Notable Sizes |
|-----------|-------|---------------|
| Controllers | 17 | `enforcement.controller.ts` (85 KB), `import.controller.ts` (30 KB), `offenders.controller.ts` (23 KB), `cases.controller.ts` (21 KB) |
| Routes | 13 | All major modules have routes |
| Utils | 6 | `scope.ts`, `pii.ts`, `auditLogger.ts`, `scheduler.ts`, `params.ts`, `transformers.ts` |
| Middleware | Auth + Authorize + Upload | JWT authentication + RBAC authorization |

### Frontend (`frontend/src/`)
| Component | Files | Notable Sizes |
|-----------|-------|---------------|
| Pages | 15+ files across 10 directories | `OffenderForm.jsx` (71 KB), `Enforcement.jsx` (60 KB), `CaseForm.jsx` (51 KB), `Reports.jsx` (47 KB), `Dashboard.jsx` (39 KB) |
| Components | 8 + 14 enforcement forms | CaseLifecyclePanel, OffenderPhase1Panels, Layout, RoleGuard, etc. |
| Hooks | `usePermissions.js` | RBAC permission checks |
| Context | `AuthContext.jsx` | JWT auth state management |

### API Routes Mounted (Verified in `server.ts`)
| Prefix | Status |
|--------|--------|
| `/api/auth` | ✅ Mounted |
| `/api/offenders` | ✅ Mounted |
| `/api/dashboard` | ✅ Mounted |
| `/api/police-stations` | ✅ Mounted |
| `/api/cases` | ✅ Mounted |
| `/api/deletion-requests` | ✅ Mounted |
| `/api/edit-requests` | ✅ Mounted |
| `/api/admin` | ✅ Mounted |
| `/api/sse` | ✅ Mounted |
| `/api/enforcement` | ✅ Mounted |
| `/api/vehicles` | ✅ Mounted |
| `/api/reports` | ✅ Mounted |
| `/api/intelligence` | ✅ Mounted |
| `/api/surveillance` | ❌ Not mounted |
| `/api/finance` | ❌ Not mounted |
| `/api/network` | ❌ Not mounted |

---

## 6. Recommended Action Plan

### Immediate Focus (Complete Phase 1)
1. ⬜ Add `divisions` table + DSP division-level scoping
2. ⬜ IMEI register (extend `offender_contacts` or add `imei_records`)
3. ⬜ PDF history sheet export (add puppeteer or pdfkit)
4. ⬜ Set up Jest test framework for critical backend logic
5. ⬜ Verify Reports UI ↔ Backend API wiring

### Next Step (Phase 2 Operations)
1. ⬜ Complete notifications system (extend scheduler, add in-app notifications)
2. ⬜ Court diary report (next 7/30 days hearings)
3. ⬜ Field staff mobile-responsive quick case entry
4. ⬜ Admin role permission toggle UI
5. ⬜ System health panel

### Ongoing
1. ⬜ CI/CD monitoring for both frontend and backend
2. ⬜ Documentation updates (walkthrough references old paths)
3. ⬜ Excise officer account testing with proper PS assignment

---

*Prepared for: Tirupati District Police & Excise Department — GARUDA (GarudaNDPS_TPT)*
