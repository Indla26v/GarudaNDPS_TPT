# Garuda NDPS — Monitoring & Intelligence Management System

**Client:** Tirupati District Police & Excise Department  
**Project Scope:** Case monitoring, offender tracking, drug distribution analytics, technical surveillance, and legal tracking (cases from 2016 to 2026).

---

## 1. Project Overview & Features

Garuda is a dedicated web application designed to empower enforcement authorities (Police & Excise Departments) in monitoring NDPS (Narcotic Drugs and Psychotropic Substances) violations in the Tirupati district. The system supports:

- **Interactive Dashboard:** Live KPIs, station-wise data breakdowns, drug seizure analytics, recent alert feeds, and an absconder ticker.
- **Offender Database:** Detailed profile tracking including biometric/identity indicators (e.g., Aadhaar with secure audit-logged viewing), case history timelines, interrogation logs, and CSV data export.
- **Case Lifecycle Management:** Advanced tracking from case registration (FIR), seizures, accused listing, to charge-sheet filing, court hearings, and bail records.
- **DPR Excel Import:** Admin pipeline allowing bulk imports of historical Daily Progress Reports (DPR) to populate the system.
- **Workflows:** Robust audit-logged workflow authorization for record deletions and edits.

---

## 2. Technology Stack

- **Frontend:** React 19, Vite 8, Tailwind CSS 4, Recharts (for data visualization)
- **Backend:** Express 5, TypeScript, tsx (TypeScript execution engine)
- **ORM:** Prisma 5
- **Database:** PostgreSQL (with seeded Excise and Police stations, teams, and sample data)

---

## 3. Directory Structure

```
GarudaNDPS_TPT/
├── backend/                 # Express + TypeScript API
│   ├── prisma/
│   │   ├── schema.prisma   # database schema
│   │   └── migrations/     # migrations folder
│   ├── src/
│   │   ├── server.ts        # route registration and server startup
│   │   ├── config/roles.ts  # role & permission definitions
│   │   ├── controllers/     # business logic for auth, cases, dashboard, etc.
│   │   ├── middleware/      # auth + file upload middlewares
│   │   ├── routes/          # Express route definitions
│   │   └── utils/           # PII masking, scope filtering, auditing
│   ├── seed-full.ts         # database seed script
│   └── check-db.ts          # database check script
├── frontend/                # React SPA
│   ├── public/              # public assets
│   ├── src/
│   │   ├── components/      # UI components (lifecycle panels, charts, layout)
│   │   ├── pages/           # main screens (admin, offenders, dashboard, cases)
│   │   ├── context/         # React Auth Context
│   │   ├── hooks/           # custom hooks (e.g., usePermissions)
│   │   └── main.jsx         # App router and entrypoint
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
Create a `.env` file in the `backend/` directory based on the `.env.example` file. For local development, update the database URL with your credentials:
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
Initialize your PostgreSQL database schemas and populate master stations and test users:
```bash
# In backend/
# 1. Run migrations
npx prisma migrate dev

# 2. Seed database
npx tsx seed-full.ts

# 3. Check connectivity & data counts
npx tsx check-db.ts
```

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
| **SDPO** | `sdpo` | `password123` | POLICE | Tirupati East Division / PS |
| **SHO** | `sho` | `password123` | POLICE | Tirupati East PS |
| **Constable** | `constable` | `password123` | POLICE | Tirupati East PS |
| **Cyber SDPO** | `cyber_sdpo` | `password123` | CYBER_ANALYTICS | Cyber Surveillance Unit (District) |
| **Cyber SHO** | `cyber_sho` | `password123` | CYBER_ANALYTICS | Cyber Surveillance Unit |
| **Excise SHO** | `excise_sho` | `password123` | EXCISE | Excise PS Tirupati Urban |

---

## 6. Architecture & Permissions

### Rank & Department Roles
Permissions are evaluated based on a two-axis matrix:
1. **Rank (`user_role`):** `ADMIN`, `SP`, `ASP`, `SDPO` (DSP equivalent), `SHO` (CI equivalent), `CONSTABLE`
2. **Department (`department_type`):** `ADMINISTRATION`, `OPERATIONS`, `INTELLIGENCE`, `FIN_CELL`, `TECH_CELL`, `ANALYST`, `LEGAL`, `STF`, `CYBER_ANALYTICS`, `EXCISE`

### Row-level Scope Filtering
The system automatically limits data visibility depending on the user's role:
- **SP/ASP/Cyber SDPO:** Access to all records across the district.
- **SDPO/SHO/Constable:** Access filtered to cases/offenders within their assigned police or excise station.
- **SI (Case Officers):** Restricted to viewing and editing cases they personally created.
