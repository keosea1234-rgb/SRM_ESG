# CLAUDE.md — SRM Project Context

> Living document. Update after every significant change session.
> Last updated: 2026-05-11

---

## Project Overview

**SRM (Supplier Relationship Manager)** — internal tool for managing suppliers, contracts, performance evaluations, risk assessments, and ESG compliance.

- **Repo:** `keosea1234-rgb/SRMup` (GitHub)
- **Supabase project:** `kzpviefgzrwjbpyqmqae.supabase.co`
- **Status:** Local development only. Single active user (admin).
- **Stack:** React 18 + TypeScript + Vite + Tailwind v3 + Supabase + Express/Node
- **Theme:** Amcor brand colors (petrol `#00395A`, cyan `#24BBEE`, green `#1BCDAC`)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18.3, TypeScript 5.7, Vite 6 |
| Styling | Tailwind CSS 3.4, Amcor brand theme |
| State/Data | TanStack React Query v5, Zustand-free (context only) |
| Animation | Motion (motion/react) v11 |
| Charts | Recharts 2.15 |
| Icons | Lucide React |
| Backend | Express 4.21, Node.js |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (ES256/JWKS) + custom RBAC |
| Job Queue | BullMQ 5.76 + Redis (srm-redis Docker container, port 6379) |
| Validation | Zod 4 |
| Testing | Vitest — 298 tests passing (20 test dosyası) |

---

## Project Structure

```
SRM-upgraded/
├── server/
│   ├── modules/
│   │   ├── activity/        # Activity log
│   │   ├── contracts/       # Contract management
│   │   ├── dashboard/       # Dashboard BFF endpoint
│   │   ├── esg/             # ESG assessments + scoring
│   │   ├── performance/     # Performance evaluations
│   │   ├── risk/            # Risk assessments
│   │   ├── alerts/          # Alert engine (srm_alerts table, daily check, bell UI)
│   │   └── suppliers/       # Suppliers, contacts, documents, profile, approval, segmentation, narrative
│   ├── jobs/
│   │   ├── queue.ts         # BullMQ queues (daily-snapshot, external-data)
│   │   ├── scheduler.ts     # Cron: daily snapshot at 02:00
│   │   └── workers/
│   │       ├── dailySnapshotWorker.ts   # ACTIVE — snapshot + alert check (tüm active supplier'lar)
│   │       └── externalDataWorker.ts   # STUB — ESGProviderAdapter TODO
│   ├── middleware/          # auth, requireRole, rateLimiter, validate, correlationId
│   ├── config/
│   │   └── redis.ts         # Redis config (REDIS_URL env — not running locally)
│   └── db/
│       └── supabaseClient.ts
├── src/
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── SupplierList.tsx      # Supplier list + create modal
│   │   ├── SupplierDetail.tsx    # Supplier detail, inline edit, tabs
│   │   ├── SupplierPortalPage.tsx # Supplier self-service portal
│   │   ├── ESGPage.tsx           # ESG overview (redesigned Phase 1)
│   │   ├── PerformancePage.tsx
│   │   ├── RiskPage.tsx
│   │   ├── ContractsPage.tsx
│   │   ├── ActivityLogPage.tsx
│   │   └── ComparisonPage.tsx
│   ├── components/
│   │   ├── AlertsDropdown.tsx    # Bell icon dropdown — unread alerts, mark read, supplier link
│   │   ├── esg/                  # ESG sub-components (Phase 1 redesign)
│   │   │   ├── ESGCompositeIndex.tsx
│   │   │   ├── ESGPillarHeader.tsx
│   │   │   ├── ESGHotspots.tsx
│   │   │   ├── ESGIndustryBenchmark.tsx
│   │   │   └── ESGTopPerformers.tsx
│   │   ├── ESGPillarCard.tsx     # Pillar card with A/B/C/D/F grade badges
│   │   ├── ESGScoreRing.tsx
│   │   ├── ESGAssessmentModal.tsx
│   │   ├── FilterBar.tsx
│   │   ├── RiskHeatmap.tsx           # Category risk heatmap table (industry × risk type)
│   │   ├── PortfolioHealthWidget.tsx # Gauge + 3 donuts for portfolio health overview
│   │   ├── Sidebar.tsx           # Amcor petrol dark sidebar
│   │   ├── Header.tsx
│   │   ├── ErrorBoundary.tsx         # Class-based error boundary with fallback UI
│   │   └── PageErrorBoundary.tsx     # Route-aware wrapper, resets on navigation
│   │   ├── ui/
│   │   │   ├── Skeleton.tsx          # Shimmer loading placeholder
│   │   │   └── EmptyValue.tsx        # Styled "—" for missing data
│   ├── services/                 # All API fetch functions (React Query pattern)
│   │   ├── alerts.ts
│   │   ├── dashboard.ts
│   │   ├── esg.ts
│   │   ├── performance.ts
│   │   ├── risk.ts
│   │   ├── contracts.ts
│   │   ├── activityLog.ts
│   │   └── suppliers.ts
│   ├── lib/
│   │   ├── healthScore.ts        # Composite health score formula
│   │   ├── esgGrading.ts         # A/B/C/D/F grading system
│   │   ├── countries.ts          # Full ISO 3166-1 country list (~250)
│   │   ├── queryClient.ts        # React Query client (staleTime: 2min)
│   │   ├── queryKeys.ts          # Centralized query keys
│   │   └── api.ts                # apiGet, apiPost, apiPatch, apiDelete
│   ├── hooks/
│   │   ├── useFilterState.ts
│   │   └── usePageTitle.ts   # Sets document.title to "{Page} · SRM"
│   └── context/
│       └── AuthContext.tsx       # Auth + RBAC permissions
└── supabase/
    └── migrations/
        ├── 005_canonical_schema.sql  # Source of truth (pulled from prod 2025-05-09)
        ├── 006_esg_unique_constraint.sql
        ├── 007_supplier_parent.sql   # parent_id + v_supplier_summary update
        ├── 009_role_jwt_claim.sql    # backfill app_metadata.role for all users
        ├── 010_esg_summary_rpc.sql   # get_esg_portfolio_summary() RPC
        ├── 011_scoring_version.sql   # scoring_version + scoring_weights kolonları
        └── 012_alerts.sql            # srm_alerts table + RLS
```

