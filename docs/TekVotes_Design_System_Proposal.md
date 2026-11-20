# TekVotes Design System — Proposal v0.1
For your approval. Nothing here is final until you choose. Values are starting points to refine on real screens.

## 1. Brand direction
**Personality:** confident, celebratory, trustworthy with money. Think "awards night" rather than "generic SaaS".
**Differentiation:** the reference site uses a mostly single-blue look. TekVotes goes **deep indigo + gold**: indigo for trust, gold for the trophy/winner feeling.

## 2. Colors (design tokens)
| Token | Hex | Use |
|-------|-----|-----|
| `ink-900` | `#0E1030` | Headings, dark surfaces |
| `ink-700` | `#2A2D55` | Body text on light |
| `ink-500` | `#5B5F85` | Secondary text |
| `ink-200` | `#D9DBEA` | Borders |
| `ink-50` | `#F6F7FC` | Page background |
| `brand-600` | `#4B35E0` | Primary buttons, links |
| `brand-700` | `#3B28B8` | Hover/pressed |
| `brand-100` | `#E8E5FD` | Tinted backgrounds |
| `gold-500` | `#F2A900` | Accent: votes, winners, highlights |
| `gold-100` | `#FDF3D6` | Gold tint |
| `success-600` | `#0F9D6B` | Paid, approved |
| `warning-600` | `#C77700` | Pending, review |
| `danger-600` | `#D13A3A` | Failed, rejected, destructive |

Rules:
- Gold is an accent, never body text on white (low contrast). Use ink text on gold.
- Money states always pair color with a label and icon (never color alone): Pending, Available, Settled, Refunded.
- Per-event branding changes only `brand-*` and logo/banner through validated tokens. Platform admin and finance screens stay on TekVotes colors.
- **All pairs must be checked against WCAG AA contrast in build; I will adjust hexes if any fail.**

## 3. Typography
| Role | Font | Notes |
|------|------|-------|
| Headings | **Sora** | Distinctive geometric, good for big numbers |
| Body/UI | **DM Sans** | Readable on mobile |
| References, codes, receipts | **JetBrains Mono** | Order references, contestant codes |

All three are free Google fonts, loaded with `next/font` (self-hosted, no layout shift).
Scale (mobile → desktop): H1 32→56, H2 26→40, H3 20→28, body 16, small 14. Tabular numerals for vote counts and money.

## 4. Logo direction (concept briefs, not final art)
Three directions to choose from:
1. **Check-in-spark:** a bold "T" whose crossbar forms a checkmark, with a small gold spark. Reads "vote confirmed".
2. **Ballot-star:** a rounded ballot box with a gold star dropping in. Reads "awards + voting".
3. **Wordmark only:** "TekVotes" in Sora Bold, "Tek" in ink and "Votes" in indigo, with a gold dot. Fastest, works small.

Constraints: works at 24px favicon, one-color version, dark-background version, no resemblance to the reference site's check-in-square mark. I can generate concept images for any direction you pick.

## 5. Shape, spacing, motion
- 8px spacing grid. Radius: 12px cards, 10px inputs/buttons, full-round for chips.
- Soft shadow for cards; no heavy gradients. One signature element: a subtle indigo-to-gold gradient used only on hero/winner moments.
- Motion: short (150–250ms), respect `prefers-reduced-motion`. Live vote counters animate gently, never flash.

## 6. Core components (build order)
Button, Input/OTP field, Select, Card, Contestant card (photo, number, name, Vote), Event card (poster, type badge, org, Vote Now), Package picker, Vote amount stepper (whole numbers only), Price breakdown (base + surcharge + total), Status badge, Leaderboard row (rank, bar, count per visibility mode), Stepper (How to vote), Data table (finance), Toast, Modal with required "reason" field, Empty/error states.

## 7. Accessibility and mobile rules
- Touch targets at least 44px; primary actions reachable by thumb at the bottom of mobile screens.
- Visible focus rings, labels on every field, error text linked to inputs.
- OTP input supports SMS autofill and paste.
- Pages stay usable on low-end phones and slow networks: optimized images (Cloudinary transforms), minimal JS on public pages.

## 8. Decision needed
Pick: (a) palette as proposed or adjustments, (b) logo direction 1, 2 or 3, (c) fonts as proposed.
