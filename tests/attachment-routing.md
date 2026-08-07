# Regression Test Suite — Attachment Routing

Covers: `inspectAttachment`, `routeForAttachment`, `buildOfferResponse`,
WORKMANSHIP PHOTO REVIEW (SYSTEM_PROMPT)

Origin: real user session (see conversation screenshots, [date]) where a
user uploaded 12 installation photos with the caption "Here is my HVAC
quote. What do you think?" — the default upload caption in `page.tsx`
falsely called every attachment a "quote," and the pre-inspection gate had
no way to tell photos from a real proposal. Mike responded with pricing,
warranty, and a report offer for a workmanship-review request. This
exposed a real routing bug (attachment type ignored in favor of the
caption's wording) and is treated as a permanent regression test, not a
one-off fix.

---

## Test 1 — Attachment Type Overrides Caption (the original bug)

**Input:**
- Upload: HVAC installation photos (equipment already installed, no
  pricing/proposal document)
- Caption: "Here is my HVAC quote. What do you think?"

**Expected:**
- [ ] `inspectAttachment` classifies `document_type: "installation_photos"`
- [ ] `routeForAttachment` returns `"workmanship"`
- [ ] `workflowState` is **not** set to `"offered"` — the report gate is
      bypassed entirely for this turn
- [ ] Reply opens with a warm, specific acknowledgment of the photos (not
      the generic report-offer opener)
- [ ] Reply reviews visible workmanship directly in chat, not gated behind
      the report
- [ ] Coverage includes, where visible: duct transitions, condensate
      routing, refrigerant-line insulation, electrical routing, clearances,
      mounting/support, visible sealing/finish quality
- [ ] Reply distinguishes what's actually visible in the photo from what
      can't be confirmed from a photo alone (e.g. refrigerant charge,
      static pressure, connections inside sealed panels)
- [ ] Reply does **not** fabricate code violations, defects, or issues not
      actually visible
- [ ] Reply does **not** push the user to upload a quote or steer toward
      the Second Opinion Report
- [ ] If the user later uploads an actual quote in the same conversation,
      that later turn is treated as its own separate quote-review path
      (fresh `inspectAttachment` call on the new attachment, can still
      route to `"gated"` even though this turn routed to `"workmanship"`)

**Log events to check:** `attachment_inspected` (`route: "workmanship"`),
absence of `report_offer_gate_triggered` for this turn.

---

## Test 2 — Real Quote PDF, Generic Caption

**Input:**
- Upload: an actual contractor quote/proposal PDF
- Caption: generic or none (e.g. default "Here is my HVAC quote." caption)

**Expected:**
- [ ] `document_type: "quote_or_proposal"`, `confidence` not `"low"`
- [ ] `routeForAttachment` returns `"gated"`
- [ ] `workflowState` → `"offered"`, `offer_key_facts` persisted
- [ ] Reply uses `buildOfferResponse("fairness", facts)` (or another intent
      if the caption text implies one) — warm opener + real extracted facts
      (brand/tonnage/price, whatever was legible) + evaluation clause +
      report offer line
- [ ] No pricing verdict, scope judgment, or recommendation appears in this
      reply — only acknowledgment + offer, per the existing hard gate

**Log events to check:** `attachment_inspected` (`route: "gated"`,
`documentType: "quote_or_proposal"`), `report_offer_gate_triggered`.

---

## Test 3 — Warranty Document

**Input:**
- Upload: a manufacturer or contractor warranty PDF/photo
- Caption: something like "Is this warranty any good?"

**Expected:**
- [ ] `document_type: "warranty_document"`, `confidence` not `"low"`
- [ ] `routeForAttachment` returns `"gated"`
- [ ] `detectOfferIntent` resolves to `"warranty"` (caption contains
      "warranty")
