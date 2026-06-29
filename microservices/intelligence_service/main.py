import os
import sys
import logging
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import psycopg2
from psycopg2.extras import RealDictCursor
import networkx as nx
from dotenv import load_dotenv

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("intelligence_service")

# Load environment variables
# Check grandparent (root from microservices/intelligence_service), parent, and current dir
load_dotenv()
load_dotenv(dotenv_path=os.path.join("..", "..", "backend", ".env"))
load_dotenv(dotenv_path=os.path.join("..", "backend", ".env"))
load_dotenv(dotenv_path=os.path.join("backend", ".env"))

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    logger.error("DATABASE_URL environment variable is missing!")

app = FastAPI(
    title="Garuda NDPS Intelligence & Analytics Microservice",
    description="Python FastAPI service handling heavy network graph analysis, correlation detection, and ML risk evaluation.",
    version="1.0.0"
)

# CORS configurations
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db_connection():
    if not DATABASE_URL:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection URL is not configured in environment."
        )
    try:
        # PostgreSQL connection (supports ssl mode out of the box for neon.tech)
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
        return conn
    except Exception as e:
        logger.error(f"Failed to connect to database: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database connection error: {str(e)}"
        )

# Request/Response schemas
class RiskPredictionRequest(BaseModel):
    age: int
    category: str
    addiction_type: Optional[str] = None
    previous_cases_count: int
    contraband_quantity: float

class RiskPredictionResponse(BaseModel):
    risk_score: str
    confidence: float
    factors: List[str]

@app.get("/health")
def health_check():
    db_status = "unconfigured"
    if DATABASE_URL:
        try:
            conn = get_db_connection()
            with conn.cursor() as cur:
                cur.execute("SELECT 1;")
            conn.close()
            db_status = "healthy"
        except Exception as e:
            db_status = f"unhealthy: {str(e)}"
    
    return {
        "status": "ok",
        "service": "Garuda Intelligence Microservice",
        "database": db_status
    }

