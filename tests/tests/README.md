# Mike — Business Regression Test Suite

**The practice:** every time a real conversation surfaces something that could have lost a customer, given bad advice, or damaged trust, it becomes a permanent test case here - not just fixed and forgotten. Before any system prompt or model change ships, re-run every test in this suite and confirm it still passes. Over time this becomes a canonical set of maybe 20-30 conversations Mike must reliably handle well, regardless of what changes underneath.

This is different from (and complements) the structured-data pricing work: that's about Mike having better *information*. This suite is about Mike consistently exhibiting good *behavior* - it catches regressions a data improvement wouldn't, and vice versa.

## Operating rule

Any prompt change, model change, routing change, or major feature release must rerun the full business regression suite before deployment. The goal isn't just making Mike smarter - it's making sure an improvement in one area doesn't quietly damage another.

## When to add a new test

Add a test whenever Mike:
- Gives materially wrong or overconfident advice
- Rejects or pushes away a legitimate potential customer
- Repeatedly asks for information already answered or declined
- Becomes cold, argumentative, or overly procedural
- Fails to recognize the user's actual intent
- Misses an important quote detail
- Creates unnecessary friction before providing value

## Why two categories matter

The two tests so far cover the two highest-risk business failures, and they're intentionally different in kind:

1. **Giving bad advice** (Houston Pricing test) - Mike says something wrong or overconfident, damaging trust with someone already engaged.
2. **Sending potential customers away** (Learn Mode test) - Mike never gets the chance to help at all, because it rejected someone prematurely.

A prompt change could fix one and quietly break the other. Both need checking, every time.

## Current suite

| # | Name | File | Protects against | Business risk if it fails | Status |
|---|------|------|-------------------|---------------------------|--------|
| 1 | Houston Pricing | `tests/houston-pricing.md` | Confident, unsupported pricing verdicts | Loss of trust from incorrect financial guidance | PASS (2026-07-27) |
| 2 | Learn Mode | `tests/learn-mode.md` | Rejecting educational/pre-decision users | Loss of future customers at the top of the funnel | Fix deployed, awaiting re-test confirmation |

## Standard fields for every test

Each test file should include all of these:

- **Failure mode** - what actually went wrong, in plain terms
- **Origin** - where this came from (real user, screenshot, feedback widget, internal testing)
- **Business risk if this fails** - why this matters, in business terms, not just technical terms - this is what lets you prioritize as the suite grows
- **Exact user script** - the precise messages to send, in order, so anyone can run it identically
- **Expected/pass criteria** - specific, checkable behaviors, not vague goals
- **Canonical passing transcript** - a real saved example of what "correct" looks like, not just the abstract criteria
- **Date last run**
- **Model and prompt version tested** - useful because some failures (like Learn Mode) are model-interpretation issues that could resurface on a model version change even with identical prompt text

## How to add a new test

1. Save the real conversation and note what Mike actually said
2. Diagnose the root cause if you can - is it a specific prompt line, a missing instruction, a model interpretation issue?
3. Fill in all the standard fields above
4. Add a row to the table above

## Running the full suite

Right now this is manual - open each test file, run its script live on get2nd-opinion.com, check the criteria, screenshot the result. There's no automation yet. Once there's a real durable database and enough volume to justify it, this is a natural candidate to eventually script (e.g. hitting the API directly with each test's messages and checking the response programmatically) - but manual is fine at this suite size and this stage.
