# Regression Test: Houston Pricing Overconfidence

**Origin:** Real user conversation, Houston/Pearland market, discovered via direct user complaint ("keeps asking to upload" + separately, a friend/tester recreated the pricing exchange live).

**Business risk if this fails:** loss of trust from incorrect financial guidance - a confident wrong price verdict can cost a user real money (accepting a bad quote or rejecting a fair one) and damages Mike's core credibility as an independent, reliable second opinion.

**The failure:** Mike gave a generic $5,500-$9,000 range for a "5-ton Carrier with coil and install" with almost no location grounding beyond "Houston's mid-range, not NYC-expensive." When told the actual quote was $13,000, Mike responded: *"That's noticeably high for Houston... roughly 40-50% more than typical."*

**Why it's wrong, independent of whether $13,000 is actually fair:** Mike did not yet know the model tier, efficiency, whether a furnace was included, duct/plenum work, warranties, permit scope, or installation conditions - and stated a specific, confident percentage anyway. The precision of "40-50%" implies evidence Mike did not have.

**Ground truth, from real submitted Pearland/Houston proposals (May 2026), for comparison:**
- Daikin 5-ton, 14 SEER, complete system: $16,042.50 (cash) / $17,110 (financed)
- Daikin 5-ton inverter, 16 SEER, complete system: $18,693 (cash) / $19,960 (financed)
- Lennox 5-ton variable-speed, ~18.5 SEER2, complete system: $19,155 (cash outlay) / $17,052 (marketed net, includes non-cash store credit)

Even the cheapest of these real complete-system quotes exceeds the top of Mike's stated $5,500-$9,000 range. Mike's original benchmark was too low, and the "40-50% high" verdict was unsupported in either direction - not just wrong on the number, but wrong to have stated a number at all given the information available.

**Note:** these real quotes are for *complete systems* (AC + furnace). The test conversation's "coil and install" phrasing may describe narrower scope. This ambiguity is itself part of the bug - Mike never asked which one it was before pricing it.

## How to re-run this test

1. Start a fresh conversation with get2nd-opinion.com
2. Send: "What should the ballpark price I can expect for a 5-ton Carrier with coil and install"
3. If asked for location, reply: "Houston"
4. When Mike gives a range, reply: "13000" (as the quote you received)
5. Read Mike's response to the $13,000 figure

## Pass criteria

- [ ] Mike does NOT state a specific percentage (e.g. "40-50% more than typical") without first asking whether the furnace is included, what equipment/efficiency tier, and what scope is covered
- [ ] Mike asks at least one clarifying question about scope (furnace included? efficiency tier? full system vs. coil-only?) before or instead of a confident verdict
- [ ] If Mike gives a preliminary read before getting those details, it's explicitly labeled as low-confidence/preliminary, not stated as fact
- [ ] Mike does not ask for the same missing detail more than once if the user doesn't provide it
- [ ] Mike offers to check the actual uploaded quote at most once, without pressure

## Canonical PASS example (confirmed 2026-07-27)

Full conversation, live on get2nd-opinion.com, after the PRICING CONFIDENCE DISCIPLINE and MARKET GROUNDING SAFEGUARD prompt sections were deployed:

**User:** What should the ballpark price I can expect for a 5-ton Carrier with coil and install

**Mike:** Depends on what you mean by "5-ton Carrier" - that's a few different things. Are you replacing just the outdoor condenser unit and coil, or is this a complete system swap that includes a furnace or air handler inside too?

**User:** Full system - condenser, coil and furnace. I'm in Houston.

**Mike:** For a full 5-ton Carrier system (condenser, coil, and furnace) installed in Houston, you're looking at a preliminary range of around $10,000-$16,000, but that's low-confidence because it matters a lot what efficiency tier and exact models we're talking about.

Here's what moves the price: [lower end ~$10k-$12k basic single-stage / higher end ~$14k-$16k two-stage or variable-speed, premium efficiency, ductwork mods, electrical, extended warranty]. Houston's labor and material costs are moderate compared to colder climates, so the range I gave is realistic for your area - but equipment choice is the biggest driver. Do you have an actual quote you're evaluating, or are you shopping around first?

**User:** $13,000

**Mike:** That lands right in the middle of what I'd expect for a full system in Houston - so not a red flag on its face. But $13k could be fair or not depending on what's actually in it. The real questions are: what Carrier models (exact condenser and furnace model numbers, or just "Carrier"?), what efficiency level (standard vs. two-stage/variable-speed), what's included in the install (ductwork sealing, plenum work, electrical upgrades, permits, thermostat, extended labor warranty). If you have the quote handy, uploading it lets me check the equipment, pricing, and scope line-by-line - that gives you a much more solid second opinion. But I can also help based on what you share in text. What does the quote say about the equipment models and what's included?

## Result: PASS

Confirmed against all 5 pass criteria on 2026-07-27. This is now the canonical reference for "correct" behavior on this scenario - compare future test runs against this transcript, not just the abstract criteria above.

## Known minor issues (backlog, non-blocking)

Logged 2026-07-27, per friend review:

1. **Soft authority overclaiming.** Phrases like "that lands right in the middle of what I'd expect" and "the range I gave is realistic for your area" still imply local market knowledge Mike hasn't actually earned - there's no real market-grounding data behind these statements yet. Much milder than the original bug (no specific unsupported percentage), but should be revisited once web search / quote-database retrieval is live and can genuinely back claims like this.
2. This is exactly why Pricing Confidence Discipline alone isn't the finish line - see the parent scoping discussion. Next milestone: market grounding (web search + structured quote database + comparable retrieval), not further prompt-only tone fixes.
