# ShopFinder — Commercial Property Marketplace & SaaS

ShopFinder is a full-stack commercial property marketplace and lead-generation SaaS platform that connects commercial shop and space owners with prospective business tenants and buyers.

---

## 1. Project Overview

### Purpose & Business Model
- **Marketplace Discovery:** Search and discover commercial properties (shops, offices, retail spaces, warehouses) for rent or sale across cities and commercial hubs.
- **Owner Listings:** Property owners publish and manage listings with images, specifications, pricing, and locations. Listing submission is free at initial launch.
- **Customer Lead Generation:** Customers discover properties and unlock direct owner contact information using **contact reveal credits**.
- **Subscription Credit Packages:**
  - **Starter Plan:** ৳299 for 10 contact reveal credits.
  - **Pro Plan:** ৳999 for 100 contact reveal credits.
  - Each contact reveal costs exactly **1 credit**. Once revealed, a listing's contact details remain unlocked indefinitely for that customer at zero additional cost.
- **Platform Governance:** Administrative dashboard for listing moderation (approval/rejection workflows), user management, subscription tracking, and platform oversight.

### Primary User Roles
| Role | Identifier | Capabilities |
|---|---|---|
| **Customer** | `customer` | Browse approved listings, save favorites, purchase credit packages, reveal owner contact details. |
| **Owner** | `owner` | Submit and manage property listings, upload images, track listing inquiries. (Listing creation is free at launch). |
| **Admin** | `admin` | Review and moderate listings (approve/reject), manage platform users, inspect payments and credit balances. |

---

## 2. Architecture & Design Principles

ShopFinder is built upon a 3-tier architecture with strict boundary enforcement and security isolation:

```text
┌─────────────────────────────────┐
│     React 18 Frontend (Vite)     │  Port 5173 (Development)
│  (Pure JS, Tailwind, shadcn/ui) │
└────────────────┬────────────────┘
                 │
                 │ HTTP / CORS with Credentials (SameSite=Strict httpOnly Cookies)
                 ▼
┌─────────────────────────────────┐
│     Express.js Backend API      │  Port 4000 (Development)
│   (Auth, Proxy, Business Logic) │
└────────────────┬────────────────┘
                 │
                 │ Private Loopback Connection (Admin SDK / Superuser Token)
                 ▼
┌─────────────────────────────────┐
│       PocketBase Backend        │  Port 8090 (Strictly Internal: 127.0.0.1)
│    (Database, Auth, Storage)    │  Data: %LOCALAPPDATA%\ShopFinder\pb_data\
└─────────────────────────────────┘
```

### Approved Technical Decisions

- **D-007: Client Never Communicates Directly with PocketBase**  
  The React frontend communicates exclusively with the Express backend API. PocketBase operates as an internal database service on `127.0.0.1:8090` and is never exposed directly to browser clients. All database operations are mediated and authorized by Express.
- **D-010: httpOnly Cookie Authentication & Origin CSRF Protection**  
  Authentication tokens are stored exclusively in server-set `httpOnly` cookies named `pb_auth` (`SameSite=Strict`, `Secure` in production, `path=/`). JavaScript running in the browser cannot read the token, mitigating XSS attacks. State-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) are protected by an Origin/Referer check against the authorized `CLIENT_URL`. Tokens are never stored in `localStorage` and are never accepted via request bodies or URL query parameters.
- **D-013: Atomic Contact Reveal via `$app.runInTransaction()` (Phase 10)**  
  Contact reveals and credit deductions will be executed as a single, indivisible SQLite ACID transaction within a server-side JavaScript hook (`pocketbase/pb_hooks/reveal.pb.js`). All reads/writes inside the hook use the transaction handle (`txApp`). A database-level unique constraint on `(customer, listing)` in `revealed_contacts` ensures duplicate credit deductions are architecturally impossible.