---

## Database Schema (Key Tables)

| Table | Purpose |
|---|---|
| `srm_suppliers` | Core supplier records. Has `parent_id` (self-ref FK) for subsidiaries |
| `srm_supplier_profiles` | Extended profile (filled by supplier via portal) |
| `srm_supplier_contacts` | Supplier contacts |
| `srm_supplier_documents` | Uploaded documents with expiry tracking |
| `srm_performance_evaluations` | Performance scores (quality/delivery/price/communication, 0-10) |
| `srm_risk_assessments` | Risk scores (financial/operational/compliance/geopolitical/reputational, 1-5) |
| `srm_esg_assessments` | ESG data per supplier per period, includes computed E/S/G/overall scores |
| `srm_activity_log` | Audit trail for all actions |
| `srm_daily_snapshots` | Daily KPI snapshot for sparklines |
| `contracts` | Contract records linked to suppliers |
| `profiles` | User profiles with RBAC roles |
| `srm_alerts` | Proactive alerts (esg_threshold, cert_expiring, risk_spike, inactivity) |

**Key Views:**
- `v_supplier_summary` — joins suppliers + latest perf/risk/contracts. Includes `parent_id`, `parent_name`
- `mv_supplier_dashboard_summary` — materialized view for dashboard performance

**New columns (migration 011):** `srm_esg_assessments.scoring_version` (text, default 'v1') + `srm_esg_assessments.scoring_weights` (jsonb) — audit trail için her assessment'ta weight profile saklanır.
**Generated column:** `srm_risk_assessments.overall_risk_level` — auto-computed from avg of 5 risk scores: `≥4=critical`, `≥3=high`, `≥2=medium`, `<2=low`

---

## RBAC Roles

| Role | Access |
|---|---|
| `admin` | Full access |
| `procurement_manager` | Suppliers, contracts, risk, performance |
| `esg_analyst` | ESG read + write |
| `viewer` | Read-only |
| `supplier` | Portal only (own profile) |

---

## Scoring Formulas

### Health Score (`src/lib/healthScore.ts`)
```
With ESG:    score = perf×0.40 + esg_norm×0.40 + risk×0.20
Without ESG: score = perf×0.60 + risk×0.40  (fallback)

esg_norm = overall_esg_score / 10  →  0–10
(overall_esg_score is the stored 0–100 column from srm_esg_assessments)

Ceilings (applied in order):
  critical risk   → max 4.0
  esg_norm < 1.0  → max 4.0
  esg_norm < 2.0  → max 6.0

Bands: ≥8 Excellent · ≥6 Healthy · ≥4 Watchlist · <4 At Risk
```

