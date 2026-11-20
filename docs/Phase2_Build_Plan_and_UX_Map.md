# TekVotes — Phase 2 Build Plan & UX / Screen Map
Planning only. No code until you approve. Builds on TAS v1.0 ([Part 1](file:///C:/Users/Mac-Felix/.gemini/antigravity/brain/c8c783b0-b374-43e9-8dea-1725a0b5e7b4/TAS_v1.0_Part1_Foundation_and_Schema.md), [Part 2](file:///C:/Users/Mac-Felix/.gemini/antigravity/brain/c8c783b0-b374-43e9-8dea-1725a0b5e7b4/TAS_v1.0_Part2_Security_Voting_Finance.md), [Part 3](file:///C:/Users/Mac-Felix/.gemini/antigravity/brain/c8c783b0-b374-43e9-8dea-1725a0b5e7b4/TAS_v1.0_Part3_Workflows_API_Ops.md)).

---

## A. Phase 2 scope — Foundation
Roadmap exit condition: **tenant isolation and role tests pass.**

### In scope
| # | Work package | Deliverables |
|---|--------------|--------------|
| 2.1 | Repo & tooling | Next.js + TS + Tailwind monorepo layout (modules per TAS §1.6), lint rule blocking cross-module table access, env validation, CI skeleton |
| 2.2 | Supabase project setup | local/staging/prod projects, CLI migrations, secrets handling, `fin`/`private` schemas, revoked default grants |
| 2.3 | Core migrations | enums, `currencies`, `profiles`, `platform_staff`, `permissions`, `role_templates`, `role_template_permissions`, `role_assignments`, overrides, `organization_applications`, `organizations`, `organization_members`, `organization_invitations`, `reserved_slugs`, `audit_logs`, `idempotency_records` |
| 2.4 | Seed data | permission keys (TAS §6.1), system role templates (§6.2). **No** commission rate seeded |
| 2.5 | Authz functions | `private.has_perm`, `has_any_event_assignment`, `is_platform`, `grant_role` (no-escalation + financial guard), audited revoke |
| 2.6 | RLS policies | for every Phase 2 table; client roles SELECT-only |
| 2.7 | Auth flows | sign-up/sign-in, email verification, MFA enforced for Super/Finance Admin, session handling via `@supabase/ssr` |
| 2.8 | Org application workflow | public application form, Super Admin review (approve/reject with reason), owner assignment, per-org financial accounts placeholder |
| 2.9 | Invitations & delegation | invite by email, accept flow, scoped role assignment, revoke/expire |
| 2.10 | Audit & idempotency | `audit()` helper, immutability triggers on `audit_logs`, `Idempotency-Key` middleware |
| 2.11 | Test suites | pgTAP RLS cross-tenant matrix, delegation escalation tests, immutability tests, auth integration tests |

### Out of scope for Phase 2
Events, contestants, voting, payments, ledger tables, judging, notifications vendors (all later phases).

### Exit tests (must pass)
1. User of Org A cannot read any Org B row in any Phase 2 table.
2. Revoked or expired assignment grants nothing; `deny` override beats `grant`.
3. Org Admin cannot grant a permission they lack, and cannot grant financial permissions.
4. Org membership never yields platform privileges.
5. `audit_logs` cannot be updated or deleted, even via the service role.
6. Rejecting an organization requires a reason and is audited.
7. Only the Super Admin can approve an application; a non-staff user cannot.
8. Service-role key is absent from the client bundle (CI check).

### Dependencies / risks
| Item | Impact on Phase 2 |
|------|-------------------|
| Email provider not chosen | Use Supabase default email in dev/staging; swap before launch |
| SMS vendor not chosen | None (OTP is Phase 4) |
| Paystack/legal sign-off | None until Phase 5 |
| Supabase plan tier (PITR etc.) **[V]** | Decide before production, not before Phase 2 |

---

## B. UX / screen map

### B.1 Public site (mobile-first, no login)
| Screen | Key content / actions |
|--------|-----------------------|
| Home | Featured competitions, search, "Apply as organization" |
| Competition directory | Filter by type, status, date |
| Organization profile | Logo, events list |
| Event landing | Banner, description, sponsors, dates, categories, countdown; "Coming Soon" until voting is approved |
| Contestant profile (`/c/[code]`) | Photos, bio, social links, Vote button, share + QR, report |
| Vote checkout | Pick category (if multiple), package or custom amount, phone OTP (guests), price breakdown (base + surcharge), pay |
| Payment status / receipt | Reference, status polling, download receipt |
| Leaderboard | Per category, honours Hidden / Live / Final and visibility mode |
| Final results | Winners, correction notice if any |
| Report form | Profile or suspicious activity |

### B.2 Voter account (`/me`)
Voting history · payment history & receipts · favourites · event history · notification preferences · profile.

### B.3 Organization console (`/org/[slug]`)
| Area | Screens |
|------|---------|
| Overview | Status, quick stats, pending tasks |
| Team | Members, invitations, roles & permission editor |
| Events | List, create wizard, duplicate |
| Event workspace | Settings · Categories & pricing/packages · Voting limits · Contestants & entries · Managers · Sponsors · Branding · Judges & criteria · Voting controls (pause/resume/close with reason) · Leaderboard state · Results · Announcements · Reports/exports |
| Finance (if enabled) | Summary (gross/pending/available/paid), transactions, settlement destinations, settlement requests, refunds |
| Moderation | Reports queue for the org's events |

### B.4 Contestant-manager portal (`/manage`)
Assigned entries list · edit profile/media/social links · performance stats (permitted).

### B.5 Judge portal (`/judge`)
Assignments · scoring sheet per contestant (criteria, validation) · submit/lock confirmation · correction request.

### B.6 Platform admin (`/admin`)
Org applications queue · event approval queue · commission rules · fraud flags · vote corrections · domains · refunds/chargebacks · reconciliation · settlements (finance review → super approval) · audit log viewer · platform settings.

### B.7 Cross-cutting UX rules
- Mobile-first, PWA installable, accessible (keyboard, contrast, screen-reader labels).
- Money always shown as GHS with two decimals; gross/net/pending/settled labelled distinctly.
- Destructive or financial actions need a confirmation step and a reason.
- Design tokens (colors, type, spacing) defined once; per-event branding only via validated tokens.

---

## C. Key user journeys to prototype first
1. Organization applies → Super Admin approves → owner invites an admin.
2. Organizer builds an event → submits for approval → Super Admin approves.
3. Voter finds contestant via QR → OTP → pays → receipt.
4. Finance Admin reviews settlement → Super Admin approves.

## D. Decisions I need from you before Phase 2 starts
1. **Brand direction:** do you have a logo, colors, or design references? If not, I can propose a design system in the next step.
2. **Hosting accounts:** will you create the Supabase and Vercel projects, or should I prepare setup instructions?
3. **Super Admin bootstrap:** who is the first Super Admin (email)? It will be seeded by migration or CLI, never through the UI.
