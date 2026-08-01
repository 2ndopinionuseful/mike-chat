# Regression Test #3: Large-Home Local Pricing Request

**Status: RELEASE-BLOCKING** - unlike tests #1 and #2, this one tests two behaviors at once (expert reasoning + confidence discipline) and should be run before every deploy that touches the system prompt, not just pricing-related changes.

**Origin:** Live testing session, 2026-07-27 (same session that surfaced the confidence-consistency bug and the "still building that data" exposure).

**Failure mode observed:** Given "HVAC for a 4,500 sq ft home in Houston," Mike jumped straight to a price range ($8k-$16k) without first recognizing that a home that size often has multiple HVAC systems - then asked a generic "AC or whole system?" question after the fact instead of before. Separately in the same conversation: the $8k-$16k range was presented with Houston-specific framing, but when pushed, Mike admitted it didn't actually have Houston-specific comparable data - an internal contradiction. Mike also described its own limitation as "I'm still building that data," exposing internal product status to the customer.

**Business risk if this fails:** compounds two risks at once - (1) loss of trust from a range that turns out to be based on wrong assumptions (single-system pricing applied to what's likely a multi-system home), and (2) loss of credibility from Mike visibly contradicting itself about what data it has access to, or sounding unfinished/still-in-development to a paying-attention customer.

## How to re-run this test

1. Start a fresh conversation with get2nd-opinion.com
2. Send: "What does HVAC cost for a 4,500 sq ft home in Houston?"
3. Read Mike's first response
4. If it's healthy, optionally push further (e.g. "why so low?" or ask about the data source) to confirm no confidence-consistency contradiction surfaces later in the conversation

## Pass criteria

- [ ] Does NOT immediately give a Houston-specific range without first addressing scope
- [ ] Recognizes/uses the fact that a 4,500 sq ft home may have multiple systems - this should show up as a smarter question, not as visible reasoning or an explanation of the inference
- [ ] Asks one focused, informed question (not a generic multi-part checklist)
- [ ] First response stays to roughly 1-3 sentences - orientation, one qualifier, one question
- [ ] Does not mention internal build/data status ("still building," "don't have that yet in my system," etc.)
- [ ] Does not over-explain its own reasoning process
- [ ] If pushed further in the conversation, does not contradict itself about what local data it has access to - never implies Houston-specific comparable data unless it was actually given in-conversation

## Expected response shape (benchmark, not verbatim required)

> "A 4,500 sq ft Houston home often has more than one HVAC system, so the total can vary widely. Are you replacing one system or all of them?"

Short, uses the square footage signal intelligently, avoids an unsupported range, and moves the conversation toward what's actually needed for a meaningful estimate. A general planning range with clear assumptions and confidence language can follow once the user answers - it shouldn't come first.

# Regression Test #3: Large-Home Local Pricing Request

**Test name:** Large-home local pricing request
**Severity:** P0 - release blocking
**Origin:** Live testing session, 2026-07-27

**Exact input:**
```
What does HVAC cost for a 4,500 sq ft home in Houston?
```

**Required behavior:**
- Recognizes likely multiple systems (implied by home size), reflected in a smarter follow-up question - not narrated explicitly
- Does not imply Houston-specific comparable data unless it was actually given in this conversation
- Asks one focused question
- First response is 1-3 sentences
- Does not mention product/data development status

**Forbidden behavior:**
- An unsupported Houston-specific price range in the first response
- Any variant of "I'm still building the data" / "don't have that in my system yet" phrased as a development-status confession rather than an information gap
- Multiple generic questions instead of one informed one
- A long, multi-paragraph explanation before getting to the point

**Business risk if this fails:** compounds two risks at once - loss of trust from a range based on wrong assumptions (single-system pricing applied to what's likely a multi-system home), and loss of credibility from Mike contradicting itself about what data it has, or sounding unfinished.

**Expected response shape (benchmark, not verbatim required):**
> "A 4,500 sq ft Houston home often has more than one HVAC system, so the total can vary widely. Are you replacing one system or all of them?"

**Latest result:** Not yet tested against deployed fix
**Tested on (prompt version / date):** Pending first run

## How to re-run

1. Start a fresh conversation with get2nd-opinion.com
2. Send the exact input above
3. Record the actual response verbatim below
4. Check against required/forbidden behavior
5. Mark Pass or Fail and update Latest Result and Tested On above

## Actual response log

*(Append each run here, most recent first, so drift over time is visible)*

---
