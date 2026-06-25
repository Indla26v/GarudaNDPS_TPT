# Phase 3 — Intelligence Implementation Plan

**Goal:** Implement Technical Surveillance (Page 5), Financial Analysis (Page 6), Network Supply Chain Analysis (Page 7), and advanced Analyst scoping.  
**Last Updated:** 2026-06-23  
**Status:** Planned (Pending Review)

---

## 1. Architectural Philosophy: Simple Input, Heavy Analysis
Front-line officers and field personnel register simple inputs:
- IMEI number logging
- Bank accounts/UPI references
- Network linkages (associates, vehicles, routes)
- Tower dump logs

The backend system performs the heavy lifting by running:
- **Duplicate Mobile Correlations**: Flagging common telephone contacts or IMEIs across distinct case portfolios.
- **Tower Dump Overlap Engine**: Finding intersection sets of device numbers present across multiple crime scene towers during matching timestamps.
- **Financial money flow aggregation**: Constructing transfer matrices between accounts/UPIs.
- **Supply chain link resolution**: Reconstructing hierarchy trees (Supplier -> Transporter -> Peddler -> Consumer) based on co-arrests and intelligence inputs.

---

## 2. CIA (Confidentiality, Integrity, Availability) Level Security

### Confidentiality
- **Attribute Encryption**: Encrypt PII fields (Aadhaar number, Voter ID, PAN, raw telephone numbers) at rest using AES-256.
- **Department Isolation**: 
  - Technical Surveillance (Page 5) restricted to `TECH_CELL` department.
  - Financial Analysis (Page 6) restricted to `FIN_CELL` department.
  - Network Maps (Page 7) visible to `STF`, `ANALYST`, and `SP/ASP` ranks.
- **PII Masking**: Users with the `ANALYST` department see masked PII data (`******4321` and `XXXX-XXXX-XXXX`) by default.
- **Access Audit**: Log `PII_REVEALED` audit log events with timestamp, user ID, and resource identifier.

### Integrity
- **Log Immutability**: Enforce write-only inserts on `audit_logs` table (block updates and deletes at the database level).
- **Edit Locking**: Interrogation sessions, surveillance check-ins, and logged financial transactions become read-only once saved. Modification requires administrative request workflows.

### Availability
- **PWA Offline Queueing**: Capture GPS checks and vehicle Nakabandhi logs offline on mobile, syncing to the server automatically when connection recovers.
- **Redis Query Caching**: Store heavy pre-calculated network graphs in Redis.

---

## 3. Database Schema Extensions

```prisma
// Transaction trails for Financial Cell (Page 6)
model transaction_records {
  id               BigInt            @id @default(autoincrement())
  offender_id      BigInt
  bank_name        String?           @db.VarChar(150)
  account_no       String?           @db.VarChar(50)
  upi_id           String?           @db.VarChar(150)
  transaction_ref  String            @unique @db.VarChar(100)
  amount           Decimal           @db.Decimal(12, 2)
  txn_date         DateTime          @db.Date
  direction        txn_direction     @default(OUTGOING)
  counterparty     String?           @db.VarChar(200)
  notes            String?
  created_at       DateTime          @default(now()) @db.Timestamp(6)

  offenders        offenders         @relation(fields: [offender_id], references: [id], onDelete: Cascade)
}

enum txn_direction {
  INCOMING
  OUTGOING
}

// Tower dump match logs (Page 5)
model tower_match_logs {
  id               BigInt            @id @default(autoincrement())
  case_id          BigInt
  mobile_number    String            @db.VarChar(20)
  latitude         Decimal           @db.Decimal(10, 7)
  longitude        Decimal           @db.Decimal(10, 7)
  hit_time         DateTime          @db.Timestamp(6)
  cell_tower_id    String            @db.VarChar(100)

  cases            cases             @relation(fields: [case_id], references: [id], onDelete: Cascade)
}
```

---

## 4. Backend API Specifications

### 4.1 Page 5 — Technical Surveillance APIs
- `POST /api/surveillance/tower-dump`: Parse and ingest a tower log file.
- `GET /api/surveillance/correlations`: Return overlaps of phone numbers across cases.
- `GET /api/surveillance/tower-intersections`: Return mobile numbers present in multiple selected tower records.

### 4.2 Page 6 — Financial Analysis APIs
- `POST /api/finance/transactions`: Log a transaction.
- `GET /api/finance/flow-map?offenderId=xxx`: Returns network nodes and transfer edges.

### 4.3 Page 7 — Network Graph APIs
- `GET /api/network/visualizer`: Resolve contacts, co-arrests, and supply chains into nodes/edges format.
- `PUT /api/network/links`: Manually create/edit linkages between suspects.

---

## 5. Frontend Visualizations & Tools
- **Technical Surveillance**: Leaflet maps showing surveillance check-in logs and cell tower coverage radii.
- **Financial Flow**: Cytoscape.js or canvas-based layout mapping money flow pipelines.
- **Network Graph**: Full screen force-directed graph (Vis.js / Cytoscape) showing kingpins, peddlers, and vehicles.

---

## 6. Verification & Automated Tests
- Integration tests in `surveillance.analytics.test.ts` (asserts duplicate number correlations).
- Integration tests in `finance.test.ts` (verifies transaction log and flow calculations).
- Integration tests in `network.test.ts` (verifies nodes and edges resolution logic).
