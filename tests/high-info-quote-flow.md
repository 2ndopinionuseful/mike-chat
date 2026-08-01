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

**Required behavior:**
- Mike confirms it has understood the document (names real details - brand, model, tonnage, etc.)
- No more than 1-2 useful observations before the offer
- No full price verdict in this first response
- No list of assumptions, missing scope, risks, negotiation points, or contractor questions in this first response
- Offers the structured Second Opinion Report immediately after the 1-2 observations
- Mentions the report is free during early access
- Stops and waits for the user's response rather than continuing into deeper analysis unprompted

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

**Forbidden behavior:**
- A full price verdict, assumption list, or recommendation appearing in chat before the report offer has been made
- The conversation ending naturally (user says something like "that's helpful, thanks") without the report ever having been offered
- Re-offering the report after it's been explicitly declined

## Edge case (test alongside the main script)

**Input:** "I don't want a report. Just tell me quickly whether the quote looks reasonable."

**Required behavior:** Mike respects this immediately and gives a brief, direct answer in chat - no re-offering, no stalling, no hiding behind the boundary. This confirms the fix didn't overcorrect into making Mike obstructive toward users who've clearly said what they want. The boundary is about not giving away the full report *unprompted* - it is not a mandate to withhold a direct answer from someone who's explicitly declined.

## Generalized trigger (repeat the main test with each variant)

This should trigger the same behavior regardless of how the information arrives:
- [ ] Uploaded quote PDF (primary script above)
- [ ] Pasted detailed quote text directly into chat
- [ ] Multiple quote/equipment screenshots uploaded
- [ ] A conversation that's built up enough exact equipment, price, scope, and warranty detail through back-and-forth text alone (no upload at all)

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
