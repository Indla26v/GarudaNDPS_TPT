# Garuda NDPS — Monitoring & Intelligence Management System

**Client:** Tirupati District Police & Excise Department  
**Project Scope:** Case monitoring, offender tracking, drug distribution analytics, technical surveillance, enforcement checking, and legal tracking (cases from 2016 to 2026).

---

## 1. Project Overview & Features

Garuda is a dedicated web application designed to empower enforcement authorities (Police & Excise Departments) in monitoring NDPS (Narcotic Drugs and Psychotropic Substances) violations in the Tirupati district. The system supports:

- **Interactive Dashboard:** Live KPIs, station-wise data breakdowns, drug seizure analytics, recent alert feeds, and an absconder ticker with real-time Server-Sent Events (SSE) updates.
- **Offender Database:** Detailed profile tracking including biometric/identity indicators (e.g., Aadhaar, Voter ID, PAN with secure audit-logged viewing), case history timelines, interrogation logs, and CSV data export.
- **Case Lifecycle Management:** Advanced tracking from case registration (FIR), seizures, accused listing, to charge-sheet filing, court hearings, and bail records.
- **Enforcement Module:** Categorized field checking and reporting featuring 14 distinct check types (Vehicle Check, Lodge Check, Drunk Driving, Courier Check, Railway Check, Bus Stand Check, Rowdy Sheeter inspections, Bound Over tracking, MV Act, Petty Cases, Palle Nidra, Drone Surveillance, Village Visits, and NDPS Verification). Supports dynamic record matching with the offender database and workflow-based officer reviews.
- **Specialized Analysis Modules:** Dedicated interfaces for Technical Surveillance (IMEI and SIM tracking), Financial Analysis (UPI/bank transaction mapping), Network & Chain Analysis (peddler, transporter, and kingpin mapping), and Field Staff entry logs.
- **District Analytics:** Advanced analytical visualization of seizure metrics and offender categories across stations and divisions for DSP/SP level insights.
- **DPR Excel Import:** Admin pipeline allowing bulk imports of historical Daily Progress Reports (DPR) to populate the system.
- **Workflows:** Robust audit-logged workflow authorization chain (Flagged, Escalated, Requested, Approved, Deleted) for record deletions and edits.

---

## 2. Technology Stack

- **Frontend:** React 19, Vite 8, Tailwind CSS 4, Recharts (for data visualization), React Router DOM 6
- **Backend:** Express 5, TypeScript, tsx (TypeScript execution engine), Server-Sent Events (SSE) for live alerts
- **ORM:** Prisma 5
- **Database:** PostgreSQL (with seeded Excise and Police stations, teams, and sample data)

---

## 3. Directory Structure

```
GarudaNDPS_TPT/
├── backend/                 # Express + TypeScript API
│   ├── prisma/
│   │   ├── schema.prisma   # PostgreSQL database schema (with models for cases, offenders, and 14 check types)
│   │   └── migrations/     # Prisma migration scripts
│   ├── src/
│   │   ├── server.ts        # Route registration and server startup
│   │   ├── config/roles.ts  # Role & permission definitions (RBAC matrix)
│   │   ├── controllers/     # Controllers (auth, cases, dashboard, enforcement, workflows, etc.)
│   │   ├── middleware/      # Auth, authorization, and file upload middlewares
│   │   ├── routes/          # Express route definitions
│   │   └── utils/           # PII masking, scope filtering, and audit logging utilities
│   ├── seed-full.ts         # Database seed script for stations, teams, and test users
│   └── check-db.ts          # Database check & connection script
├── frontend/                # React SPA
│   ├── public/              # Public assets
│   ├── src/
│   │   ├── components/      # UI components (lifecycle panels, charts, layout)
│   │   │   └── enforcement/ # Field check forms (Vehicle Check, Lodge Check, Drunk Drive, etc.)
│   │   ├── pages/           # Feature pages by module
│   │   │   ├── admin/       # Admin tools (users, teams, audit logs, DPR import)
│   │   │   ├── cases/       # Case management, creation, and details
│   │   │   ├── field/       # Field staff entry panel
│   │   │   ├── finance/     # Financial analysis portal
│   │   │   ├── network/     # Network mapping & chain analysis
│   │   │   ├── offenders/   # Offender lists, creation, and profile dashboard
│   │   │   ├── reports/     # Monthly abstract & reports generation
│   │   │   ├── surveillance/# Technical surveillance tracking
│   │   │   ├── vehicles/    # Seized vehicles list
│   │   │   ├── workflows/   # Deletion and edit approval workflows
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Enforcement.jsx
│   │   │   └── DistrictAnalytics.jsx
│   │   ├── context/         # React Auth Context
│   │   ├── hooks/           # Custom hooks (e.g., usePermissions)
│   │   ├── main.jsx         # App router and entrypoint
│   │   └── index.css        # Core stylesheet (custom tokens and styling system)
│   └── vite.config.js       # Vite build and proxy config
└── docs/
    └── NDPS_IMPLEMENTATION_ROADMAP.md  # Detailed implementation roadmap
```