- [ ] Reply uses the warranty evaluation clause ("what's actually covered,
      what's excluded, and how it compares with the rest of the
      proposal") — not the generic fairness clause
- [ ] Same hard-gate rules as Test 2: no coverage verdict given in chat
      before acceptance

**Log events to check:** `attachment_inspected`
(`documentType: "warranty_document"`, `route: "gated"`),
`report_offer_gate_triggered` (`offerIntent: "warranty"`).

---

## Test 4 — Ambiguous / Poor-Quality Image

**Input:**
- Upload: a blurry, cropped, or otherwise unclear image (not confidently
  identifiable as any of the four known types)

**Expected:**
- [ ] `inspectAttachment` returns `confidence: "low"` (or `document_type`
      genuinely can't be determined and comes back `"other"`)
- [ ] `routeForAttachment` returns `"neutral"`
- [ ] `workflowState` stays `"not_triggered"` — no gate forced either way
- [ ] Reply falls through to a normal model turn — Mike should ask what
      the image is or respond to whatever the user actually said, not
      guess and commit to a wrong path
- [ ] No fabricated document_type-specific content (no invented pricing
      talk, no invented workmanship review) appears in this reply

**Log events to check:** `attachment_inspected` (`route: "neutral"`),
absence of both `report_offer_gate_triggered` and a workmanship-specific
response.

---

## Test 5 — Non-HVAC Document From a Multi-Trade Vendor (real production case)

Origin: real user session, [date] — a $49,600 electrical rewiring estimate
(full-house rewire, panel/meter upgrade to 200A, permits) from a vendor
whose letterhead reads "H · Heating · Cooling." The document is genuinely
an estimate/proposal in form, but the underlying work is electrical, not
HVAC. Before the `is_hvac_related` field existed, this would have routed
to `"gated"` purely off the vendor's HVAC-sounding branding and offered
the Second Opinion Report on work Mike has no business evaluating.

**Input:**
- Upload: a contractor estimate for non-HVAC work (electrical, plumbing,
  roofing, etc.) from a vendor whose name or letterhead suggests HVAC
- Caption: generic (e.g. default "Here's what I've got. What do you
  think?" caption)

**Expected:**
- [ ] `inspectAttachment` returns `is_hvac_related: false`, judged from the
      actual scope of work described (rewire, panel upgrade, outlets/
      switches) — not from the vendor's company name
- [ ] `document_type` still gets classified normally (e.g.
      `"quote_or_proposal"`) even though `is_hvac_related` is false, so the
      decline message can name what it actually is
- [ ] `routeForAttachment` returns `"out_of_scope"` — checked before, and
      overriding, whatever the document_type routing would otherwise be
- [ ] `workflowState` stays `"not_triggered"` — no report offer goes out,
      and a later genuinely-HVAC attachment in the same conversation can
      still trigger the gate normally
- [ ] Reply is the fixed `buildOutOfScopeResponse` text: acknowledges the
      upload, names the document type honestly, states plainly that Mike
      is HVAC-only, and invites an HVAC-specific document instead
- [ ] No attempt to evaluate the non-HVAC pricing, scope, or fairness in
      any form - the decline is clean, not a partial analysis

**Log events to check:** `attachment_inspected`
(`isHvacRelated: false`, `route: "out_of_scope"`),
`attachment_out_of_scope`, absence of `report_offer_gate_triggered`.

**Actual result (this run):** Passed. Full reply: *"Thanks for sending
this over - I took a look. This looks like an estimate or proposal for
work that isn't HVAC-related. I'm built specifically for HVAC decisions,
so I'm not the right fit to evaluate this one. If you also have an HVAC
quote, warranty, or system photo, happy to take a look at that instead."*

---

## Pass criteria

All five tests must pass for this attachment-routing change to be
considered complete. Test 1 and Test 5 are both real production cases
(not synthetic) and take priority - 2–4 confirm the router doesn't
regress the paths that were already working (quote gating) or over-correct
into always assuming "photos" (ambiguous case) or "out of scope" (a
genuine HVAC document from a multi-trade vendor should NOT be declined -
worth spot-checking that a real HVAC quote from the same kind of
multi-trade company still routes to "gated" normally, as a companion check
to Test 5).

## Notes for future runs

- Tests 1–3 depend on `inspectAttachment`'s vision call actually reading
  the image/PDF correctly — if a real run fails, check whether the failure
  is in classification (`document_type`/`confidence`/`is_hvac_related`
  wrong) vs. in downstream handling (`routeForAttachment` or
  `buildOfferResponse`/`buildOutOfScopeResponse` wrong given a correct
  classification) before concluding the routing logic itself is broken.
- If `inspectAttachment` throws or returns unparseable JSON, it fails safe
  to `null` → `routeForAttachment(undefined, undefined, undefined)` →
  `"neutral"` (not `"out_of_scope"` - `is_hvac_related` defaults to
  in-scope on failure, so an inspection error can't accidentally block a
  legitimate HVAC document). Confirm this fail-safe path also gets
  exercised at least once (e.g. by temporarily breaking the API key)
  rather than only ever testing the happy path.
- Test 5's vendor-name-vs-actual-scope distinction is the kind of thing
  that could regress silently if INSPECTION_PROMPT is ever edited - worth
  re-running this specific test after any future change to that prompt,
  not just after changes to the routing code.
