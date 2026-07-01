# Prompt: Migrate Python FastAPI Microservice to Node.js/Express (TypeScript)

This prompt contains all necessary instructions, algorithms, database queries, and configuration files to migrate the `/microservices/intelligence_service` Python/FastAPI code directly into the existing `/backend` Node.js/Express codebase in TypeScript.

***

### Migration Prompt

```markdown
You are an expert full-stack developer. We want to completely eliminate the Python FastAPI microservice located in `/microservices/intelligence_service` and rewrite all of its analytics logic natively in our existing Node.js/Express backend (`/backend`) in TypeScript. 

This will simplify our architecture, eliminate cold starts, and allow us to deploy a single Node.js backend + React frontend to Vercel.

---

### Step 1: Install Graph Analytics Dependencies in `/backend`
Add the core graph packages to `/backend/package.json` to replace Python's `networkx` library:
```bash
npm install graphology graphology-metrics
```

---

### Step 2: Implement the Intelligence Analytics Service
Create a new service file: `backend/src/services/intelligence.service.ts`.
Use the existing Prisma client (`prisma` from `src/config/prisma`) to run database queries. You can execute raw SQL queries using `prisma.$queryRawUnsafe` to match the exact SQL structure from the Python service.

Implement the following functions in `backend/src/services/intelligence.service.ts`:

#### 1. `calculateNetworkGraph(psId?: number)`
- **Database Queries**:
  - Fetch offenders:
    ```sql
    SELECT id, full_name, alias, category, risk_score, ps_id FROM offenders
    -- (If psId is provided, append: WHERE ps_id = $1)
    ```
  - Fetch supply chain links:
    ```sql
    SELECT offender_id, linked_offender_id, link_type, notes
    FROM supply_chain_links
    WHERE linked_offender_id IS NOT NULL
    ```
  - Fetch co-arrest linkages:
    ```sql
    SELECT ca1.offender_id AS off1, ca2.offender_id AS off2, c.fir_no
    FROM case_accused ca1
    JOIN case_accused ca2 ON ca1.case_id = ca2.case_id AND ca1.offender_id < ca2.offender_id
    JOIN cases c ON ca1.case_id = c.id
    ```
- **Graph Processing**:
  - Construct a directed graph using `graphology`:
    ```typescript
    import DirectedGraph from 'graphology';
    const graph = new DirectedGraph();
    ```
  - Add nodes representing offenders (using fields: `id`, `name`, `label`, `category`, `risk_score`, `ps_id`).
  - Add directed edges for `supply_chain_links`.
  - Add bidirectional edges for co-arrest linkages with type `"CO_ARREST"` and notes `"Co-arrested in FIR <fir_no>"`.
  - Compute **PageRank** and **Degree Centrality** using:
    ```typescript
    import { pagerank } from 'graphology-metrics/centrality/pagerank';
    import { degreeCentrality } from 'graphology-metrics/centrality/degree';
    ```
  - Compute metrics and return:
    - `nodes`: list of nodes containing offender attributes plus their computed `pagerank` and `centrality`.
    - `edges`: list of edges with `source`, `target`, `type`, and `notes`.
    - `summary`: object containing `total_nodes`, `total_edges`, and `isolated_nodes_count`.

#### 2. `checkDuplicateContacts(psId?: number)`
- **Database Queries**:
  - Query primary/secondary phone duplicates:
    ```sql
    SELECT oc.value as contact, COUNT(oc.offender_id) as count, 
           ARRAY_AGG(oc.offender_id::text) as offender_ids
    FROM offender_contacts oc
    JOIN offenders o ON oc.offender_id = o.id
    WHERE oc.contact_type IN ('MOBILE_PRIMARY', 'MOBILE_SECONDARY')
      AND oc.value IS NOT NULL AND oc.value != ''
      -- (If psId is provided: AND o.ps_id = $1)
    GROUP BY oc.value
    HAVING COUNT(oc.offender_id) > 1
    ```
  - Query IMEI duplicates:
    ```sql
    SELECT ir.imei_number, COUNT(ir.offender_id) as count,
           ARRAY_AGG(ir.offender_id::text) as offender_ids
    FROM imei_records ir
    JOIN offenders o ON ir.offender_id = o.id
    WHERE ir.imei_number IS NOT NULL AND ir.imei_number != ''
      -- (If psId is provided: AND o.ps_id = $1)
    GROUP BY ir.imei_number
    HAVING COUNT(ir.offender_id) > 1
    ```
  - Fetch offender mapping details (`SELECT id, full_name, alias FROM offenders`) to replace the IDs in `offender_ids` with full offender objects `{ id, name, alias }`.
- **Return**: `{ duplicate_phones, duplicate_imeis, total_phone_correlations, total_imei_correlations }`

#### 3. `predictOffenderRisk(data: { age: number, category: string, previous_cases_count: number, contraband_quantity: number })`
- Translate the rule-based risk predictor score calculator:
  - Start with score `0.0`.
  - **Age**: Add `1.5` and add factor if age is between 18 and 30. Add `1.0` if age < 18.
  - **Category**: Add `5.0` for `KINGPIN`, `3.5` for `LOCAL_SUPPLIER`/`INTERSTATE_SUPPLIER`, `2.0` for `PEDDLER`.
  - **Previous Cases**: Add `3.0` if >= 5 cases, `1.5` if >= 2 cases.
  - **Contraband Quantity**: Add `2.5` if > 20.0, `1.0` if > 2.0.
  - If score >= `6.5`, risk score is `"HIGH"` and confidence is `Math.min(0.70 + (score * 0.03), 0.98)`.
  - If score >= `3.0`, risk score is `"MEDIUM"` and confidence is `0.65 + (score * 0.03)`.
  - Otherwise, risk score is `"LOW"` and confidence is `0.60 + (score * 0.04)`.
- **Return**: `{ risk_score, confidence, factors }`

#### 4. `getInterstateRoutes(psId?: number)`
- **Database Query**:
  ```sql
  SELECT source_location, destination_location, contraband_type, COUNT(*) as case_count,
         COALESCE(SUM(quantity), 0) as total_quantity, COALESCE(SUM(street_value), 0) as total_street_value
  FROM cases
  WHERE source_location IS NOT NULL AND source_location != ''
    AND destination_location IS NOT NULL AND destination_location != ''
    -- (If psId is provided: AND ps_id = $1)
  GROUP BY source_location, destination_location, contraband_type
  ORDER BY case_count DESC
  ```
- **Return**: `{ routes, total_routes }`

#### 5. `getConsignmentTrails(psId?: number)`
- **Database Query**:
  ```sql
  SELECT c.id as case_id, c.fir_no, c.case_date, c.contraband_type, c.quantity,
         c.street_value, c.source_location, c.destination_location, c.stage, ps.name as ps_name,
         COALESCE(
             (SELECT ARRAY_AGG(DISTINCT o.full_name)
              FROM case_accused ca
              JOIN offenders o ON ca.offender_id = o.id
              WHERE ca.case_id = c.id),
             ARRAY[]::text[]
         ) as accused_names
  FROM cases c
  JOIN police_stations ps ON c.ps_id = ps.id
  WHERE c.contraband_type IS NOT NULL
    -- (If psId is provided: AND c.ps_id = $1)
  ORDER BY c.case_date DESC NULLS LAST LIMIT 100
  ```
- **Return**: `{ trails, total_trails }`

#### 6. `getCaseLinkages(psId?: number)`
- **Database Query**:
  ```sql
  SELECT o.id as offender_id, o.full_name, o.alias, o.category, COUNT(DISTINCT ca.case_id) as case_count,
         ARRAY_AGG(
             JSON_BUILD_OBJECT(
                 'case_id', ca.case_id::text,
                 'fir_no', c.fir_no,
                 'ps_name', ps.name,
                 'case_date', COALESCE(c.case_date::text, ''),
                 'contraband_type', COALESCE(c.contraband_type::text, 'Unknown'),
                 'stage', COALESCE(c.stage::text, 'FIR')
             )
         ) as linked_cases
  FROM case_accused ca
  JOIN offenders o ON ca.offender_id = o.id
  JOIN cases c ON ca.case_id = c.id
  JOIN police_stations ps ON c.ps_id = ps.id
  -- (If psId is provided: WHERE c.ps_id = $1)
  GROUP BY o.id, o.full_name, o.alias, o.category
  HAVING COUNT(DISTINCT ca.case_id) > 1
  ORDER BY COUNT(DISTINCT ca.case_id) DESC
  ```
- **Return**: `{ linkages, total_linkages }`

---

### Step 3: Update the Backend Controllers
Modify `/backend/src/controllers/intelligence.controller.ts` to call the new service methods directly instead of performing `fetch` calls to `http://localhost:8082`. Make sure the controller routes stay the same.

