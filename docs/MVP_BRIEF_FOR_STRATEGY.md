# Project Renter Guardian (PRG) — MVP brief for strategy / business analysis

**Purpose of this document:** Factual product and MVP status for an external model (e.g. ChatGPT) to reason about business case, model, and next steps.  
**Do not invent market size, pricing, legal claims, or competitor facts from this file alone.** Use only reputable external sources for market/legal/finance claims.  
**As of:** July 2026 (post Firestore + Storage backend cutover).

---

## 1. What the business / product is (from the product itself)

**Working name:** Project Renter Guardian (PRG) / Renter Guardian.

**One-sentence product:** A mobile-first app (Expo: iOS, Android, web) that helps **renters** create a private, structured record of a rental property’s condition—especially around **move-in**—using properties, rooms/spaces, photos, notes, a guided inspection flow, and saved report snapshots.

**Problem it targets (inferred from product design, not market research):**
- Renters often lack an organized, timestamped evidence trail of unit condition at move-in.
- Disputes later (deposit, damage claims) are harder without room-level photos and notes.

**Who it is for (primary user in the MVP):**
- Individual **renters** documenting **their** unit(s).
- Not positioned in the current MVP as a landlord property-management suite, broker tool, or marketplace.

**What it is not (MVP):**
- Not AI condition scoring or automated legal advice.
- Not PDF export / court-ready packet generation (UI stub only).
- Not a public social feed or multi-tenant landlord dashboard.
- Not selling CMS content; data is user-owned app data behind Firebase.

---

## 2. Services the product offers today (MVP capabilities)

### In scope and working (shippable core loop)

| Service / capability | Description |
|----------------------|-------------|
| Account & identity | Sign up / log in (email-password and Google). Private account tied to Firebase Auth. |
| Profile bootstrap | Server creates/links an `app_profile` for the user after auth. |
| First-time onboarding | Collects name, language preference, property address/lease fields, nickname; marks onboarding complete. |
| Property management | Create, list, view, update (address/lease/nickname), delete properties. |
| Spaces (rooms) | Default spaces on property create; create/edit/delete custom spaces. |
| Photo documentation | Capture/upload photos (HEIC converted on client where needed), gallery, notes, delete. |
| Photo ↔ space assignment | Assign photos to spaces (including bulk assign). |
| Guided inspection | Start inspection; server creates steps; user progresses through wizard; completion status/progress. |
| Report snapshots | Create/store report with snapshot JSON; list/view under property Report tab and Insights. |
| Preferences | Theme (light/dark/auto) and related user preferences. |

### Partial / incomplete in MVP

| Item | Status |
|------|--------|
| Guided inspection in **onboarding** | Placeholder screen after “inspection ready”—not the full tool. |
| Profile editing | Load + logout work; rich edit UI limited. |
| Insights | Cross-property **report list**, not analytics/insights product. |
| PDF export | Button exists; shows “not yet implemented.” |
| Google Sign-In on web | Can hit browser COOP/popup issues; mobile may be more reliable. |

### Explicitly out of MVP (product roadmap / not built)

- AI space suggestions or condition analysis.
- Automated PDF generation and downloadable legal packets.
- Landlord/property-manager multi-user orgs, invitations, roles.
- Marketplace, paid listings, or insurance partnerships (none in code).
- Public CMS content (disclaimers/jurisdiction) as a live feature path (types/docs historically mentioned; not the live stack focus).

---

## 3. User use-flow (happy path)

1. Land on welcome → sign up or log in.  
2. Onboarding: name → language → property info → lease → nickname → “ready.”  
3. Enter main app tabs: **Properties**, **Inspections**, **Insights**, **Profile**.  
4. Open a property → Overview / Spaces / Photos / Report.  
5. Add or refine spaces; upload photos; assign photos to spaces; add notes.  
6. Start an inspection → complete steps → system stores progress/completion.  
7. Report snapshot available for later review (property Report and/or Insights).  
8. Return later to add photos or run another inspection as needed.

**Primary UX use cases**

- “I just got keys—document every room before I move furniture in.”  
- “I need photos labeled by room with dates/notes.”  
- “I want a guided checklist so I don’t forget areas.”  
- “I want to find my past documentation later.”

---

## 4. UX / UI (current)

- **Platforms:** Expo React Native — mobile-first; web supported for development/smoke testing.  
- **Shell:** Four bottom tabs; property dashboard with sectioned navigation.  
- **Design system:** Shared `PRG*` components (buttons, cards, inputs, toasts, etc.); light/dark/auto theme.  
- **Tone:** Professional / high-trust documentation tool (not consumer social).  
- **Known UX gaps:** Onboarding placeholder for guided inspection; PDF stub; Insights naming vs reality; web console deprecation noise and possible Google popup friction.

---

## 5. Technical reality (relevant to business ops / cost)

