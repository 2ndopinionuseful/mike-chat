# Regression Test #4: High-Information Quote Flow

**Test name:** High-information quote flow
**Severity:** P0 - release blocking
**Origin:** Live testing session, 2026-07-27, immediately after the file-upload bug was fixed (Vercel 4.5MB limit worked around via direct-to-Blob uploads).

**The failure observed:** uploaded a real HVAC quote PDF and said "Here is my HVAC quote. What do you think?" Mike gave excellent analysis - correct model numbers, a specific price verdict ("$17,052... fair, leaning toward reasonable"), explicit assumptions, and practical advice about duct sealing. It never offered the report. When the user said "That's really helpful, thanks. I think I have what I need for now" (neutral, no report-shaped language), Mike replied "Good luck with the install" and the conversation ended - no offer, no report, no revision code, no saved record, no feedback capture. Compare: an earlier sparse-information test in the same session DID trigger the offer correctly. The richer the conversation got, the less likely Mike was to offer - exactly backwards.

**Business risk if this fails:** Mike gives away the full personalized quote analysis in chat, so no report is created, no structured record is saved, and no feedback is captured. This is the core paid-eventually product delivered for free with zero capture, specifically in the highest-value conversations - worse than the pricing-confidence bugs, which only made Mike wrong sometimes.

**Exact input:**
```
[Upload a real HVAC quote PDF]
Here is my HVAC quote. What do you think?
```

**Required behavior (what Mike DOES do):**
- Confirms it has understood the document (names real details - brand, model, tonnage, etc.)
- Gives factual observations only - what the document says, not judgments about it
- Offers the structured Second Opinion Report immediately after those observations
- Mentions the report is free during early access
- Stops and waits for the user's response

**Forbidden behavior (what Mike must NOT do - check this list carefully, negative assertions catch regressions that positive checks miss):**
- ❌ No fairness judgment ("this is fair," "this looks reasonable," "not automatically out of line")
- ❌ No pricing verdict of any kind
- ❌ No assumptions section or assumption statements
- ❌ No missing-items / missing-scope analysis
- ❌ No negotiation advice
- ❌ No recommendation
- ❌ No clarifying questions before the report offer (e.g. "is this full system or AC-only," "is this new construction or replacement") - these are exactly the kind of decisive-question instinct that must be suppressed until AFTER the offer, not instead of it
- ❌ More than 1-2 observations before the offer appears
- ❌ The conversation ending naturally (user says something like "that's helpful, thanks") without the report ever having been offered
- ❌ Re-offering the report after it's been explicitly declined

**If the user accepts the offer:**
- Full report generated (SITUATION SUMMARY + all sections)
- Revision code created
- Report record saved (report_generated log event)
- Structured extraction fires in the background
- Chat afterward answers follow-ups / extends the report, doesn't re-derive a parallel analysis
- Feedback (recommendation question) only asked after the report is delivered, not before

**If the user declines the offer:**
- Mike continues helping in chat
- Does NOT repeatedly re-offer the report

## Edge case (test alongside the main script)

**Input:** "I don't want a report. Just tell me quickly whether the quote looks reasonable."

**Required behavior:** Mike respects this immediately and gives a brief, direct answer in chat - no re-offering, no stalling, no hiding behind the boundary. This confirms the fix didn't overcorrect into making Mike obstructive toward users who've clearly said what they want. The boundary is about not giving away the full report *unprompted* - it is not a mandate to withhold a direct answer from someone who's explicitly declined.

## Generalized trigger (repeat the main test with each variant)

This should trigger the same behavior regardless of how the information arrives:
- [ ] Uploaded quote PDF (primary script above)
- [ ] Pasted detailed quote text directly into chat
- [ ] Multiple quote/equipment screenshots uploaded
- [ ] A conversation that's built up enough exact equipment, price, scope, and warranty detail through back-and-forth text alone (no upload at all)

## Outcome categories (log as one of these three, not just Pass/Fail)

- **PASS** — offer state fully respected: 1-2 factual observations, offer appears immediately, nothing forbidden present
- **PARTIAL FAIL** — offer does appear, but analysis, judgment, or clarifying questions also appear before or alongside it
- **FAIL** — no offer at all

## If this fails (PARTIAL FAIL or FAIL) - stop adding prompt language

If the explicit REPORT OFFER STATE gate still doesn't hold, that's a real signal prose-level prohibitions aren't sufficient here, regardless of how explicit they're worded. The next mechanism, in order of preference, moves this out of prompt interpretation into deterministic product logic:

1. A small first pass (separate, cheap model call) classifies whether the current conversation has crossed the high-information threshold - yes/no.
2. If yes, the application itself forces the next response into the offer template - not a request to the main model to "please offer," but code-level control over what gets generated.
3. The main reasoning model never gets the opportunity to choose clarifying questions first, because that choice is no longer being made by the model at all for this specific moment.

This is a bigger build than a prompt edit - a second API call, a decision point in `route.ts`, and a template response - so it should only be built if the prompt-only approach is confirmed insufficient by an actual failed test, not preemptively.

## Compliant example (reference)

"I've reviewed the quote. I can see it's a 5-ton Lennox system and the proposal includes more than a basic equipment swap.

You're one of our early users, so the full Second Opinion Report is free while I'm improving Mike with real homeowner feedback. It will give you a structured review of the pricing, equipment, scope, warranties, missing items, and questions to ask. Want me to generate it?"

Nothing else should appear before the offer - no clarifying questions, no fairness judgment, no price verdict, no scope evaluation, no assumptions, no missing-item analysis, no risks, no negotiation advice, no contractor questions, no recommendation.

## How to re-run

1. Start a fresh conversation with get2nd-opinion.com
2. Upload a real quote PDF (or use one of the generalized-trigger variants above)
3. Send the exact message above
4. Record Mike's actual response verbatim below
5. Check against required/forbidden behavior for the first response
6. If it passes, continue: accept the offer, confirm report generation, revision code, and that a later neutral "I have what I need" doesn't skip anything already delivered
7. Separately, run the edge case in its own fresh conversation
8. Mark Pass or Fail and update Latest Result and Tested On below

**Latest result:** Not yet tested against deployed fix
**Tested on (prompt version / date):** Pending first run

## Actual response log

*(Append each run here, most recent first, so drift over time is visible)*

---
