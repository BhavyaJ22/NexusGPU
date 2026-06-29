# NexusGPU — Decentralized GPU Allocation System

A full-stack web application that simulates a decentralized GPU marketplace where users can register GPU resources, allocate compute on demand, and manage credit-based transactions.

The platform automatically matches consumers with the nearest available GPU using the **Haversine distance algorithm** while ensuring **ACID-compliant database transactions** for every allocation.

---

## Features

- Automatic GPU allocation using geographic proximity (Haversine Formula)
- Credit-based payment and transaction ledger management
- Host dashboard to register and manage GPU resources
- Role-based access (Consumer / Host / Both)
- Dashboard with platform statistics and activity
- Automatic resource release and availability updates
- Transaction history for every user
- RESTful API built with FastAPI

---

## Tech Stack

### Frontend
- React 18
- Vite
- JavaScript (JSX)
- Custom CSS

### Backend
- Python
- FastAPI
- SQLAlchemy ORM
- SQLite
- Easily configurable for MySQL/PostgreSQL

---

## Project Structure

```text
NexusGPU/
├── backend/
│   ├── main.py
│   └── requirements.txt
│
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       ├── index.css
│       └── components/
│           ├── Dashboard.jsx
│           ├── Marketplace.jsx
│           ├── HostPanel.jsx
│           └── Account.jsx
│
├── README.md
└── .gitignore
```

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/BhavyaJ22/NexusGPU.git
cd NexusGPU
```

---

### 2. Backend Setup

```bash
cd backend

pip install -r requirements.txt

uvicorn main:app --reload --port 8000
```

By default, the application uses **SQLite** and automatically creates:

```
gpu_system.db
```

To use MySQL instead:

```bash
DATABASE_URL=mysql+pymysql://user:password@localhost/gpudb
uvicorn main:app --reload
```

Backend:

```
http://localhost:8000
```

Interactive API Documentation:

```
http://localhost:8000/docs
```

---

### 3. Frontend Setup

```bash
cd frontend

npm install

npm run dev
```

Frontend:

```
http://localhost:5173
```

---

## Database Schema

| Table | Description |
|--------|-------------|
| `USERS` | User profiles, roles, credits, and location |
| `RESOURCE` | GPU resources registered by hosts |
| `REQUEST` | Allocation requests created by consumers |
| `ALLOCATION` | Active and completed allocations |
| `CREDIT_TRANSACTION` | Credit and payment ledger |

---

## System Workflow

### Automatic Allocation

When a consumer selects **Automatic Mode**:

1. Fetch matching available GPU resources.
2. Compute the distance between the consumer and each host using the Haversine Formula.
3. Select the nearest available resource.
4. Reserve the resource.
5. Deduct consumer credits.
6. Credit the host.
7. Record all financial transactions.
8. Return allocation details.

All operations are executed within a single database transaction.

---

## Atomic Transactions

The `/allocate` endpoint performs the following operations atomically:

- Create allocation request
- Create allocation record
- Mark resource as busy
- Debit consumer credits
- Record debit transaction
- Credit the host (90% after platform fee)
- Record host transaction

If any operation fails, the entire transaction is rolled back.

---

## User Roles

### Consumer

- Browse available GPU resources
- Automatic allocation
- Manual allocation
- Manage wallet balance
- View allocation history

### Host

- Register GPU resources
- Toggle resource availability
- Track earnings
- View hosted allocations

### Both

Access to all consumer and host features.

---

## API Endpoints

| Method | Endpoint | Description |
|----------|----------|-------------|
| GET | `/users` | List all users |
| GET | `/users/{id}` | Get user profile |
| POST | `/users/{id}/add-credits` | Add credits |
| GET | `/dashboard/stats` | Platform statistics |
| GET | `/resources` | List available GPU resources |
| POST | `/resources` | Register a new GPU resource |
| POST | `/allocate` | Allocate a resource |
| POST | `/release` | Release an allocation |
| GET | `/host/{id}/resources` | Host resources |
| GET | `/host/{id}/allocations` | Host allocation history |
| PUT | `/resources/{id}/status` | Update resource availability |
| GET | `/users/{id}/transactions` | Transaction history |
| GET | `/users/{id}/active-allocations` | Active allocations |

---

## Seed Data

On first launch, the application automatically initializes sample data, including:

- 8 pre-created users
- 5 global regions
- Multiple GPU resources
- Preloaded credit balances

This allows the complete marketplace workflow to be explored without manual data entry.

---

## Future Improvements

- JWT-based authentication
- Docker support
- Kubernetes deployment
- Payment gateway integration
- GPU benchmarking and analytics
- Real-time notifications using WebSockets

---

## Contributors
- Bhavya
- Manas Singh
- Parth Malik

---