**Architecture:**  
Expo client → Firebase Authentication → Cloud Functions (HTTPS API) → Cloud Firestore (structured data) + Cloud Storage (photo bytes).  
Client never talks to Firestore/Storage directly; ownership enforced in Functions via `app_profile_id`.

**Implications for the business:**
- Variable costs: Firebase Auth, Functions invocations, Firestore reads/writes, Storage bandwidth/storage, photo upload sizes.  
- No separate Strapi/Directus CMS in the live path (removed).  
- Greenfield data model after CMS migration—no legacy Directus migration required.  
- Solo/small-team operable; secrets and infra live in Firebase/GCP project `project-renter-guardian`.

---

## 6. Business model — what is known vs unknown

### Known from the product (facts)

- MVP is a **B2C renter documentation app** (consumer software).  
- No in-app payments, subscriptions, ads, or partner integrations appear implemented.  
- Value delivered today is **self-serve digital documentation** for the renter.

### Unknown / not defined in the codebase (must not be stated as fact)

- Pricing (free, freemium, subscription, one-time, usage-based).  
- Whether landlords, property managers, or attorneys are future customers.  
- Geographic launch market (product has optional `state_code` / jurisdiction-shaped fields historically; not a full legal-product).  
- Regulatory positioning (e.g. whether outputs are “evidence,” “not legal advice,” etc.).  
- Go-to-market channels and brand legal entity.

**Instruction for ChatGPT:** Treat Section 6 unknowns as open questions. Propose options and cite only reputable sources (e.g. government housing/deposit rules for a named jurisdiction, established industry reports, academic or major news/business publications)—do not invent statistics.

---

## 7. Business case (product-grounded framing)

**Hypothesis the MVP supports (product logic, not proven market):**  
If renters can quickly capture room-level photos and a structured inspection record at move-in, they gain a clearer personal archive that may help in deposit/condition conversations later—enough value to download, complete onboarding, and finish at least one property documentation cycle.

**What the MVP already validates technically:**  
End-to-end loop: account → property → spaces → photos → inspection → stored report, on a scalable Firebase backend.

**What the MVP does not yet validate:**  
Willingness to pay, retention, viral acquisition, landlord demand, or legal defensibility of exports.

---

## 8. Potential revenue-generating channels (candidates only)

List as **options to evaluate**, not current revenue:

1. **Consumer subscription** — unlimited properties/photos/storage; free tier caps.  
2. **One-time unlock** — e.g. “export pack” / PDF / shareable link when that exists.  
3. **Usage-based** — storage or high-res photo limits.  
4. **B2B2C** — property managers or student housing distribute the app; renter still documents.  
5. **Partnerships** — renters insurance, deposit alternatives, tenant unions, universities (requires business development; none built).  
6. **Professional add-ons** — attorney/reviewer templates (future; legal risk).

Do not claim any channel is live.

---

## 9. Required customer journeys (for next-step planning)

### Journey A — First-time renter (must work for MVP success)

Acquire → install/open → trust/sign up → complete onboarding → document first property (spaces + photos) → finish or skip inspection → see a saved report → understand “what to do next time.”

**Friction points today:** onboarding inspection placeholder; PDF expectation; web Google auth quirks.

### Journey B — Returning user

Open app → find property → add new photos or start another inspection → find old reports in Insights/Report.

### Journey C — Share / escalate (mostly future)

Export or share documentation with landlord, roommate, or advisor — **blocked** until share/PDF (or equivalent) exists.

### Journey D — Paid conversion (undefined)

Moment of value (e.g. export, second property, storage limit) → paywall — **not designed in MVP.**

---

## 10. Suggested inputs for “next steps” analysis

When recommending next steps, prioritize in this order unless business goals say otherwise:

1. **Product:** Close Journey A gaps (onboarding CTA, expectations around PDF, mobile QA of photo+inspection).  
2. **Trust/legal:** Clear in-product disclaimer (documentation aid, not legal advice)—content/policy work.  
3. **Monetization experiments:** Only after a measurable activation metric (e.g. % users who upload N photos or complete one inspection).  
4. **Expansion:** Landlord/PM or partnerships only after renter retention signal.  
5. **Cost control:** Watch Storage + Functions costs as photo volume grows.

---

## 11. One-paragraph summary for models

Project Renter Guardian is an Expo mobile app that lets renters privately document rental unit condition via properties, rooms, photos, guided inspections, and saved report snapshots, backed by Firebase Auth, Cloud Functions, Firestore, and Storage. The MVP’s core documentation loop works; PDF export, AI, and paid features are not built. There is no coded business model yet—the product is positioned as B2C renter self-serve documentation. Strategy work should treat market size, pricing, and legal claims as external research questions requiring reputable sources, while using this brief as the source of truth for what the product actually does today.
