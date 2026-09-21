# CivicResolve (सिविक रिज़ॉल्व) 🇮🇳
### AI-Powered Community Infrastructure Intelligence & Rapid Municipal Redressal

Built for the **Google AI Challenge / Hackathon**, **CivicResolve** is a production-grade, responsive Progressive Web Application (PWA) that empowers citizens across India to report localized civic infrastructure failures (potholes, open manholes, sewage overflow, garbage dumps, dark streetlights, and burst water pipes).

---

## 🏆 Hackathon Evaluation Criteria Alignment (100%)

| Weight | Criteria | CivicResolve Implementation |
| :---: | :--- | :--- |
| **25%** | **AI / Technical Execution** | **Google Gemini Multimodal Vision API** (`gemini-1.5-flash`) analyzes civic damage photos, evaluates structural severity (1.0 to 5.0), detects spam/non-civic uploads, and recommends civil remediation. |
| **20%** | **Depth & Reach Across India** | **8 Indian Languages** (Hindi, Tamil, Telugu, Kannada, Bengali, Marathi, Gujarati, English) + **Voice-First reporting** via Web Speech API so rural/semi-urban citizens can report issues naturally in their mother tongue. |
| **20%** | **Problem-Solution Fit** | **PostGIS 25m Spatial Deduplication (`ST_DWithin`)** stops duplicate ticket flood. Automatically recalculates dynamic priority: $\text{Priority} = (\text{ML\_Severity} \times 0.35) + (\log(\text{Reports}+1) \times 0.30) + (\text{Upvotes} \times 0.20) + (\text{SLA\_Decay} \times 0.15)$. |
| **20%** | **Deployability & Scalability** | **Mobile-First PWA**: No app store install barriers. Works on low-end Android smartphones with client-side canvas image compression (<150KB) and EXIF GPS verification. Includes Municipal Officer Command Portal. |
| **15%** | **Impact Potential** | Eliminates duplicate municipal work orders, optimizes road maintenance budget dispatch, and prioritizes fatal open manholes and road craters within 24h SLA. |

---

## 🚀 Quick Start (Running Locally)

### 1. Install & Run Dev Server
```bash
npm install
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### 2. (Optional) Configure Google Gemini API Key
To connect directly to live Google Gemini AI, copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Add your Gemini API key from [Google AI Studio](https://aistudio.google.com/):
```env
GEMINI_API_KEY=AIzaSy...
```
*(Note: If no API key is provided, the platform automatically uses a high-fidelity civic heuristic engine so live judging and offline demos never crash!)*

### 3. (Optional) Run PostGIS Database & Storage
```bash
docker compose up -d
```
Spins up PostgreSQL 16 with PostGIS extension on port 5432 and MinIO Object Storage on port 9000/9001.

### 4. Try the 3-Tier Role-Personas (Real RBAC — no shared access)

The app ships with **three strictly-separated personas**, each with its own account and permissions enforced **server-side** (JWT cookie + per-route role guards + department isolation — not just hidden buttons).

| Persona | How to sign in | What you get |
| :--- | :--- | :--- |
| **Citizen** | `Sign in → Citizen (OTP)` — enter any 10-digit mobile number; the demo OTP is shown on screen | Report hazards (photo + voice note), upvote **once** per report, track own reports, live status notifications |
| **Department Staff** | `Sign in → Staff / Admin` — one-tap demo accounts | Department-scoped task queue (`Start Work → upload proof-of-work → Mark Resolved`), reassignment requests |
| **City Admin** | Same one-tap panel, `admin@city.gov` | Full console: **Triage** (verify/reject), **Dispatch** (assign dept + worker, merge duplicates, reject), **Departments** CRUD, **Analytics** (KPIs, SLA breaches, audit trail) |

Demo accounts:
```
water@city.gov  / demo1234    -> Water Supply & Sanitation (DEPT_WATER)
roads@city.gov  / demo1234    -> Public Works & Roads (DEPT_PWD)
admin@city.gov  / admin1234   -> City Admin (super-admin; verifies, dispatches, never self-resolves)
```

Try signing in as **Water** and opening a Roads ticket — you'll get a hard `403`. The workflow state machine runs `SUBMITTED → VERIFIED → ASSIGNED → IN_PROGRESS → RESOLVED` (proof photo required before RESOLVED), plus `REJECTED` and `MERGED_DUPLICATE`.

---

## 📂 Architecture & Key Code

- **Frontend PWA & UI:** [`src/app/page.tsx`](file:///C:/Users/Krishna%20mohan/OneDrive/Desktop/New%20folder/src/app/page.tsx)
- **Google Gemini Multimodal Vision Service:** [`src/lib/gemini.ts`](file:///C:/Users/Krishna%20mohan/OneDrive/Desktop/New%20folder/src/lib/gemini.ts)
- **Dynamic Prioritization Algorithm:** [`src/lib/prioritization.ts`](file:///C:/Users/Krishna%20mohan/OneDrive/Desktop/New%20folder/src/lib/prioritization.ts)
- **Spatial Deduplication Engine:** [`src/lib/store.ts`](file:///C:/Users/Krishna%20mohan/OneDrive/Desktop/New%20folder/src/lib/store.ts)
- **Multilingual Indian Languages (8 Langs):** [`src/lib/languages.ts`](file:///C:/Users/Krishna%20mohan/OneDrive/Desktop/New%20folder/src/lib/languages.ts)
- **PostGIS SQL Schema:** [`database/schema.sql`](file:///C:/Users/Krishna%20mohan/OneDrive/Desktop/New%20folder/database/schema.sql)
- **Municipal Command Console (admin):** [`src/components/AdminPortal.tsx`](file:///C:/Users/Krishna%20mohan/OneDrive/Desktop/New%20folder/src/components/AdminPortal.tsx)
