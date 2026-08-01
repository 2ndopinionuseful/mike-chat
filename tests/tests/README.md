# Mike — Business Regression Test Suite

**The practice:** every time a real conversation surfaces something that could have lost a customer, given bad advice, or damaged trust, it becomes a permanent test case here - not just fixed and forgotten. Before any system prompt or model change ships, re-run every test in this suite and confirm it still passes. Over time this becomes a canonical set of maybe 20-30 conversations Mike must reliably handle well, regardless of what changes underneath.

This is different from (and complements) the structured-data pricing work: that's about Mike having better *information*. This suite is about Mike consistently exhibiting good *behavior* - it catches regressions a data improvement wouldn't, and vice versa.

## Operating rule

Any prompt change, model change, routing change, or major feature release must rerun the full business regression suite before deployment. The goal isn't just making Mike smarter - it's making sure an improvement in one area doesn't quietly damage another.

**This is a release gate, not a suggestion.** A regression file that nobody's required to run before shipping isn't actually protecting anything - it's just a note that might get read. The distinction that matters:
- **Live exploratory testing** (poking at Mike, trying new scenarios) finds NEW problems.
- **Regression testing** (running these exact saved scripts) ensures OLD problems don't come back.
You need both, and one doesn't substitute for the other.

## Pre-deploy checklist (minimum viable process)

Before every prompt deployment, in this order:

1. Run every test marked **P0 - release blocking** below, using the exact input in each file
2. Save Mike's actual response into that file's "Actual response log" section
3. Mark each test Pass or Fail against its required/forbidden behavior
4. **Do not deploy if a P0 test fails** - fix it first, or explicitly decide (and note why) that shipping anyway is worth the known risk
5. Non-blocking tests are recommended but don't gate the deploy - run them when you have time, but a fail there is a "fix soon" not a "stop"

Keep only meaningful, repeatable regressions - not a file for every minor wording tweak. A test earns a permanent spot in this suite when it represents a real failure mode worth protecting against long-term, not just something that happened once.

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

| # | Name | File | Protects against | Business risk if it fails | Release-blocking? | Status |
|---|------|------|-------------------|---------------------------|--------------------|--------|
| 1 | Houston Pricing | `tests/houston-pricing.md` | Confident, unsupported pricing verdicts | Loss of trust from incorrect financial guidance | Recommended | PASS (2026-07-27) |
| 2 | Learn Mode | `tests/learn-mode.md` | Rejecting educational/pre-decision users | Loss of future customers at the top of the funnel | Recommended | Fix deployed, awaiting re-test confirmation |
| 3 | Large-Home Local Pricing | `tests/large-home-pricing.md` | Ungrounded local ranges + missed implicit signals (multiple systems) + internal-status exposure | Compounds trust loss (wrong assumptions) with credibility loss (self-contradiction, sounding unfinished) | **Yes - blocking** | Fix deployed, awaiting re-test confirmation |
| 4 | High-Information Quote Flow | `tests/high-info-quote-flow.md` | Full personalized analysis given away in chat, report never offered, nothing captured | Core product delivered free with zero capture - worse than a wrong answer, since it happens in the highest-value conversations every time | **Yes - blocking** | Fix deployed, awaiting re-test confirmation |

Tests marked release-blocking must pass before any system-prompt-touching deploy, not just changes to the specific area they test - test #3 covers two behavior categories at once (expert reasoning + confidence discipline), so it's a good general-purpose canary for prompt regressions even in unrelated areas.

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