### ESG Score (`server/modules/esg/esg.service.ts`)
```
overall = env×0.50 + social×0.20 + gov×0.30

Pillar scores: weighted average of sub-metrics normalized to 0-100
Carbon: score = max(0, 100 - tons/10)
Injury rate: score = max(0, 100 - rate×20)
Boolean fields: true=100, false=0
Cert bonus: min(20, count×5) added to metric avg, capped at 100
            — only if other metrics present (cert-only → 0)
```

### Performance Overall Score (`server/modules/performance/performance.service.ts`)
```
overall_score = round((quality×qw + delivery×dw + price×pw + comm×cw) × 10)
Stored 0–100. Default weights: qw=0.30 dw=0.25 pw=0.25 cw=0.20.
Recomputed on every create and edit (not only at insert).
```

### ESG Grading (`src/lib/esgGrading.ts`)
```
A: ≥80  B: ≥65  C: ≥50  D: ≥35  F: <35
water_usage_m3: display only, no grade (sector-agnostic)
```

### Risk Level (DB generated column)
```
avg(financial + operational + compliance + geopolitical + reputational) / 5
≥4.0 = critical · ≥3.0 = high · ≥2.0 = medium · <2.0 = low
```

---

## API Endpoints

### Dashboard
- `GET /api/dashboard/overview` — BFF: all dashboard data including ESG slice
- ~~`GET /api/dashboard/stats`~~ — deleted (legacy)

### Suppliers
- `GET /api/suppliers` — paginated list
- `POST /api/suppliers` — create (admin, procurement_manager)
- `GET /api/suppliers/:id` — detail
- `PATCH /api/suppliers/:id` — update (admin, procurement_manager)
- `GET /api/suppliers/:id/profile` — supplier profile (any authenticated)
- `PUT/PATCH /api/suppliers/:id/profile` — update profile (admin, procurement_manager, supplier w/ IDOR guard)
- `GET /api/suppliers/:id/contacts` — list contacts (any authenticated)
- `POST /api/suppliers/:id/contacts` — create contact (admin, procurement_manager) + Zod validated
- `GET /api/suppliers/:id/documents` — list documents (any authenticated)
- `POST /api/suppliers/:id/documents` — upload (admin, procurement_manager, supplier)
- `PUT /api/suppliers/:id/documents/:docId/approve|reject` — (admin, procurement_manager)
- `DELETE /api/suppliers/:id/documents/:docId` — (admin, procurement_manager)
- `POST /api/suppliers/:id/approve` / `reject` / `invite` — (admin, procurement_manager)
- `GET /api/suppliers/compare` — comparison
- `GET /api/suppliers/export` — CSV export (formula-injection safe)

### ESG
- `GET /api/esg/summary` — portfolio-level ESG averages + metrics
- `GET /api/esg/leaderboard` — top 20 suppliers by ESG score
- `GET /api/esg/hotspots` — worst 5 metrics (below-target count)
- `GET /api/esg/export` — CSV (formula-injection safe)
- `GET /api/esg/:supplierId` — latest assessment for supplier
- `POST /api/esg/:supplierId` — create assessment (admin, esg_analyst)

### Performance
- `GET /api/performance/summary` — all evaluations

### Risk
- `GET /api/risk/summary` — all risk assessments

### Contracts
- `GET /api/contracts` — list (any authenticated)
- `GET /api/contracts/:id` — detail (any authenticated)
- `POST /api/contracts` — create (admin, procurement_manager)
- `PUT /api/contracts/:id` — update (admin, procurement_manager)
- `DELETE /api/contracts/:id` — delete (admin, procurement_manager)

### Suppliers (ek endpoint'ler)
- `GET /api/suppliers/:id/health-narrative` — supplier bazlı signal + summary (any authenticated)
- `GET /api/suppliers/segments` — tüm supplier'ların segment sınıflandırması

### Alerts
- `GET /api/alerts` — unread alerts (any authenticated)
- `PATCH /api/alerts/:id/read` — mark as read

### Activity Log — read-only CRUD

