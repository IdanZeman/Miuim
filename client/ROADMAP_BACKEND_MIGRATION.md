# Backend Migration Roadmap (Supabase)

Date: 2026‑02‑08
Goal: Move critical logic from frontend to backend (RPC/Edge) with full RLS enforcement.

---

## 0) Outcomes
- **No direct writes from UI** (except explicitly public endpoints).
- **All business rules** enforced in DB/RPC/Edge.
- **RLS ON** for all tables, consistent org‑scoping.
- **Audit trail** for sensitive actions.

---

## 1) Immediate Safety Fixes (Week 1)
**Priority:** Highest

1. **Enable RLS on remaining tables:**
   - task_templates, organization_invites, acknowledged_warnings, lottery_history, equipment.
2. **Add baseline policies (org‑scoped):**
   - SELECT/INSERT/UPDATE/DELETE for authenticated users limited to their org.
3. **Lock down public SELECT policies** where not required.
4. **Verify RPCs run with SECURITY DEFINER** and always check `get_my_org_id()`.

Deliverable: RLS coverage at 100% and verified access constraints.

---

## 2) Replace Direct UI Writes (Week 1–2)
**Priority:** High

1. **Create/extend RPCs** for all write actions:
   - People / Teams / Roles
   - Shifts / Absences / Constraints
   - Equipment / Daily checks
   - Gate logs / Authorized vehicles
   - Organization settings / Invites
2. **Update services layer** to use RPCs (no `from().insert/update/delete`).
3. **UI → services only** (remove direct Supabase calls in `src/features`).

Deliverable: All writes go through `src/services` + RPCs.

---

## 3) Normalize Read Access (Week 2)
**Priority:** Medium

1. **Bundle reads** into RPCs for heavy screens (reduce round‑trips):
   - org data bundle, scheduling, dashboard, admin stats.
2. **Strict typed DTOs** shared between FE/BE.
3. **Cache heavy reads** (optional):
   - Supabase edge, Redis, or in‑memory if available.

Deliverable: Stable and fast read paths.

---

## 4) Audit & Observability (Week 2–3)
**Priority:** Medium

1. **Standardize audit logging** for all sensitive mutations.
2. **Add structured metadata** for change diffs.
3. **Add error reporting** (correlate errors with RPC/action).

Deliverable: Every critical action audited end‑to‑end.

---

## 5) Hardening & Cleanup (Week 3)
**Priority:** Medium

1. **Remove legacy direct table access** from services/UI.
2. **Remove dead SQL/migrations** and consolidate policies.
3. **Add tests** for RLS (positive/negative access cases).
4. **Add migration checklist** for future changes.

Deliverable: Clean architecture + enforceable standards.

---

## 6) Suggested Module Order (Practical Sequence)
1. **Personnel** (people/teams/roles)
2. **Scheduling** (shifts/constraints/absences)
3. **Attendance** (daily_presence)
4. **Equipment**
5. **Gate / Battalion**
6. **Admin / System**

---

## 7) Best‑Practice Rules (Architecture)
- **FE = UI only**: no direct DB writes.
- **Services call RPCs** only; RPCs enforce permissions.
- **RLS ON** everywhere; no “God Mode” policies unless strictly admin‑only.
- **Input validation** inside RPC/Edge (fail fast).
- **Idempotent writes** for safe retries.

---

## 8) Acceptance Criteria
- 0 direct writes from UI/components.
- 100% RLS coverage on public tables.
- All write paths audited.
- No public SELECT policies without explicit justification.

---

If you want, I can turn this into a task checklist per file/feature and start implementing phase 1.