# Mike's Learning Engine — Long-Term Vision (Document, Don't Build)

**Status: vision doc only.** Nothing below is scheduled. This exists so the
thinking isn't lost, not as a spec to implement. Re-read this when real data
volume starts surfacing the specific questions each layer answers — see
"No abstraction before repetition" at the bottom.

## The core idea

Mike shouldn't just answer questions — he should continuously learn from
every interaction. Five knowledge streams, not all equally urgent:

1. **Quote Intelligence** — structured extraction from every uploaded quote
   (metro/ZIP, contractor, equipment, models, tonnage, efficiency, price
   breakdown, warranty, scope, financing, included/excluded work).
2. **Market Intelligence** — web search + verified quote data for
   current, regionally-grounded pricing instead of relying on model memory.
3. **Conversation Intelligence** — mine existing chat transcripts for what
   confuses homeowners, where they hesitate, which explanations land, which
   contractor tactics create uncertainty. Different from Quote Intelligence:
   this teaches Mike how to communicate, not what to know. Can start
   immediately since it needs no new capture mechanism — the data already
   exists in past conversations.
4. **Decision Intelligence** — patterns across the quote corpus (common
   scope omissions, typical warranty structures, frequent upsells, regional
   price differences, common equipment combos). These are conclusions, not
   raw data — they need their own evidence record, separate from the
   evidence of the quotes they're built from.
5. **Outcome Intelligence** (deliberately Phase 2, deferred) — not just
   "what was the quote" but "what actually happened": which contractor was
   chosen, final price paid, satisfaction, callbacks, 6-month regret.
   Deferred because it requires new infrastructure (persistent
   identification of a person across months, consent/retention questions
   that don't exist for the other streams, low/biased survey response
   rates). Worth flagging for the same future legal review as the
   trademark question, since it's the first stream that turns Mike from
   "analyzes documents people upload" into "maintains records about
   specific people over time." Lightweight proxy signals (did they upload
   another quote, repair vs. replace choice, would-recommend) are cheap
   and can be collected now without building the hard version.

## The Evidence Engine (the "why trust this" layer)

The direct fix for the root cause of the Houston/Pearland bug: Mike didn't
just lack data, he didn't know the limits of what he had. Two levels:

**Level 1 — Individual facts** (quotes, web searches, manufacturer data):
source, date collected, metro/region, equipment category, confidence,
freshness, coverage, expiration date (when applicable).

- **Freshness vs. Expiration are different mechanisms, not one decaying
  score.** Freshness = gradual staleness (labor rates, pricing, contractor
  practices — still weak evidence when old, not zero). Expiration = a hard
  cliff on a specific date (rebates, tax credits, financing promos — wrong
  to cite at all once past the date, not "a bit stale").

**Level 2 — Derived knowledge** (Decision Intelligence patterns): supporting
sample size, confidence, freshness, coverage, source mix, last-updated date.

- **Confidence and Coverage must stay separate**, not collapsed into one
  score. Confidence = how strong is the evidence for *this specific*
  conclusion (sample size within a metro+equipment+tier slice). Coverage =
  how broadly does it generalize (5 metros vs. 1 metro at equal sample
  size). Collapsing them hides thin-but-locally-consistent-looking data —
  the exact shape of bug that already happened once.

## Evidence Hierarchy

Not all sources are equal, but **weight must depend on (source type ×
claim type), not source type alone** — the same mistake as collapsing
confidence/coverage. Manufacturer documentation is very-high-weight for
equipment specs but near-worthless for regional installed pricing, since
manufacturers don't set installed price. A flat per-source weight table
would recreate the overconfidence bug on a different axis.

Illustrative starting point (needs the matrix treatment above before it's
real):

| Source | Typical weight |
|---|---|
| Verified homeowner quote | Very High (pricing/scope) |
| Manufacturer documentation | Very High (specs), Low (pricing) |
| Multiple independent contractor quotes | High |
| Building code / Manual J guidance | High |
| Reputable industry publications | Medium-High |
| Current web search | Medium (source-dependent) |
| Single Reddit post | Low |
| Single anecdote | Very Low |

