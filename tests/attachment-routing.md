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

## Pass criteria

All four tests must pass for this attachment-routing change to be
considered complete. Test 1 is the priority — it's the actual bug that
prompted this work — but 2–4 confirm the router doesn't regress the paths
that were already working (quote gating) or over-correct into always
assuming "photos" (ambiguous case).

## Notes for future runs

- Tests 1–3 depend on `inspectAttachment`'s vision call actually reading
  the image/PDF correctly — if a real run fails, check whether the failure
  is in classification (`document_type`/`confidence` wrong) vs. in
  downstream handling (`routeForAttachment` or `buildOfferResponse` wrong
  given a correct classification) before concluding the routing logic
  itself is broken.
- If `inspectAttachment` throws or returns unparseable JSON, it fails safe
  to `null` → `routeForAttachment(undefined, undefined)` → `"neutral"`.
  Confirm this fail-safe path also gets exercised at least once (e.g. by
  temporarily breaking the API key) rather than only ever testing the
  happy path.