### ESG (ek endpoint'ler)
- `GET /api/esg/:supplierId/history` — approved assessment history (oldest→newest)

---

## React Query Setup

- `queryClient`: staleTime 2min, gcTime 10min, retry 1, refetchOnWindowFocus false
- All pages use React Query (no raw useEffect+fetch anywhere)
- `src/lib/queryKeys.ts` — centralized key factories
- `src/services/` — one file per domain, all fetch functions

---

## Testing

- **Runner:** Vitest
- **Coverage:** `server/**/*.test.ts` + `src/**/*.test.ts`
- **Total:** 278 tests across 18 files (as of 2026-05-11, Sprint 3)
- **Note:** `esg.service.test.ts` CI'da exclude — Supabase mock eksik (P2 debt)
- **Server:** service logic, middleware, schema validation, repository mocks
- **Frontend:** `src/lib/healthScore.ts`, `src/lib/esgGrading.ts` fully covered
- **Run:** `npm run test:run`

---

## Supplier Features

- **Parent-child relationships:** `parent_id` FK on `srm_suppliers`. Max 2 levels. SupplierList shows `↳ ParentName` badge.
- **Country dropdown:** Full ISO 3166-1 list in all create/edit forms
- **Onboarding flow:** invite → registered → profile_filling → submitted → approved/rejected
- **Health score:** composite (perf + ESG + risk), shown as badge with breakdown tooltip

---

## ESG Features

- **Assessment modal:** 3-step wizard (E → S → G), submit as draft or approved
- **Grading:** A/B/C/D/F per metric, shown in ESGPillarCard
- **Hotspots:** worst 5 metrics by gap to target
- **Industry benchmark:** hardcoded peer/leader values for 6 metrics
- **Leaderboard:** top 20 by overall ESG score, deduped per supplier
- **Unique constraint:** one approved assessment per (supplier_id, period)
- **Mock data:** 20 suppliers seeded with 2025-Q4 assessments
- **Scoring version:** `scoring_version` + `scoring_weights` her assessment'a yazılır. `CURRENT_SCORING_VERSION="v1"`, `CURRENT_WEIGHTS={env:0.50, social:0.20, gov:0.30}` esg.service.ts'de tek noktadan yönetilir.
- **History tab:** SupplierESGTab — ≥2 approved assessment varsa Recharts trend chart + history table (most-recent-first, teal-50 vurgu).

---

## Known Technical Debt / TODO

| Priority | Item |
|---|---|
| P2 | CI pipeline — upgrade to 4-stage (lint / test / build / security-audit) with coverage threshold |
| P2 | Frontend tests — expand coverage beyond `src/lib` (e.g. AuthContext, components) |
| P2 | sendValidationError helper — esg.controller.ts field-level validation error, envelope korunacak |
| P2 | `externalDataWorker.ts` — ESGProviderAdapter stub (DnB/IntegrityNext/EcoVadis). `server/integrations/dnb/` ve `integrityNext/` iskelet var, client boş. AdapterRegistry interface tanımlanmamış. |
| P2 | `GET /api/suppliers` için opsiyonel `?segment=` backend filter — şu an client-side. Pagination/count davranışını etkiler, ayrı karar gerektirir. |
| P3 | Materiality matrix — needs `business_impact_score` field in DB |
| P3 | ESG trend sparklines — multi-period data yetersiz (şu an sadece Q4-2025 mock data) |
| P3 | Alert email/webhook delivery — şu an in-app only. BullMQ altyapısı hazır, delivery channel kararı verilmeli. |
| P3 | BullMQ Board / failed job monitoring UI — 3 retry sonrası failed queue görünmüyor |

---

## Recent Changes (Changelog)

### 2026-05-11 — UI/UX Polish Sprint ✅

- **Skeleton shimmer:** `src/components/ui/Skeleton.tsx` added —
  `skeleton-shimmer` CSS class with surface-100→surface-200→surface-100
  gradient sweep, 1.5s infinite. Full-page skeletons added to Dashboard,
  ESGPage, SupplierList, ContractsPage. Loading roots use `aria-busy="true"`.

- **Contract expiry chips:** `ExpirationUrgency` component in ContractsPage.tsx.
  `days < 0` → red "Expired Xd ago", `0–30` → red "Expires in Xd",
  `31–90` → amber "Expires in Xd", `>90` → plain formatDate, no date → EmptyValue.
  Replaces old dual-banner approach (middle banner removed).