- **D-014: Phone Number Segregation in `owner_contacts`**  
  Owner phone numbers are stored exclusively in a dedicated, private `owner_contacts` collection and are completely absent from the `users` collection. Direct client access to `owner_contacts` is denied at the PocketBase rule level; phone numbers are only returned through the authenticated reveal endpoint.
- **D-015: External `pb_data` Directory Outside OneDrive**  
  To prevent SQLite database corruption, journal locking, and sync collisions caused by cloud file sync on Windows OneDrive, PocketBase runtime data (`pb_data/`) is stored completely outside the workspace in the local user application directory: `%LOCALAPPDATA%\ShopFinder\pb_data\`.

### Current Implementation vs. Planned Functionality
- **Phase 1 (Current):** Foundational infrastructure — Git repository initialization, Express backend scaffolding with Helmet, CORS, centralized error handling, Zod 4 environment validation, React 18 frontend scaffolding with Vite, Express security & cookie infrastructure (D-010), and PocketBase v0.40.6 binary configuration with external `pb_data` (D-015).
- **Phases 2–14 (Planned):** Database collections and access rules (Phase 2), Authentication endpoints & JWT verification (Phase 3), UI system & Tailwind/shadcn components (Phase 4), Marketplace & listings (Phase 5), Owner module (Phase 6), Admin panel (Phase 7), Customer module (Phase 8), Subscriptions (Phase 9), Atomic reveal engine (Phase 10), Payments (Phase 11), Analytics (Phase 12), Security audit (Phase 13), and Production deployment (Phase 14).

---

## 3. Repository Structure

```text
ShopFinder/
├── client/                      # React 18 Frontend Application
│   ├── public/                  # Static public assets
│   ├── src/                     # Source files
│   │   ├── assets/              # Icons, images, media
│   │   ├── components/          # Reusable UI components
│   │   ├── context/             # State & Auth contexts
│   │   ├── hooks/               # Custom React hooks
│   │   ├── layouts/             # Page layouts
│   │   ├── pages/               # Route view components
│   │   ├── routes/              # Routing definitions
│   │   ├── services/            # API client service layer
│   │   ├── utils/               # Frontend utility functions
│   │   ├── App.jsx              # Root component
│   │   └── main.jsx             # React DOM entry point
│   ├── index.html               # Vite HTML5 template
│   ├── package.json             # Frontend dependencies & scripts
│   └── vite.config.js           # Vite build & dev server config (port: 5173)
│
├── server/                      # Express.js Backend API
│   ├── src/
│   │   ├── config/              # Centralized configuration
│   │   │   ├── cookie.js        # pb_auth cookie options & set/clear helpers (D-010)
│   │   │   └── env.js           # Zod 4 runtime environment validator
│   │   ├── controllers/         # HTTP request controllers
│   │   ├── middleware/          # Express middleware
│   │   │   └── csrf.js          # Origin & Referer CSRF protection
│   │   ├── routes/              # API route definitions
│   │   ├── services/            # Business logic layer
│   │   ├── utils/               # Utilities (logger, apiResponse)
│   │   ├── app.js               # Express application initialization & middleware stack
│   │   └── server.js            # Server entry point & startup routine
│   ├── tests/                   # Automated Node.js test suites
│   │   ├── app.test.js          # Health, 404, CORS & Helmet tests
│   │   ├── csrf.test.js         # CSRF & cookie security tests (20 tests)
│   │   ├── env.test.js          # Zod environment validation tests
│   │   └── error.test.js        # Centralized error handler security tests
│   ├── .env.example             # Safe environment variable template
│   └── package.json             # Backend dependencies & scripts
│
├── pocketbase/                  # PocketBase Infrastructure
│   ├── pocketbase.exe           # Standalone binary (v0.40.6, gitignored)
│   ├── pb_hooks/                # Server-side JavaScript hooks (committed to Git)
│   │   └── .gitkeep
│   └── .gitkeep
│
├── docs/                        # Project Documentation
│   ├── ARCHITECTURE.md          # Comprehensive architectural specification
│   ├── DATABASE_SCHEMA.md       # 10 collections schema & field definitions
│   ├── DECISIONS.md             # Architectural decision log (D-001 through D-015)
│   ├── DEVELOPMENT_PLAN.md      # Official 15-phase development roadmap
│   ├── PROGRESS.md              # Live task status and verification log
│   ├── PROJECT_OVERVIEW.md      # Platform goals & overview
│   ├── REQUIREMENTS.md          # Functional & non-functional requirements
│   └── TESTING_CHECKLIST.md     # Test verification matrix
│
├── .gitignore                   # Excludes pb_data/, node_modules/, dist/, .env
└── README.md                    # This developer documentation file
```

> **Note on Runtime Database Location (D-015):**  
> `pb_data/` is intentionally **NOT** located inside the repository. It is stored externally at `%LOCALAPPDATA%\ShopFinder\pb_data\` (`C:\Users\arifh\AppData\Local\ShopFinder\pb_data\`) to guarantee complete isolation from OneDrive sync.

---

## 4. Prerequisites & Version Requirements

### System Runtimes
| Environment | Declared / Baseline Requirement | Verified Local Version |
|---|---|---|
| **Operating System** | Windows 10 / 11 (64-bit AMD64) | Windows 10/11 x64 |
| **Node.js** | `v20.x+` (LTS) or `v24.x` | `v24.14.0` |
| **npm** | `v10.x+` or `v11.x` | `v11.10.1` |
| **Git** | `v2.x+` | `v2.55.0` |
| **PocketBase** | `v0.40.6` (Pinned standalone binary) | `v0.40.6` |

### Backend Dependencies (`server/`)
| Package | Declared Version (`package.json`) | Actually Installed (`package-lock.json`) | Role |
|---|---|---|---|
| `express` | `^4.21.2` | `4.22.3` | Backend web framework |
| `cookie-parser` | `^1.4.7` | `1.4.7` | Cookie parsing middleware |
| `cors` | `^2.8.5` | `2.8.6` | Strict origin whitelist CORS middleware |
| `helmet` | `^8.0.0` | `8.3.0` | HTTP security response headers |
| `dotenv` | `^16.4.7` | `16.6.1` | Environment variable loader |
| `zod` | `^4.6.7` | `4.6.7` | Centralized runtime environment validator |
| `nodemon` *(dev)* | `^3.1.9` | `3.1.14` | Local development process monitor |

### Frontend Dependencies (`client/`)
| Package | Declared Version (`package.json`) | Actually Installed (`package-lock.json`) | Role |
|---|---|---|---|
| `react` | `^18.3.1` | `18.3.1` | Core UI library |
| `react-dom` | `^18.3.1` | `18.3.1` | React DOM renderer |
| `vite` *(dev)* | `^6.0.7` | `6.4.5` | Frontend build tool & dev server |
| `@vitejs/plugin-react` *(dev)* | `^4.3.4` | `4.7.0` | Fast Refresh React plugin |

---

## 5. Environment Configuration

The backend requires a local `.env` file to configure runtime parameters.

### Setup Instructions
Inside PowerShell, copy the safe template:
```powershell
cd server
Copy-Item -Path .env.example -Destination .env
```

### Configuration Variables
| Variable | Type | Allowed Values / Default | Description |
|---|---|---|---|
| `NODE_ENV` | String | `development` \| `test` \| `production` | Execution mode. When set to `production`, stack traces are suppressed and cookies require HTTPS (`Secure: true`). |
| `PORT` | Integer | `1` to `65535` (Default: `4000`) | TCP port on which the Express server listens. |
| `CLIENT_URL` | URL | e.g. `http://localhost:5173` | Exact origin of the frontend application allowed for CORS and cookie credentials. **Wildcard (`*`) is strictly forbidden.** |