@app.get("/analytics/network-graph")
def get_network_graph(ps_id: Optional[int] = None):
    """
    Builds an interactive offender network graph using NetworkX.
    Computes PageRank / degree centrality to evaluate who the 'Kingpins' or hubs are.
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # 1. Fetch offenders
            offender_query = """
                SELECT id, full_name, alias, category, risk_score, ps_id 
                FROM offenders
            """
            params = []
            if ps_id:
                offender_query += " WHERE ps_id = %s"
                params.append(ps_id)
            
            cur.execute(offender_query, params)
            offenders_raw = cur.fetchall()
            
            # 2. Fetch supply chain links
            link_query = """
                SELECT offender_id, linked_offender_id, link_type, notes
                FROM supply_chain_links
                WHERE linked_offender_id IS NOT NULL
            """
            cur.execute(link_query)
            links_raw = cur.fetchall()

            # 3. Fetch co-arrest linkages (implicit edges)
            co_arrest_query = """
                SELECT ca1.offender_id AS off1, ca2.offender_id AS off2, c.fir_no
                FROM case_accused ca1
                JOIN case_accused ca2 ON ca1.case_id = ca2.case_id AND ca1.offender_id < ca2.offender_id
                JOIN cases c ON ca1.case_id = c.id
            """
            cur.execute(co_arrest_query)
            co_arrests_raw = cur.fetchall()

        # Build NetworkX Directed Graph
        G = nx.DiGraph()
        
        offenders_dict = {}
        for off in offenders_raw:
            off_id = int(off['id'])
            offenders_dict[off_id] = {
                "id": str(off_id),
                "name": off['full_name'],
                "label": off['alias'] or off['full_name'],
                "category": off['category'] or "Unknown",
                "risk_score": off['risk_score'] or "MEDIUM",
                "ps_id": str(off['ps_id'])
            }
            G.add_node(off_id, **offenders_dict[off_id])
            
        for link in links_raw:
            source = int(link['offender_id'])
            target = int(link['linked_offender_id'])
            link_type = link['link_type']
            
            # Ensure nodes exist in graph
            if source in G and target in G:
                G.add_edge(source, target, type=link_type, notes=link['notes'] or "")

        for co_arr in co_arrests_raw:
            source = int(co_arr['off1'])
            target = int(co_arr['off2'])
            fir_no = co_arr['fir_no']
            
            # Ensure both nodes exist in the graph and no edge already exists
            if source in G and target in G:
                if not G.has_edge(source, target) and not G.has_edge(target, source):
                    G.add_edge(source, target, type="CO_ARREST", notes=f"Co-arrested in FIR {fir_no}")
                    G.add_edge(target, source, type="CO_ARREST", notes=f"Co-arrested in FIR {fir_no}")

        # Compute Centralities
        pagerank_scores = {}
        degree_centrality = {}
        
        if len(G) > 0:
            try:
                pagerank_scores = nx.pagerank(G, alpha=0.85)
            except Exception as pe:
                logger.warning(f"Failed to calculate PageRank: {pe}")
                pagerank_scores = {node: 0.1 for node in G.nodes}
                
            degree_centrality = nx.degree_centrality(G)

        # Build response nodes
        nodes = []
        for node_id in G.nodes:
            node_data = G.nodes[node_id]
            pr = pagerank_scores.get(node_id, 0.0)
            deg = degree_centrality.get(node_id, 0.0)
            
            # Inject calculated metrics
            node_data["pagerank"] = round(pr, 4)
            node_data["centrality"] = round(deg, 4)
            nodes.append(node_data)
            
        # Build response edges
        edges = []
        for source, target, data in G.edges(data=True):
            edges.append({
                "source": str(source),
                "target": str(target),
                "type": data.get("type", "ASSOCIATE"),
                "notes": data.get("notes", "")
            })

        return {
            "nodes": nodes,
            "edges": edges,
            "summary": {
                "total_nodes": len(nodes),
                "total_edges": len(edges),
                "isolated_nodes_count": len(list(nx.isolates(G))) if len(G) > 0 else 0
            }
        }
    except Exception as e:
        logger.error(f"Network graph computation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.get("/analytics/duplicate-contacts")
def get_duplicate_contacts(ps_id: Optional[int] = None):
    """
    Finds telephone numbers or IMEIs linked to multiple offenders (indicative of shared networks/peddlers).
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Check duplicate primary/secondary phone numbers from offender_contacts
            phone_query = """
                SELECT oc.value as contact, COUNT(oc.offender_id) as count, 
                       ARRAY_AGG(oc.offender_id::text) as offender_ids
                FROM offender_contacts oc
                JOIN offenders o ON oc.offender_id = o.id
                WHERE oc.contact_type IN ('MOBILE_PRIMARY', 'MOBILE_SECONDARY')
                  AND oc.value IS NOT NULL AND oc.value != ''
            """
            phone_params = []
            if ps_id:
                phone_query += " AND o.ps_id = %s"
                phone_params.append(ps_id)
            phone_query += """
                GROUP BY oc.value
                HAVING COUNT(oc.offender_id) > 1
            """
            cur.execute(phone_query, phone_params)
            duplicate_phones = cur.fetchall()

            # Check duplicate IMEI numbers
            imei_query = """
                SELECT ir.imei_number, COUNT(ir.offender_id) as count,
                       ARRAY_AGG(ir.offender_id::text) as offender_ids
                FROM imei_records ir
                JOIN offenders o ON ir.offender_id = o.id
                WHERE ir.imei_number IS NOT NULL AND ir.imei_number != ''
            """
            imei_params = []
            if ps_id:
                imei_query += " AND o.ps_id = %s"
                imei_params.append(ps_id)
            imei_query += """
                GROUP BY ir.imei_number
                HAVING COUNT(ir.offender_id) > 1
            """
            cur.execute(imei_query, imei_params)
            duplicate_imeis = cur.fetchall()

            # Fetch offenders details for mapping
            cur.execute("SELECT id, full_name, alias FROM offenders")
            offenders_raw = cur.fetchall()
            offenders_map = {str(o['id']): {"id": str(o['id']), "name": o['full_name'], "alias": o['alias']} for o in offenders_raw}

        # Format Phone duplicates
        phone_results = []
        for row in duplicate_phones:
            linked_offenders = [offenders_map[oid] for oid in row['offender_ids'] if oid in offenders_map]
            phone_results.append({
                "contact": row['contact'],
                "match_count": row['count'],
                "offenders": linked_offenders
            })

        # Format IMEI duplicates
        imei_results = []
        for row in duplicate_imeis:
            linked_offenders = [offenders_map[oid] for oid in row['offender_ids'] if oid in offenders_map]
            imei_results.append({
                "imei": row['imei_number'],
                "match_count": row['count'],
                "offenders": linked_offenders
            })

        return {
            "duplicate_phones": phone_results,
            "duplicate_imeis": imei_results,
            "total_phone_correlations": len(phone_results),
            "total_imei_correlations": len(imei_results)
        }
    except Exception as e:
        logger.error(f"Duplicate contact checking failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.post("/analytics/predict-risk", response_model=RiskPredictionResponse)
def predict_offender_risk(req: RiskPredictionRequest):
    """
    Mock Machine Learning classifier that predicts risk rating of an offender
    based on historical profiles, age, role, and drug amount.
    """
    factors = []
    score = 0.0

    # Age impact
    if 18 <= req.age <= 30:
        score += 1.5
        factors.append("Age between 18 and 30 represents high-risk recruitment bracket")
    elif req.age < 18:
        score += 1.0
        factors.append("Juvenile offender category requires specialty rehabilitation monitoring")

    # Category impact
    if req.category == "KINGPIN":
        score += 5.0
        factors.append("Identified as supply network Kingpin/Financier")
    elif req.category == "LOCAL_SUPPLIER" or req.category == "INTERSTATE_SUPPLIER":
        score += 3.5
        factors.append("Active logistics or wholesale procurement role")
    elif req.category == "PEDDLER":
        score += 2.0
        factors.append("Retail distribution/peddling activity")

    # Previous cases impact
    if req.previous_cases_count >= 5:
        score += 3.0
        factors.append(f"Habitual offender status ({req.previous_cases_count} cases)")
    elif req.previous_cases_count >= 2:
        score += 1.5
        factors.append("Repeat NDPS offender record")

    # Contraband quantity impact
    if req.contraband_quantity > 20.0:  # Commercial quantity threshold in kg typically
        score += 2.5
        factors.append("Commercial quantity contraband involvement")
    elif req.contraband_quantity > 2.0:
        score += 1.0
        factors.append("Intermediate quantity contraband involvement")

    # Risk mapping
    if score >= 6.5:
        risk_score = "HIGH"
        confidence = min(0.70 + (score * 0.03), 0.98)
    elif score >= 3.0:
        risk_score = "MEDIUM"
        confidence = 0.65 + (score * 0.03)
    else:
        risk_score = "LOW"
        confidence = 0.60 + (score * 0.04)

    return RiskPredictionResponse(
        risk_score=risk_score,
        confidence=round(confidence, 2),
        factors=factors
    )

@app.get("/analytics/interstate-routes")
def get_interstate_routes(ps_id: Optional[int] = None):
    """
    Aggregates real case data to build interstate drug route matrix.
    Groups by source_location → destination_location with contraband breakdowns.
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            query = """
                SELECT 
                    source_location,
                    destination_location,
                    contraband_type,
                    COUNT(*) as case_count,
                    COALESCE(SUM(quantity), 0) as total_quantity,
                    COALESCE(SUM(street_value), 0) as total_street_value
                FROM cases
                WHERE source_location IS NOT NULL 
                  AND source_location != ''
                  AND destination_location IS NOT NULL 
                  AND destination_location != ''
            """
            params = []
            if ps_id:
                query += " AND ps_id = %s"
                params.append(ps_id)
            
            query += """
                GROUP BY source_location, destination_location, contraband_type
                ORDER BY case_count DESC
            """
            cur.execute(query, params)
            rows = cur.fetchall()

        routes = []
        for row in rows:
            routes.append({
                "source": row['source_location'],
                "destination": row['destination_location'],
                "contraband_type": row['contraband_type'] or "Unknown",
                "case_count": row['case_count'],
                "total_quantity": float(row['total_quantity']),
                "total_street_value": float(row['total_street_value'])
            })

        return {
            "routes": routes,
            "total_routes": len(routes)
        }
    except Exception as e:
        logger.error(f"Interstate routes query failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.get("/analytics/consignment-trails")
def get_consignment_trails(ps_id: Optional[int] = None):
    """
    Builds consignment trail records by joining cases with seizures and accused persons.
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            query = """
                SELECT 
                    c.id as case_id,
                    c.fir_no,
                    c.case_date,
                    c.contraband_type,
                    c.quantity,
                    c.street_value,
                    c.source_location,
                    c.destination_location,
                    c.stage,
                    ps.name as ps_name,
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
            """
            params = []
            if ps_id:
                query += " AND c.ps_id = %s"
                params.append(ps_id)
            
            query += " ORDER BY c.case_date DESC NULLS LAST LIMIT 100"
            cur.execute(query, params)
            rows = cur.fetchall()

        trails = []
        for row in rows:
            trails.append({
                "case_id": str(row['case_id']),
                "fir_no": row['fir_no'],
                "case_date": row['case_date'].isoformat() if row['case_date'] else None,
                "contraband_type": row['contraband_type'] or "Unknown",
                "quantity": float(row['quantity']) if row['quantity'] else 0,
                "street_value": float(row['street_value']) if row['street_value'] else 0,
                "source": row['source_location'] or "—",
                "destination": row['destination_location'] or "—",
                "stage": row['stage'] or "FIR",
                "ps_name": row['ps_name'],
                "accused_names": row['accused_names'] or []
            })

        return {
            "trails": trails,
            "total_trails": len(trails)
        }
    except Exception as e:
        logger.error(f"Consignment trails query failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.get("/analytics/case-linkage")
def get_case_linkage(ps_id: Optional[int] = None):
    """
    Finds offenders appearing in multiple cases, revealing conspiracy rings.
    Groups by offender and lists all linked cases.
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            query = """
                SELECT 
                    o.id as offender_id,
                    o.full_name,
                    o.alias,
                    o.category,
                    COUNT(DISTINCT ca.case_id) as case_count,
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
            """
            params = []
            if ps_id:
                query += " WHERE c.ps_id = %s"
                params.append(ps_id)
            
            query += """
                GROUP BY o.id, o.full_name, o.alias, o.category
                HAVING COUNT(DISTINCT ca.case_id) > 1
                ORDER BY COUNT(DISTINCT ca.case_id) DESC
            """
            cur.execute(query, params)
            rows = cur.fetchall()

        linkages = []
        for row in rows:
            linkages.append({
                "offender_id": str(row['offender_id']),
                "offender_name": row['full_name'],
                "alias": row['alias'],
                "category": row['category'] or "Unknown",
                "case_count": row['case_count'],
                "linked_cases": row['linked_cases'] or []
            })

        return {
            "linkages": linkages,
            "total_linkages": len(linkages)
        }
    except Exception as e:
        logger.error(f"Case linkage query failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

if __name__ == "__main__":
    import uvicorn
    # Default port for microservice
    uvicorn.run("main:app", host="127.0.0.1", port=8082, reload=True)

