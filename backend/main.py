from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# ── Connection ────────────────────────────────────────────────────────────────

DATABASE_URL = "mysql+pymysql://root:04092006Pm%40@localhost/gpudb"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

app = FastAPI(title="Decentralized GPU Allocation System")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── DB Helpers ────────────────────────────────────────────────────────────────

def get_db():
    return SessionLocal()

def db_fetchall(query: str, params: dict = {}):
    db = get_db()
    try:
        result = db.execute(text(query), params)
        cols = result.keys()
        return [dict(zip(cols, row)) for row in result.fetchall()]
    finally:
        db.close()

def db_fetchone(query: str, params: dict = {}):
    rows = db_fetchall(query, params)
    return rows[0] if rows else None

def db_execute(query: str, params: dict = {}):
    db = get_db()
    try:
        result = db.execute(text(query), params)
        db.commit()
        return result
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()

# ── Pydantic Models ───────────────────────────────────────────────────────────

class RegisterResourceRequest(BaseModel):
    host_id: int
    type: str
    listing_type: str
    region: str
    hourly_cost: float

class AllocationRequest(BaseModel):
    consumer_id: int
    req_type: str
    req_listing_type: str
    duration_hours: int
    selection_mode: str
    preferred_region: Optional[str] = None
    resource_id: Optional[int] = None

class AddCreditsRequest(BaseModel):
    user_id: int
    amount: float

class ReleaseRequest(BaseModel):
    allocation_id: int
    consumer_id: int

class StatusUpdate(BaseModel):
    status: str

# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/users")
def get_users():
    return db_fetchall("SELECT user_id, name, role, region, credit_balance FROM USERS ORDER BY name")

@app.get("/users/{user_id}")
def get_user(user_id: int):
    user = db_fetchone("SELECT * FROM USERS WHERE user_id = :id", {"id": user_id})
    if not user: raise HTTPException(404, "User not found")
    return user

@app.post("/users/{user_id}/add-credits")
def add_credits(user_id: int, req: AddCreditsRequest):
    # Using explicit statements instead of Python-level db_transaction helper
    db = get_db()
    try:
        db.execute(text("UPDATE USERS SET credit_balance = credit_balance + :amt WHERE user_id = :id"), {"amt": req.amount, "id": user_id})
        db.execute(text("INSERT INTO CREDIT_TRANSACTION (user_id, amount, type) VALUES (:uid, :amt, 'Credit')"), {"uid": user_id, "amt": req.amount})
        db.commit()
        return {"message": f"Added {req.amount} credits"}
    except Exception as e:
        db.rollback()
        raise HTTPException(500, str(e))
    finally:
        db.close()

@app.get("/dashboard/stats")
def dashboard_stats():
    # Calling the MySQL View directly
    stats = db_fetchone("SELECT * FROM system_dashboard_stats")
    demand = round((stats["busy_resources"] / max(stats["total_resources"], 1)) * 100, 1)

    region_demand = db_fetchall("""
        SELECT r.region, COUNT(a.allocation_id) AS active_count
        FROM RESOURCE r
        LEFT JOIN ALLOCATION a ON r.resource_id = a.resource_id AND a.status = 'Running'
        GROUP BY r.region ORDER BY active_count DESC
    """)

    recent_allocs = db_fetchall("""
        SELECT a.allocation_id, u.name AS consumer, r.type, r.region, a.start_time, a.total_cost, a.status
        FROM ALLOCATION a
        JOIN REQUEST rq ON a.request_id = rq.request_id
        JOIN USERS u ON rq.consumer_id = u.user_id
        JOIN RESOURCE r ON a.resource_id = r.resource_id
        ORDER BY a.start_time DESC LIMIT 8
    """)

    return {
        "active_allocations": stats["active_allocations"],
        "pending_requests":   stats["pending_requests"],
        "system_demand_pct":  demand,
        "total_users":        stats["total_users"],
        "region_demand":      region_demand,
        "recent_allocations": recent_allocs,
    }

@app.get("/resources")
def list_resources(type: Optional[str] = None, listing_type: Optional[str] = None, region: Optional[str] = None):
    query = """
        SELECT r.resource_id, r.type, r.listing_type, r.region, r.hourly_cost, r.status,
               u.name AS host_name, u.latitude, u.longitude
        FROM RESOURCE r JOIN USERS u ON r.host_id = u.user_id WHERE r.status = 'Available'
    """
    params = {}
    if type: query += " AND r.type = :type"; params["type"] = type
    if listing_type: query += " AND r.listing_type = :lt"; params["lt"] = listing_type
    if region: query += " AND r.region = :region"; params["region"] = region
    query += " ORDER BY r.hourly_cost ASC"
    return db_fetchall(query, params)