> ⚠️ **CRITICAL SECURITY REQUIREMENT:**  
> The `.env` file contains environment-specific configuration and must **NEVER** be committed to version control. The root `.gitignore` explicitly excludes all `.env` files.

---

## 6. Windows Installation & Setup Guide

### Step 1: Clone the Repository
Open PowerShell and clone the project:
```powershell
git clone <repository-url> ShopFinder
cd ShopFinder
```

### Step 2: PocketBase Binary & Directory Setup
1. Verify the binary exists at `pocketbase\pocketbase.exe`. If setting up on a new machine, download `pocketbase_0.40.6_windows_amd64.zip` from the [official GitHub releases](https://github.com/pocketbase/pocketbase/releases/tag/v0.40.6) and extract `pocketbase.exe` into `pocketbase\`.
2. Ensure the external data directory exists outside OneDrive:
```powershell
New-Item -ItemType Directory -Path "$env:LOCALAPPDATA\ShopFinder\pb_data" -Force
```

### Step 3: Install Backend Dependencies
```powershell
cd server
Copy-Item -Path .env.example -Destination .env
npm install
```

### Step 4: Install Frontend Dependencies
```powershell
cd ..\client
npm install
```

---

## 7. Running the Application (Local Development)

To run the complete ShopFinder development environment on Windows, open **three separate PowerShell terminals**:

### Terminal 1: PocketBase Server
Start PocketBase with its verified external data directory and repository hooks directory:
```powershell
cd C:\Users\arifh\OneDrive\Desktop\ShopFinder
.\pocketbase\pocketbase.exe serve --http="127.0.0.1:8090" --dir="$env:LOCALAPPDATA\ShopFinder\pb_data" --hooksDir="pocketbase\pb_hooks"
```
- **Service Address:** `http://127.0.0.1:8090`
- **Admin Dashboard:** `http://127.0.0.1:8090/_/` (for administrative use; app users never log in here).

### Terminal 2: Express Backend API
```powershell
cd C:\Users\arifh\OneDrive\Desktop\ShopFinder\server
npm run dev
```
- **API Server Address:** `http://localhost:4000`
- **Health Check Endpoint:** `http://localhost:4000/health`

### Terminal 3: React Frontend (Vite)
```powershell
cd C:\Users\arifh\OneDrive\Desktop\ShopFinder\client
npm run dev
```
- **Frontend Application:** `http://localhost:5173`

---

## 8. Testing & Verification

### Running Backend Automated Tests
The Express backend includes a comprehensive automated test suite (36 tests across 4 suites) covering CORS, CSRF, cookie security, environment validation, and error masking:
```powershell
cd server
npm test
```

### Running Frontend Production Build
Verify that the React frontend bundles cleanly:
```powershell
cd client
npm run build
```

### Security Audit
Verify zero vulnerabilities in installed packages:
```powershell
cd client
npm audit
```

---

## 9. Security Guidelines & Operational Boundaries

1. **No Direct PocketBase Access for Clients:**  
   Frontend code must **never** make direct network requests to `http://127.0.0.1:8090`. All interactions must pass through the Express backend proxy.
2. **Localhost Binding Only:**  
   PocketBase must strictly bind to `127.0.0.1:8090`. It must never be bound to `0.0.0.0` or exposed to public network interfaces.
3. **Cookie-Only Authentication (D-010):**  
   Auth tokens are stored exclusively in `httpOnly`, `SameSite=Strict` cookies. Never store authentication tokens in `localStorage`, `sessionStorage`, or JavaScript variables.
4. **Phone Number Protection (D-014):**  
   Phone numbers are stored in `owner_contacts` and never on the `users` record. Phone numbers are returned exclusively via the authorized reveal endpoint.
5. **Atomic Reveal Transactions (D-013):**  
   Contact reveals and credit deductions must always occur inside `$app.runInTransaction()` using `txApp` with secondary database uniqueness backstops.
6. **No Real Secrets in Version Control:**  
   Never commit `.env` files, production credentials, or PocketBase superuser credentials to Git.
7. **OneDrive Data Exclusion (D-015):**  
   Never create or relocate `pb_data/` into the Git repository or any folder synchronized by OneDrive. Always use `%LOCALAPPDATA%\ShopFinder\pb_data\`.