**Surfacing decision:** default to Mike reasoning over evidence weight
internally and expressing it as plain-language confidence ("I've seen this
consistently across dozens of quotes" vs. "I've only seen a couple
examples, take this with a grain of salt") rather than exposing raw counts
("I have 18 verified Houston quotes..."). Exposing the count implies a
live, queryable database that doesn't exist and isn't the product.

## The bigger frame

Started as "analyze an HVAC quote." Could become "an evidence-based
decision engine for homeowners" — domain-agnostic learning engine, with
HVAC as the first vertical (roofing, solar, remodeling, plumbing, insurance
claims as later verticals, same underlying engine). This is the long-term
moat: a growing corpus of structured, evidence-weighted real-world
decisions is much harder to replicate than adding web search.

## What ships now instead (Phase 1)

Every uploaded quote stores only:
- Source (Reddit, Facebook, homeowner, own house, etc.)
- Date collected
- Metro / ZIP
- Structured quote fields (equipment, pricing, warranty, scope — see
  `quote-schema-v1.md`)

No confidence/freshness/coverage/expiration/evidence-hierarchy fields yet.

Priority order: (1) get ingestion working, (2) collect hundreds of real
quotes, (3) verify extraction accuracy, (4) use the data to improve Mike.
Confidence scoring and evidence weighting get built only after the data
volume makes their absence a felt problem, not before.

## No abstraction before repetition

Don't build a feature because you think you'll need it. Build it after
seeing the same problem ~20 times in real data.

- If after ~300 quotes you're repeatedly asking "how old is this data?" —
  build freshness.
- If after ~500 quotes you're repeatedly asking "how many examples support
  this?" — build confidence.
- If after ~1,000 quotes you're repeatedly asking "does this apply outside
  Houston?" — build coverage.

Let the questions from real data drive the architecture, not the other way
around. Every real improvement to Mike so far (Houston pricing, Learn Mode,
Empathy, Warranty Guidance) came from shipping a fix to an observed
problem, not from architecting ahead of one.

## Schema evolution loop (added 2026-08-03)

Every time a real quote is reviewed, ask two questions:

1. What can Mike learn from this quote that would help future homeowners?
2. Is there anything in this quote the schema doesn't currently capture?

**The tiebreaker — this is the part that keeps this loop from becoming
"no abstraction before repetition" violated one field at a time:**

If a quote surfaces something new, capture it in `notes` immediately —
always, no exceptions, this costs nothing. Only promote it to a first-class
schema field once the *same* pattern has shown up across a few different
quotes, not the first time it's seen. A single quote is evidence a field
*might* eventually be worth adding, not evidence it should be added now.

Fields promoted so far because they repeated across multiple quotes:
- `tier_info` / proposal tiering (good/better/best) — seen in 3+ quotes
  before being added
- Upsell/add-on menus as a structured pattern — seen across the Chino,
  Rocket Air, and Eco Columbus quotes

Patterns seen only once so far and deliberately left in `notes`, not
promoted to fields yet: membership-inclusion structure, luxury add-on
categories (scent devices, UVC lamps), "warranty strategy" as its own
labeled concept. Revisit if these repeat.

Vendor-stated projections (annual savings, noise reduction, carbon
reduction, etc.) are marketing claims, not measured outcomes — this is a
Mike *behavior* rule, not a schema field, since storing the number in a
field doesn't stop Mike from repeating it as fact. Mike should present
these as "the contractor projects X," never as a guaranteed result.

Learnings from quotes can go into Mike's actual prompt-level knowledge
immediately, as a hand-written rule, without waiting for the retrieval
layer (Phase 3) to exist — same pattern as Houston pricing and warranty
guidance. Don't let insights sit idle in the corpus if they're ready to
help users now.

Not every quote needs to teach something new to be worth collecting — most
quotes in a mature dataset will confirm patterns already known rather than
reveal new ones, and that's expected: it strengthens confidence in a
pattern rather than being a missed opportunity.