Example refactoring for `/analytics/network-graph`:
```typescript
import * as intelligenceService from '../services/intelligence.service';
import { successResponse } from '../utils/transformers';
import { getDashboardScope, ScopeUser } from '../utils/scope';

export const getNetworkGraph = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user || {};
    const { psFilter } = getDashboardScope(user);
    const psId = psFilter?.ps_id ? Number(psFilter.ps_id) : undefined;

    // Call the new native service directly:
    const data = await intelligenceService.calculateNetworkGraph(psId);
    res.json(successResponse(data));
  } catch (error: any) {
    console.error('[NetworkGraph Controller Error]', error);
    res.status(500).json({ message: 'Failed to fetch network graph analytics: ' + error.message });
  }
};
```
Apply this direct service invocation approach to all intelligence controllers:
- `getNetworkGraph`
- `getDuplicateContacts`
- `predictRisk`
- `getInterstateRoutes`
- `getConsignmentTrails`
- `getCaseLinkages`

---

### Step 4: Simplify Vercel Deployment Configuration
Update the root `/vercel.json` file to completely remove the `@vercel/python` builder configuration. The new version should look like this:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "backend/src/server.ts",
      "use": "@vercel/node"
    },
    {
      "src": "frontend/package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "backend/src/server.ts"
    },
    {
      "src": "/assets/(.*)",
      "dest": "/frontend/assets/$1"
    },
    {
      "src": "/favicon.ico",
      "dest": "/frontend/favicon.ico"
    },
    {
      "src": "/icons.svg",
      "dest": "/frontend/icons.svg"
    },
    {
      "src": "/(.*\\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map)$)",
      "dest": "/frontend/$1"
    },
    {
      "handle": "filesystem"
    },
    {
      "src": "/(.*)",
      "dest": "/frontend/index.html"
    }
  ]
}
```
```