@app.post("/allocate")
def allocate_resource(req: AllocationRequest):
    consumer = db_fetchone("SELECT * FROM USERS WHERE user_id = :id", {"id": req.consumer_id})
    if not consumer or consumer["role"] == "Host":
        raise HTTPException(400, "User is not a consumer")

    if req.selection_mode == "Manual" and req.resource_id:
        resource = db_fetchone("""
            SELECT r.*, u.name AS host_name 
            FROM RESOURCE r JOIN USERS u ON r.host_id = u.user_id 
            WHERE r.resource_id = :rid AND r.status = 'Available'
        """, {"rid": req.resource_id})
    else:
        # Native MySQL Spatial calculation
        c_lat = float(consumer.get("latitude") or 0)
        c_lon = float(consumer.get("longitude") or 0)
        resource = db_fetchone("""
            SELECT r.*, u.name AS host_name,
                   (ST_Distance_Sphere(POINT(u.longitude, u.latitude), POINT(:clon, :clat)) / 1000) AS distance_km
            FROM RESOURCE r JOIN USERS u ON r.host_id = u.user_id
            WHERE r.status = 'Available' AND r.type = :rtype AND r.listing_type = :lt
            ORDER BY distance_km ASC LIMIT 1
        """, {"rtype": req.req_type, "lt": req.req_listing_type, "clon": c_lon, "clat": c_lat})

    if not resource:
        raise HTTPException(400, "No available resources matching criteria")

    total_cost = round(float(resource["hourly_cost"]) * req.duration_hours, 2)
    if float(consumer["credit_balance"]) < total_cost:
        raise HTTPException(400, f"Insufficient credits. Need {total_cost:.2f}")

    db = get_db()
    try:
        # Pushing all heavy transaction logic to the Stored Procedure
        db.execute(text("""
            CALL AllocateResource(
                :cid, :rid, :req_type, :req_lt, :dur, :sm, :pref_reg, :cost, @alloc_id
            )
        """), {
            "cid": req.consumer_id, "rid": resource["resource_id"],
            "req_type": req.req_type, "req_lt": req.req_listing_type,
            "dur": req.duration_hours, "sm": req.selection_mode,
            "pref_reg": req.preferred_region, "cost": total_cost
        })
        
        alloc_row = db.execute(text("SELECT @alloc_id AS alloc_id")).fetchone()
        db.commit()
        
        return {
            "message": "Allocated successfully",
            "allocation_id": alloc_row[0],
            "total_cost": total_cost,
            "resource": {"type": resource["type"], "region": resource["region"], "host": resource["host_name"]}
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(500, str(e))
    finally:
        db.close()

@app.post("/release")
def release_allocation(req: ReleaseRequest):
    alloc = db_fetchone("""
        SELECT a.allocation_id, rq.consumer_id
        FROM ALLOCATION a JOIN REQUEST rq ON a.request_id = rq.request_id
        WHERE a.allocation_id = :aid AND a.status = 'Running'
    """, {"aid": req.allocation_id})

    if not alloc: raise HTTPException(404, "Active allocation not found")
    if alloc["consumer_id"] != req.consumer_id: raise HTTPException(403, "Not your allocation")

    # The trg_free_resource_on_complete trigger handles the REQUEST and RESOURCE updates automatically
    db_execute("UPDATE ALLOCATION SET status = 'Completed' WHERE allocation_id = :aid", {"aid": req.allocation_id})
    return {"message": "Released successfully"}

@app.post("/resources")
def register_resource(req: RegisterResourceRequest):
    db_execute("""
        INSERT INTO RESOURCE (host_id, type, listing_type, region, hourly_cost)
        VALUES (:hid, :t, :lt, :reg, :hc)
    """, {"hid": req.host_id, "t": req.type, "lt": req.listing_type, "reg": req.region, "hc": req.hourly_cost})
    return {"message": "Resource registered"}

@app.get("/host/{host_id}/resources")
def host_resources(host_id: int):
    return db_fetchall("SELECT * FROM RESOURCE WHERE host_id = :hid ORDER BY created_at DESC", {"hid": host_id})

@app.get("/host/{host_id}/allocations")
def host_allocations(host_id: int):
    return db_fetchall("""
        SELECT a.allocation_id, a.start_time, a.end_time, a.total_cost, a.status, r.type, r.listing_type, r.region, u.name AS consumer_name
        FROM ALLOCATION a JOIN RESOURCE r ON a.resource_id = r.resource_id JOIN REQUEST rq ON a.request_id = rq.request_id JOIN USERS u ON rq.consumer_id = u.user_id
        WHERE r.host_id = :hid ORDER BY a.start_time DESC
    """, {"hid": host_id})

@app.put("/resources/{resource_id}/status")
def update_resource_status(resource_id: int, body: StatusUpdate):
    if body.status not in ("Available", "Offline"): raise HTTPException(400, "Status must be 'Available' or 'Offline'")
    db_execute("UPDATE RESOURCE SET status = :s WHERE resource_id = :id AND status != 'Busy'", {"s": body.status, "id": resource_id})
    return {"message": "Status updated"}

@app.get("/users/{user_id}/transactions")
def user_transactions(user_id: int):
    return db_fetchall("""
        SELECT ct.trans_id, ct.amount, ct.type, ct.timestamp, ct.allocation_id, r.type AS resource_type, r.region
        FROM CREDIT_TRANSACTION ct LEFT JOIN ALLOCATION a ON ct.allocation_id = a.allocation_id LEFT JOIN RESOURCE r ON a.resource_id = r.resource_id
        WHERE ct.user_id = :uid ORDER BY ct.timestamp DESC
    """, {"uid": user_id})

@app.get("/users/{user_id}/active-allocations")
def user_active_allocations(user_id: int):
    return db_fetchall("""
        SELECT a.allocation_id, a.start_time, a.total_cost, r.type, r.region, r.listing_type
        FROM ALLOCATION a JOIN REQUEST rq ON a.request_id = rq.request_id JOIN RESOURCE r ON a.resource_id = r.resource_id
        WHERE rq.consumer_id = :uid AND a.status = 'Running'
    """, {"uid": user_id})