- **Page transition directions:** `src/lib/animation.ts` — added
  `drillDownVariants` (x:24→0, 0.25s), `fanInVariants` (stagger 0.07),
  `fanInItem` (x:-16, scale:0.97→1). SupplierDetail root wrapped in
  drillDownVariants. ESGPage pillar card grid uses fanInVariants/fanInItem.

- **Stat card dynamic states:** High Risk card (red, value>0) gets
  `ring-2 ring-red-200 ring-offset-2 animate-pulse` on the icon container div.
  Amber card (value>0) gets `ring-2 ring-amber-200 ring-offset-1`.
  Zero values and "—" never trigger rings.

- **ESG pillar filter interaction:** ESGPillarCard header is now a toggle
  button (`aria-pressed`). Single pillar selected → leaderboard sorts by
  that pillar's score descending (all rows shown). Two+ pillars → OR filter
  (≥70 rule). Click same pillar again → clears to []. FilterBar stays in sync.
  Pillar-colored `ring-2` ring on selected card (blue/purple/amber).

- **Search keyboard navigation:** Header.tsx search dropdown now supports
  ArrowDown/ArrowUp to move selection, Enter to navigate, active row
  highlighted with `bg-brand-50`, scrolls into view. Dropdown is scrollable
  with max-height. Uses `role="listbox"` / `role="option"` + `aria-selected`.
  selectedIndex resets on query change, close, and Escape.

- **Supplier list card/table toggle:** Toggle button switches between table
  (existing) and card grid view. URL param `?view=cards` preserved for
  bookmarks/links. Card shows: initial avatar, name + industry, risk badge +
  status chip, 3-segment mini bar (Performance / Risk / ESG) with color +
  fill width + tooltips.

- **Dynamic page titles:** `src/hooks/usePageTitle.ts` — sets
  `document.title` to `"{Page} · SRM"`, cleans up to "SRM" on unmount.
  Wired into all 9 pages: Dashboard, Suppliers, Supplier Detail, Contracts,
  Performance, Risk, ESG, Audit Log, Compare.

- **Styled empty value component:** `src/components/ui/EmptyValue.tsx` —
  `text-surface-300 select-none` span. Replaces bare "—" in score column
  (Dashboard), ExpirationUrgency no-date branch (ContractsPage).

- **Sidebar accent token:** Active indicator pill changed from hardcoded
  `bg-[#24BBEE]` to `bg-accent` token. Visual output identical.

- **Header backdrop blur:** Header background changed to
  `rgba(0, 45, 72, 0.92)` + `backdrop-blur-sm`. Adds depth when page
  content scrolls beneath it.

### 2026-05-11 — Sprint 5 ✅ — Intelligence & Differentiation
- **T1 · Scoring Version Metadata (3 SP):** Migration 011 — `srm_esg_assessments`'a `scoring_version` (text, default 'v1') + `scoring_weights` (jsonb) eklendi, backfill yapıldı. `esg.service.ts` → `CURRENT_SCORING_VERSION` + `CURRENT_WEIGHTS` sabitleri tek noktadan yönetiliyor, magic number yok. `computeEsgScores()` bu metadata'yı return'e ekliyor → `createEsgAssessment()` otomatik insert ediyor. `getEsgBySupplier()` response'unda `scoring_version` görünüyor.
- **T2 · Health Narrative Engine (3 SP):** `server/modules/suppliers/narrative.service.ts` eklendi — `generateHealthNarrative(supplierId)` ESG trend, risk spike, performance delta, expiring cert, ESG hotspot sinyallerini pure fonksiyonlarla üretiyor. `GET /api/suppliers/:id/health-narrative` endpoint eklendi. `SupplierDetail` Overview tab'ına Health Summary widget eklendi (severity dot + signal list). 6 unit test.
- **T3 · Supplier Segmentation Engine (2 SP):** `server/modules/suppliers/segmentation.service.ts` — `classifySupplier()` pure function, DB call yok. Segment'ler: `at_risk`, `esg_laggard`, `strategic`, `high_performer`, `watch`, `single_source`, `standard`. `GET /api/suppliers/segments` endpoint eklendi. `SupplierList` → Segment dropdown filter + At Risk/ESG Laggard badge sayaçları. 7 unit test.
- **T4 · Proactive Alert Engine (2 SP):** Migration 012 — `srm_alerts` tablosu oluşturuldu (alert_type, severity, is_read, idempotency). `server/modules/alerts/` modülü: repository + service + controller + routes. `checkAndCreateAlerts()` — ESG threshold (<40), cert expiring (30g), risk spike, inactivity (90g) kuralları, günlük idempotency korumalı. `dailySnapshotWorker.ts` → snapshot sonrası tüm active supplier'lar için alert check çalışıyor. Frontend: `AlertsDropdown.tsx` bell ikonu + unread badge + mark read. `Header.tsx`'e entegre edildi.

