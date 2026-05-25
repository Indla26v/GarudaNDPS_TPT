# Walkthrough: Role & Department Access Control Fix

## Summary

Fixed the role and department implementation so that:
- **Station-level roles** (DSP, CI, SI, Constable) see data **only** for their allotted Police Station
- **District-level roles** (SP, ASP) see all police station data, but are **restricted to their allotted department** for Intelligence module access
- Pages dynamically show only the content the user is allowed to see
- Unauthorized access shows a styled **NoAccess page**

---

## Changes Made

### Backend (3 files)

#### [scope.ts](file:///c:/Projects/GarudaNDPC/backend/src/utils/scope.ts)
- **Fixed SI scope bug**: SI users were incorrectly scoped by `created_by` (only their own created cases). Now scoped by `ps_id` like other station-level roles.
- **Added `getDashboardScope()`**: Returns `{ psFilter, isStationLevel }` for dashboard query scoping.
- **Added `department` to `ScopeUser` interface**.

#### [dashboard.controller.ts](file:///c:/Projects/GarudaNDPC/backend/src/controllers/dashboard.controller.ts)
- **All queries now scoped by police station** for station-level users:
  - KPI counts (`totalCases`, `totalArrests`, `totalAbsconders`, etc.)
  - Seizure aggregations
  - Year-wise trend charts
  - Drug type breakdown
  - Case stage distribution
  - Recent alerts and absconder tickers
- **`psWiseData`**: Station-level users get only their station; district-level gets all stations.
- **Returns `isStationLevel` flag** so the frontend knows whether to show "Tirupati District" or the station name.

#### [roles.ts](file:///c:/Projects/GarudaNDPC/backend/src/config/roles.ts)
- **Removed SP/ASP blanket bypass**: Previously SP/ASP skipped department checks entirely. Now only ADMIN bypasses all checks. SP/ASP must have a matching department for Intelligence pages.

---

### Frontend (7 files)

#### [usePermissions.js](file:///c:/Projects/GarudaNDPC/frontend/src/hooks/usePermissions.js)
- **Removed the SP/ASP blanket override** (old line 39 gave SP/ASP access to everything except admin).
- SP/ASP now go through the same `PERM_MAP` checks as everyone else.
- Department-restricted permissions (`FIELD_ENTRY`, `TECH_VIEW_ALL`, `FIN_VIEW_ALL`, `NET_VIEW_ALL`) now enforce department for ALL roles.
- Added `isStationLevel` and `isDistrictLevel` flags.

#### [NoAccess.jsx](file:///c:/Projects/GarudaNDPC/frontend/src/pages/NoAccess.jsx) — **NEW**
- Full-page styled "Access Restricted" screen.
- Shows animated lock icon, user's current role and department.
- "Go to Dashboard" and "Go Back" navigation buttons.
- Consistent with GARUDA dark theme.

#### [RoleGuard.jsx](file:///c:/Projects/GarudaNDPC/frontend/src/components/RoleGuard.jsx)
- Added `departments` prop for standalone department checks.
- Now renders `<NoAccess />` instead of inline "Access Denied" text.

#### [Layout.jsx](file:///c:/Projects/GarudaNDPC/frontend/src/components/Layout.jsx)
- **Removed `hasMinRole('SP')` / `hasMinRole('DSP')` / `hasMinRole('CI')` fallbacks** that gave higher-rank officers blanket sidebar access to Intelligence items regardless of department.
- Sidebar now shows items **only** when the user has the correct department.
- **Added department badge** next to role badge in the header (e.g., "SP | Ops").

#### [main.jsx](file:///c:/Projects/GarudaNDPC/frontend/src/main.jsx)
- **Added `RoleGuard` to Field Staff route** (was unguarded).
- **Added `RoleGuard` to Reports route**.
- Added `/no-access` route.
- Added catch-all `*` route → NoAccess page.

#### [FieldStaff.jsx](file:///c:/Projects/GarudaNDPC/frontend/src/pages/field/FieldStaff.jsx)
- Fixed invalid permission keys: `ACCUSED_VERIFY` → `FIELD_VERIFY`, `SURVEILLANCE_REPORT` → `FIELD_ENTRY`.
- Fixed informer tab to use valid permission check.

#### [Dashboard.jsx](file:///c:/Projects/GarudaNDPC/frontend/src/pages/Dashboard.jsx)
- Dynamic subtitle: shows station name for station-level users, "Tirupati District" for district-level.
- Station-wise chart and PS table only shown when `psWiseData.length > 1` (district-level with multiple stations).

---

## Access Matrix (After Fix)

| Page | SP (Ops) | DSP (Tech) | SI (Ops) | SI (FinCell) | Constable (Ops) |
|------|----------|------------|----------|--------------|-----------------|
| Dashboard | ✅ All PS | ✅ Own PS | ✅ Own PS | ✅ Own PS | ✅ Own PS |
| Offenders | ✅ All PS | ✅ Own PS | ✅ Own PS | ✅ Own PS | ✅ Own PS |
| Cases | ✅ All PS | ✅ Own PS | ✅ Own PS | ✅ Own PS | ✅ Own PS |
| Field Staff | ❌ NoAccess | ❌ NoAccess | ✅ | ❌ NoAccess | ✅ |
| Surveillance | ❌ NoAccess | ✅ | ❌ NoAccess | ❌ NoAccess | ❌ NoAccess |
| Financial | ❌ NoAccess | ❌ NoAccess | ❌ NoAccess | ✅ | ❌ NoAccess |
| Network Map | ❌ NoAccess | ✅ | ❌ NoAccess | ❌ NoAccess | ❌ NoAccess |
| Reports | ✅ | ✅ | ✅ | ✅ | ❌ NoAccess |
| District Analytics | ✅ | ❌ NoAccess | ❌ NoAccess | ❌ NoAccess | ❌ NoAccess |

---

## Verification

- ✅ Backend type check: No new TypeScript errors from changes
- ✅ Frontend build: Successful (`✓ built in 396ms`, 657 modules)
