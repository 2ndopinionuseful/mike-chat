Regression Test: Houston Pricing Overconfidence

Origin: Real user conversation, Houston/Pearland market, discovered via direct user complaint ("keeps asking to upload" + separately, a friend/tester recreated the pricing exchange live).

The failure: Mike gave a generic $5,500-$9,000 range for a "5-ton Carrier with coil and install" with almost no location grounding beyond "Houston's mid-range, not NYC-expensive." When told the actual quote was $13,000, Mike responded: "That's noticeably high for Houston... roughly 40-50% more than typical."

Why it's wrong, independent of whether $13,000 is actually fair: Mike did not yet know the model tier, efficiency, whether a furnace was included, duct/plenum work, warranties, permit scope, or installation conditions - and stated a specific, confident percentage anyway. The precision of "40-50%" implies evidence Mike did not have.

Ground truth, from real submitted Pearland/Houston proposals (May 2026), for comparison:

Daikin 5-ton, 14 SEER, complete system: $16,042.50 (cash) / $17,110 (financed)
Daikin 5-ton inverter, 16 SEER, complete system: $18,693 (cash) / $19,960 (financed)
Lennox 5-ton variable-speed, ~18.5 SEER2, complete system: $19,155 (cash outlay) / $17,052 (marketed net, includes non-cash store credit)

Even the cheapest of these real complete-system quotes exceeds the top of Mike's stated $5,500-$9,000 range. Mike's original benchmark was too low, and the "40-50% high" verdict was unsupported in either direction - not just wrong on the number, but wrong to have stated a number at all given the information available.

Note: these real quotes are for complete systems (AC + furnace). The test conversation's "coil and install" phrasing may describe narrower scope. This ambiguity is itself part of the bug - Mike never asked which one it was before pricing it.

How to re-run this test
Start a fresh conversation with get2nd-opinion.com
Send: "What should the ballpark price I can expect for a 5-ton Carrier with coil and install"
If asked for location, reply: "Houston"
When Mike gives a range, reply: "13000" (as the quote you received)
Read Mike's response to the $13,000 figure
Pass criteria
 Mike does NOT state a specific percentage (e.g. "40-50% more than typical") without first asking whether the furnace is included, what equipment/efficiency tier, and what scope is covered
 Mike asks at least one clarifying question about scope (furnace included? efficiency tier? full system vs. coil-only?) before or instead of a confident verdict
 If Mike gives a preliminary read before getting those details, it's explicitly labeled as low-confidence/preliminary, not stated as fact
 Mike does not ask for the same missing detail more than once if the user doesn't provide it
 Mike offers to check the actual uploaded quote at most once, without pressure
When to re-run

Any time the system prompt's PRICING CONFIDENCE DISCIPLINE, QUOTE UPLOAD STRATEGY, or LOCATION CAPTURE sections change, or before/after any pricing-related infrastructure change (web search grounding, caching, structured extraction retrieval). This is the first entry in what should become a small permanent regression suite - see the earlier "learning from every conversation" scoping discussion for the fuller version of this idea (a spreadsheet of test conversations with binary pass/fail per known issue, run before each prompt deploy).
