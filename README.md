# NexusGPU — Decentralized GPU Allocation System

A full-stack university project simulating a decentralized GPU marketplace with
real database transactions, Haversine-based auto-routing, and credit ledger management.

---

## Tech Stack
- **Backend**: Python · FastAPI · SQLAlchemy · SQLite (swap to MySQL/PostgreSQL via env)
- **Frontend**: React 18 · Vite · Custom CSS (no UI library)

---

## Project Structure

```
project/
├── backend/
│   ├── main.py           ← FastAPI app + all endpoints
│   └── requirements.txt
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx           ← Shell, user selector, nav, toasts
        ├── index.css         ← All styles (dark terminal aesthetic)
        └── components/
            ├── Dashboard.jsx    ← Tab 1: KPIs, region load, recent activity
            ├── Marketplace.jsx  ← Tab 2: Resource grid, auto-buy, manual alloc
            ├── HostPanel.jsx    ← Tab 3: Register machines, view earnings
            └── Account.jsx     ← Tab 4: Profile, add credits, ledger
```

---

## Setup & Run

### 1. Backend

```bash
cd backend
pip install -r requirements.txt

# Default: SQLite (auto-created as gpu_system.db)
uvicorn main:app --reload --port 8000

# MySQL: set env before running
DATABASE_URL=mysql+pymysql://user:pass@localhost/gpudb uvicorn main:app --reload
```

API docs auto-generated at: http://localhost:8000/docs

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
```

---

## Database Schema

| Table | Purpose |
|-------|---------|
| `USERS` | All users with role (`Consumer`/`Host`/`Both`), region, geo-coords, credit balance |
| `RESOURCE` | GPU/Supercomputer listings with type, tier (A/B/C), region, hourly rate |
| `REQUEST` | Consumer allocation requests (Automatic/Manual, type, duration) |
| `ALLOCATION` | Active/completed allocations linking Request ↔ Resource |
| `CREDIT_TRANSACTION` | Full debit/credit ledger per user |

---

## Key Features

### Auto-Buy (Haversine Routing)
When mode = `Automatic`, the backend fetches all available matching resources,
computes the great-circle distance between the consumer's lat/lon and each host's
lat/lon using the Haversine formula, and selects the nearest match.

### Atomic Transactions
The `/allocate` endpoint uses a single SQLAlchemy session for:
1. INSERT into REQUEST
2. INSERT into ALLOCATION
3. UPDATE RESOURCE → `Busy`
4. DEDUCT consumer credits
5. LOG debit transaction
6. CREDIT host (90% of total — 10% platform fee)
7. LOG credit transaction

All 7 steps succeed or the entire transaction rolls back.

### Role-Gated UI
- **Consumer**: Marketplace + Account
- **Host**: Host Panel + Account (no marketplace buy buttons)
- **Both**: All 4 tabs with full access

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/users` | List all users |
| GET | `/users/{id}` | Get user profile |
| POST | `/users/{id}/add-credits` | Top up credits |
| GET | `/dashboard/stats` | KPIs + region demand + recent activity |
| GET | `/resources` | Available resources (filterable) |
| POST | `/allocate` | Allocate a resource (auto or manual) |
| POST | `/release` | Release an active allocation |
| POST | `/resources` | Register new host resource |
| GET | `/host/{id}/allocations` | Host's allocation history |
| GET | `/host/{id}/resources` | Host's registered machines |
| PUT | `/resources/{id}/status` | Toggle Available/Offline |
| GET | `/users/{id}/transactions` | Full credit ledger |
| GET | `/users/{id}/active-allocations` | Consumer's running allocations |

---

## Seed Data

8 users auto-created on first run across 5 global regions, each with pre-seeded
resources and credit balances so you can immediately explore the full flow.
