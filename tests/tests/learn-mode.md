# Regression Test #2: Learn Mode

**Origin:** Real user conversation, screenshots reviewed 2026-07-27. User said "Help me understand hvac" then, when asked their actual situation, replied "Just trying to get an education."

**Business risk if this fails:** loss of future customers at the top of the funnel - most homeowners start in learning mode, not with a quote in hand. Rejecting them means they never come back when the real decision arrives, and the relationship is lost before it starts.

**The failure:** Mike responded: *"I'm built specifically to help people decide on quotes and repairs, not teach general HVAC. There are better resources for that (YouTube channels like 'This Old House' or manufacturer sites break down how systems work pretty well). I'm here when you actually need help with a quote."*

**Root cause (confirmed, not guessed):** the system prompt's opening line, "You are not a Q&A bot," was intended to stop Mike drifting into unrelated trivia - but the model interpreted "just trying to get an education" as exactly the generic Q&A that line told it to avoid, and deflected a pre-decision homeowner to an external resource.

**Why this matters as much as a pricing error:** most homeowners don't start with a quote in hand - they start by trying to understand their situation. Someone in learning mode today is a decision-maker in a few weeks. Sending them to YouTube means Mike loses the relationship before it starts. This is a different failure category than the Houston pricing bug (bad advice) - this one is losing the customer entirely (rejection).

## How to re-run this test

1. Start a fresh conversation with get2nd-opinion.com
2. Send: "Help me understand hvac"
3. If Mike asks what your actual situation is, reply: "Just trying to get an education"
4. Read Mike's response

## Pass criteria

- [ ] Mike welcomes the educational request rather than treating it as out of scope
- [ ] Mike actually teaches something (offers topics or answers directly), rather than deflecting
- [ ] Mike does NOT redirect to YouTube, manufacturer sites, or any external resource in place of helping
- [ ] Mike does NOT insist on having a quote or a specific situation before engaging
- [ ] Explanations stay homeowner-focused - if something technical comes up, it's translated to what it means for the homeowner, not an engineering lecture
- [ ] Where natural, the explanation connects the concept to a decision implication (e.g. SEER2 → when paying more for efficiency is worth it), not just a dry definition
- [ ] Mike does not push the offer/full report on someone who hasn't shown decision intent yet - teaching comes first, the offer still waits for real signal

## When to re-run

Any time CORE IDENTITY, the EDUCATIONAL QUESTIONS section, or the OFFER section of the system prompt changes. Also worth spot-checking after any model version change (e.g. if the underlying Haiku or Sonnet version updates), since this exact failure was a model-interpretation issue, not an explicit instruction - a different model version could reintroduce it even with the same prompt text.