---

## 4. Setup & Running the Application

### Prerequisites
- **Node.js** (v18 or higher recommended)
- **PostgreSQL** (v14 or higher)

### Step 1: Environment Configuration
Create a `.env` file in the `backend/` directory based on the `.env.example` file. Update the database URL with your local PostgreSQL credentials:
```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/postgres?schema=public"
PORT=8081
JWT_SECRET="YOUR_SECURE_JWT_SECRET"
```

### Step 2: Install Dependencies
Run the installation command in both `backend` and `frontend` folders:
```bash
# In backend/
npm install

# In frontend/
npm install
```
*(Note: If script execution is disabled in PowerShell on Windows, you can prepend commands with `cmd /c`.)*

### Step 3: Run Database Migrations & Seed Data
Initialize your PostgreSQL database schemas and populate master stations, test users, and modular data:
```bash
# In backend/
# 1. Run migrations
npx prisma migrate dev

# 2. Seed core master database (Stations, Teams, Roles)
npx tsx seed-full.ts

# 3. Seed modular data (Offenders, Vehicles, Enforcement, and Preventive checks)
npx tsx seed-offenders.ts
npx tsx seed-vehicles.ts
npx tsx seed-enforcement.ts
npx tsx seed-preventive-modules.ts

# 4. Check connectivity & data counts
npx tsx check-db.ts
```

### Step 3b: Available Seeding & Utility Scripts
In the `backend/` directory, several utility scripts are available to initialize or reset database states:
- **`seed-full.ts`**: Seeds master police & excise stations, teams, and default role-based test users.
- **`seed-offenders.ts`**: Seeds historical offender profiles, including identity documents, contact numbers, drug profiles, and financials.
- **`seed-vehicles.ts`**: Seeds sample seized vehicles records linked to cases.
- **`seed-enforcement.ts`**: Seeds initial enforcement check reports.
- **`seed-preventive-modules.ts`**: Seeds 13 types of preventive field checks (Drone surveillance, lodge checks, etc.) distributed across stations and officers.
- **`check-db.ts`**: Performs database check and displays a summary table of database record counts.
- **`check-admin.ts`**: Verifies and prints information about administrator accounts.
- **`clear-offenders.ts`**: Clears historical offender profiles and transactions for clean re-testing.
- **`migrate-roles.ts`**: Quick utility to migrate/update user roles schema in database.


### Step 4: Run Application Servers
Start both the backend API and frontend development servers.

**Start the Backend:**
```bash
# In backend/
npm run dev
# The backend will start on http://localhost:8081
```

**Start the Frontend:**
```bash
# In frontend/
npm run dev
# The frontend will start on http://localhost:3000
```
Vite is configured to automatically proxy API requests from `/api/*` to the backend on `http://localhost:8081`.

---

## 5. Seeded Test Users & Logins

You can log in to the application using the following test credentials seeded via `seed-full.ts` (all passwords are `password123`):

| Role | Username | Password | Department Scope | Station / Division Scope |
|---|---|---|---|---|
| **SP** | `sp` | `password123` | POLICE | District-level Admin (All stations) |
| **ASP** | `asp` | `password123` | POLICE | Narcotics Task Force (District) |
| **SDPO** | `sdpo` | `password123` | POLICE | Renigunta SDPO Division |
| **SHO** | `sho` | `password123` | POLICE | Tirupathi East PS |
| **Constable** | `constable` | `password123` | POLICE | Tirupathi East PS |
| **Cyber SDPO** | `cyber_sdpo` | `password123` | CYBER_ANALYTICS | Cyber Surveillance Unit (Tirupati SDPO Division) |
| **Cyber SHO** | `cyber_sho` | `password123` | CYBER_ANALYTICS | Cyber Surveillance Unit |
| **Excise SHO** | `excise_sho` | `password123` | EXCISE | Excise PS Tirupati Urban |

---

## 6. Architecture & Permissions

### Rank & Department Roles
Permissions are evaluated based on a two-axis matrix:
1. **Rank (`user_role`):** `ADMIN`, `SP`, `ASP`, `SDPO` (DSP equivalent), `SHO` (CI equivalent), `CONSTABLE`
2. **Department (`department_type`):** `POLICE` (includes standard Operations/Administration), `CYBER_ANALYTICS` (Cyber Surveillance), `EXCISE` (Excise circles/stations)

### Row-level Scope Filtering
The system automatically limits data visibility depending on the user's role and assigned jurisdiction:
- **SP/ASP:** Access to all records across the district.
- **SDPO:** Access filtered to cases, offenders, and enforcement checks within their division scope (e.g., Renigunta SDPO).
- **SHO/Constable:** Access filtered to records within their assigned police or excise station (e.g., Tirupathi East PS).
- **SI (Case Officers):** Restricted to viewing and editing cases they personally registered.
- **Cyber / Specialty Cells:** Access filtered by department types (e.g. CYBER_ANALYTICS has tech-cell specific views and permissions).