### 2026-05-11 — Sprint 4 ✅ — Stabilize & Operationalize
- **T1 · Logger Konsolidasyonu (2 SP):** `server/shared/logger.ts`'e `getRequestLogger(correlationId)` → `logger.child({ correlationId })` eklendi. `esg.controller.ts` → `lib/logger.ts` import'u kaldırıldı, `shared/logger.ts` kullanılıyor. `server/lib/logger.ts` silindi. ESG hataları artık pino+Sentry üzerinden gidiyor.
- **T2 · JWT ES256/JWKS (3 SP):** `requireAuth` → `supabase.auth.getUser()` kaldırıldı. `jose` `createRemoteJWKSet` ile Supabase JWKS endpoint'i (`/auth/v1/.well-known/jwks.json`) kullanılıyor. Supabase bu proje için ES256 algoritması kullanıyor — HS256 `SUPABASE_JWT_SECRET` artık geçersiz. JWKS module scope'da bir kez init ediliyor (cache'li). `auth.test.ts` → `jose` mock tabanlı fixture'lara geçirildi. 298/298 test.
- **T3 · writeLimiter Eksik Endpoint'ler (1 SP):** `POST /api/esg/:supplierId`, `POST /api/suppliers/:id/documents`, `POST /api/suppliers/:id/invite`, `POST /api/suppliers/:id/approve`, `POST /api/suppliers/:id/reject` — hepsine `writeLimiter` eklendi. Sıra: `requireAuth → requireRole → writeLimiter → handler`.
- **T4 · Dashboard Sorgu Optimizasyonu (3 SP):** `getRiskHeatmapData()` Promise.all'a alındı (11. seri sorgu kaldırıldı). Migration 010 — `get_esg_portfolio_summary()` RPC eklendi, ESG aggregation artık SQL'de. `getEsgSummary()` → `fetchEsgPortfolioSummaryFromRPC()` kullanıyor. `getEsgHotspots()` raw metric path'i korundu.
- **T5 · esg.service.test.ts CI (2 SP):** Supabase mock eklendi (vi.mock repository layer). `getEsgSummary`, `createEsgAssessment`, `getEsgLeaderboard` dedup, `getEsgHotspots` boş data test case'leri eklendi. CI exclude kaldırıldı. 284 → 298 test.

### 2026-05-11 — Sprint 3 ✅
- **T1 · Correlation ID / Observability (2 SP):** `server/middleware/correlationId.ts` — `x-correlation-id` header veya `crypto.randomUUID()`, `res.locals` + response header. `server/shared/logger.ts`'e `getRequestLogger()` eklendi (pino child). İlk middleware olarak register edildi.
- **T2 · esg_analyst RBAC Hizalaması (2 SP):** `/esg` route `canViewESG` guard ile korundu. Sidebar `/compare` linki `canViewComparison` ile korundu. `esg.routes.ts` POST intent JSDoc. `AuthContext.tsx` inline comment'lar.
- **T3 · ESGAssessmentModal Async Hata Yönetimi (1 SP):** `try/catch/finally` eklendi, `error` state + dismiss'li kırmızı alert banner, step değişiminde temizleniyor, modal hata durumunda kapanmıyor.
- **T4 · Supplier ESG Trend & History (3 SP):** `GET /api/esg/:supplierId/history` endpoint eklendi. `SupplierESGTab` → history state + Recharts trend chart (≥2 assessment) + history table (>1 assessment, most-recent-first).
- **API response envelope standardizasyonu:** `sendSuccess/sendError` merkezi helper. Shape: `{ ok, data, error, code? }`.
- **GitHub Actions CI pipeline:** `.github/workflows/ci.yml` — typecheck → test → build. Redis service container.

### 2026-05-11 — Sprint 2
- requireRole JWT claim (T1): DB sorgusu kaldırıldı, app_metadata.role'dan okur
- Duplicate requireAuth temizliği (T2): suppliers, performance routes
- activity.service.ts any tipleri giderildi, dead code silindi (T3)
- ESG schema numeric field comment'ları eklendi (T4)
- App.tsx window.location.pathname → React Router native /set-password route (T5)

### 2026-05-11 — Sprint 2 T1
- requireRole middleware DB sorgusu kaldırıldı, JWT app_metadata.role claim'den okur
- admin_set_role() her iki overload profiles + auth.users.raw_app_meta_data günceller
- Migration 009_role_jwt_claim.sql — backfill tüm mevcut kullanıcılar
- AuthRequest'e userRole?: string eklendi
- requireRole.test.ts supabase mock'lardan userRole bazlı teste geçirildi

### 2026-05-10 — Test & CI Sprint (Gun 1-2)
- **supertest** paketi eklendi (`npm install -D supertest @types/supertest`)
- **`requireRole.test.ts`** (yeni, 9 test): middleware'in 401/403 enforcement'ini dogruluyor — userId eksik, role yetersiz, DB hatasi, tum valid role kombinasyonlari
- **`contracts.routes.test.ts`** (yeni, 10 test): route-level role enforcement — viewer/supplier 403, admin/procurement_manager 201/200/204, Zod validation 400
- **`suppliers.routes.test.ts`** (yeni, 12 test): approve/reject/invite/contacts/documents endpoint'lerinin role guard'lari, IDOR senaryosu
- **`onboarding.service.test.ts`** genisledi (4 → 12 test): her valid transition, invalid skip, terminal state, activity log yazilmasi, update fail
- **`comparison.service.test.ts`** genisledi (4 → 6 test): max 5 ID limiti, null ESG/risk data, row shape dogrulamasi
- **`dashboard.service.test.ts`** yeniden yazildi (4 → 8 test): supplier count/active filter, highRiskCount, avgPerformanceScore hesaplamasi, zero-supplier edge case
- **`documents.service.test.ts`** (yeni, 12 test): list, upload with/without file, storage error, approve, reject, delete pending/approved/notfound/fetchfail
- **Toplam test:** 160 → 200 (+40), 16 test dosyasi, tum security fix'ler regression-proof

### 2026-05-10 — Security Audit & Fixes
- **Migration 008:** Fixed `admin_set_role()` privilege escalation — revoked `anon`/`authenticated` grants, added admin-only guard in function body, dropped unsafe `text`-typed overload (was CRITICAL: any user could escalate to admin)
- **`.gitignore`:** Added `supabase/.temp/`, `.env.*`, `!.env.example` — temp files contained project ref, org ID, and pooler URL
- **Contracts routes:** Added `requireRole("admin", "procurement_manager")` to POST/PUT/DELETE — were unprotected (any authenticated user could create/edit/delete contracts)
- **Supplier sub-routes:** Added `requireRole` to contacts POST, profile PUT/PATCH, documents POST/approve/reject/DELETE, supplier approve/reject/invite — all were missing role enforcement
- **IDOR fix (profile.controller.ts):** Supplier-role users now verified against their linked `supplier_id` before editing — prevents editing other suppliers' profiles
- **CSV formula injection (export.controller.ts):** `escapeCSV()` now prefixes `=+\-@\t\r` values with single quote to prevent Excel formula execution
- **Input validation:** Added `createContactSchema` Zod schema for `POST /suppliers/:id/contacts` — was accepting arbitrary unvalidated JSON
- **CORS hardening (server/index.ts):** Null-origin requests rejected in production mode — prevents credential-bearing requests from `file://` and sandboxed iframes

### 2026-05-10
- **Supplier depth:** `parent_id` self-ref FK, subsidiary badge in list, parent select in create form
- **Country dropdown:** Full ISO list in SupplierList, SupplierDetail inline edit, SupplierPortalPage
- **ESG page redesign Phase 1:** ESGCompositeIndex, ESGPillarHeader, ESGHotspots, ESGIndustryBenchmark, ESGTopPerformers components
- **ESG hotspots endpoint:** `GET /api/esg/hotspots` — worst 5 below-target metrics
- **ESG mock data:** 20 suppliers seeded with realistic sector-based 2025-Q4 assessments
- **ESG grading:** A/B/C/D/F per metric with normalizers (`src/lib/esgGrading.ts`)
- **ESG pillar weights:** env×0.50 + social×0.20 + gov×0.30
- **Health score ESG integration:** perf×0.40 + esg_norm×0.40 + risk×0.20, breakdown tooltip
- **Amcor brand theme:** petrol sidebar, brand ramp updated, `#f0f6fa` body background
- **React Query migration:** all 7 pages + `services/` layer complete
- **Tech debt sprint:** legacy dashboard deleted, ESG types cleaned, repository layer fixed
- **Sortable tables:** SupplierList + PerformancePage column sort
- **Performance page:** smooth filter with `keepPreviousData`
- **Score color fix:** `scoreTierPillClasses` thresholds corrected (0-10 scale)
- **ComparisonPage React Query migration:** replaced raw useEffect+useState fetching with `useQuery`; added `suppliersPool` and `comparison` query keys; `shouldCompare` flag pattern for explicit trigger; fetch helpers in `services/suppliers.ts`
- **Global Error Boundary:** new `src/components/ErrorBoundary.tsx` (class component, fallback UI) + `src/components/PageErrorBoundary.tsx` (resets on route change via `useEffect + location.pathname`); wrapped `<Outlet />` in `Layout.tsx`; login/portal/set-password pages excluded
- **Test suite expansion:** added `src/lib/healthScore.test.ts` and `src/lib/esgGrading.test.ts`; `vitest.config.ts` updated to include `src/**/*.test.ts`; total tests 200 → 278 (78 new frontend tests); two bug fixes found during testing: `pctDisplayToScore` regex now handles negative values (`-?\d+`), critical-risk ceiling band corrected to `Watchlist` (score=4.0 is `[4,6)` not `<4`)
- **Category Risk Heatmap:** new `src/components/RiskHeatmap.tsx` — table grid, rows=industries, cols=5 risk types, cell=avg score color-coded (green<2, yellow 2–3, amber 3–4, red≥4); new `getRiskHeatmapData()` in `risk.repository.ts` (JS-side aggregation via supplier join); `riskHeatmap` field added to `DashboardOverview` interface and service; rendered in Dashboard between Action Items and bottom grid
- **Portfolio Health widget:** new `src/components/PortfolioHealthWidget.tsx` — large gauge (SVG arc+needle, no library) on left showing avg health score 0–10 with band label; 3 compact Recharts donuts on right (Performance bands, Risk distribution, ESG compliance); health scores computed client-side via existing `calcHealthScore()`; rendered in Dashboard after header
- **Dashboard layout redesign:** stat cards moved from full-width 4-col grid to compact 2×2 grid (`w-[160px]`) in the top-right header area alongside page title + FilterBar; `lg:flex-row` responsive layout; smaller icons, `text-2xl` values, compact sparklines; `ArrowUpRight` removed
- **ESG weight fix:** `calcHealthScore` now uses `overall_esg_score/10` (single source of truth with `esg.service.ts`). `normalizeEsg()` removed from `healthScore.ts`.
- **ESG cert bonus fix:** certification bonus is additive on top of the metric pillar average (then capped at 100), not averaged into the denominator with metric scores.
- **Risk + Performance dedup:** `getLatestAssessmentsSummary` and `getLatestEvaluationsSummary` return one row per supplier (most recent first from repo), deduplicated in the service layer.
- **Performance overall_score:** `computeOverallScore()` in `performance.service.ts`; `overall_score` recomputed on every create and edit, not only at insert time.

---

## Environment

```
VITE_SUPABASE_URL=https://kzpviefgzrwjbpyqmqae.supabase.co
SUPABASE_URL=https://kzpviefgzrwjbpyqmqae.supabase.co   # backend JWKS için zorunlu
VITE_API_URL=http://localhost:3001
REDIS_URL=redis://localhost:6379
SUPABASE_JWT_SECRET — artık kullanılmıyor (ES256/JWKS'e geçildi)
Redis: Docker container (srm-redis) — port 6379
Dev ports: frontend :5174, backend :3001
```

---

## How to Update This File

After each work session, paste the summary of changes into the "Recent Changes" section and update any affected sections above. Keep changelog entries under the same date if multiple sessions happen on the same day.