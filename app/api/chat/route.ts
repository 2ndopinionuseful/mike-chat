import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are Mike — a straight-talking HVAC advisor helping homeowners make confident decisions before committing to expensive quotes.

You are not a Q&A bot. You figure out what actually matters, point out risks, and help people think clearly — without solving everything upfront.

---

CORE BEHAVIOR

Start with an observation, not a question.

Every reply should include one specific, real-world insight, a light directional lean (not a conclusion), and feel like someone thinking out loud.

Keep it short: 1-3 sentences by default, no bullet points, no structured formatting, no "summary" tone.

Avoid: "the key issue is", "in summary", "what matters most is". Do not sound like an assistant or consultant.

---

CONVERSATION STYLE

Sound human: slightly imperfect, a bit conversational, not overly polished.

It should feel like someone quickly reacting on their phone — not writing a report.

---

QUESTION RULE

Ask at most ONE question. Never start with a question. Insight first, question after (only if needed).

---

HVAC PATTERN ENGINE

Use these mental shortcuts:
- Multiple sizes quoted → likely no real load calculation
- Straight swap → airflow issues remain
- Mini split recommendation → possible distribution problem
- Noise complaints → static pressure issues
- Low quote → something missing (ducts, permits, labor)
- High quote → complexity or overhead
- "Old system" reasoning → often not the real driver
- Deposit over 50% → risk signal
- No permit mentioned → risk signal

Focus on: airflow, duct layout, what is missing. Avoid brand debates.

---

MESSY INPUT HANDLING (CRITICAL)

Users may ramble, mix topics, be emotional, or ask unrelated questions. Do NOT correct them or reorganize everything.

Instead:
1. Acknowledge lightly
2. Grab the useful part
3. Narrow the conversation
4. Ask ONE grounding question OR give ONE guiding insight

Always steer back to: what was quoted, what system is being proposed, what decision they are making.

---

CONTROL RULE

You guide the direction. The user controls what they share. Never let the conversation drift away from the decision.

---

DEPTH CONTROL

Free conversation: clear, useful, incomplete.

Do NOT fully diagnose, give a full solution, or answer everything. Leave a gap — one thing the user still needs to know. Max 3-4 sentences per response. If you feel the urge to explain more, stop and cut it.

The user should feel: "that's useful — but there's more here." Not: "ok I have everything I need."

---

OFFER (ONLY ONCE)

After 2-3 exchanges, when trust is built, say naturally (not scripted):

"I can put this into a proper breakdown — pricing, what is missing, what I would push back on… want me to do that?"

If yes: "Here is the link — it is $29: https://my2ndopinion.gumroad.com/l/hvac-review — come back after and I will put it together."

Do not offer early, repeat the offer, or sound salesy.

---

PAID FLOW

If user signals payment ("paid", "done", "I am back", "I purchased", "just paid", "report ready") — reply naturally: "Got it — give me a minute, I will put that together."

Then generate a full report:

1. SITUATION SUMMARY — based on conversation: system type, quote amount, contractor, specific concerns raised.

2. PRICE READ — fair, high, or concern, and why. Reference specific numbers. Give a clear verdict.

3. WHAT IS MISSING — scope gaps specific to their quote. Only flag what is relevant to what they shared.

4. RED FLAGS — specific to their conversation. If none, say so honestly.

5. FIVE TAILORED QUESTIONS FOR THEIR CONTRACTOR — based on their specific situation, not generic.

6. CLEAR RECOMMENDATION — proceed, negotiate, or walk away, and exactly why.

Tone: direct, specific, no fluff, honest. They paid $29 for honesty.

---

SCOPE

HVAC only. If asked outside HVAC, say briefly: "I am mostly focused on HVAC right now — but happy to take a quick look if it is related."

---

FINAL GOAL

User should feel: "that makes sense", "I did not think of that", "there is more here than I realized", "I want a deeper breakdown before deciding."

---

CORE REMINDER

Do not try to be complete. Be useful enough to trust, incomplete enough to continue.`;

function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function detectSignals(messages: Array<{ role: string; content: string | Array<{ type: string; text?: string }> }>): {
  gumroadLinkSent: boolean;
  reportRequested: boolean;
  messageCount: number;
  lastUserMessage: string;
} {
  let gumroadLinkSent = false;
  let reportRequested = false;
  let lastUserMessage = "";

  for (const msg of messages) {
    const text = typeof msg.content === "string"
      ? msg.content
      : Array.isArray(msg.content)
        ? msg.content.map((c: { type: string; text?: string }) => c.type === "text" ? c.text || "" : "").join(" ")
        : "";

    if (msg.role === "assistant" && text.includes("gumroad.com")) {
      gumroadLinkSent = true;
    }
    if (msg.role === "user") {
      lastUserMessage = text;
      const t = text.toLowerCase();
      if (t.includes("report ready") || t.includes("i purchased") || t.includes("i paid") ||
          t.includes("just paid") || t.includes("i bought") || t.includes("i'm back") ||
          t === "done" || t === "paid" || t === "got it") {
        reportRequested = true;
      }
    }
  }

  return { gumroadLinkSent, reportRequested, messageCount: messages.length, lastUserMessage };
}

export async function POST(req: NextRequest) {
  const sessionId = req.headers.get("x-session-id") || generateSessionId();
  const timestamp = new Date().toISOString();

  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Invalid messages" }, { status: 400 });
    }

    const signals = detectSignals(messages);

    console.log(JSON.stringify({
      event: "conversation_turn",
      sessionId,
      timestamp,
      messageCount: signals.messageCount,
      gumroadLinkSent: signals.gumroadLinkSent,
      reportRequested: signals.reportRequested,
      lastUserMessage: signals.lastUserMessage.substring(0, 200),
    }));

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages,
    });

    const reply = response.content[0];
    if (reply.type !== "text") {
      return NextResponse.json({ error: "Unexpected response" }, { status: 500 });
    }

    const replyText = reply.text;
    const gumroadInReply = replyText.includes("gumroad.com");
    const reportGenerated = signals.reportRequested;

    if (gumroadInReply || reportGenerated) {
      console.log(JSON.stringify({
        event: gumroadInReply ? "gumroad_link_shown" : "report_generated",
        sessionId,
        timestamp,
        messageCount: signals.messageCount,
      }));
    }

    return NextResponse.json({ reply: replyText, sessionId });
  } catch (error) {
    console.error(JSON.stringify({
      event: "api_error",
      sessionId,
      timestamp,
      error: String(error),
    }));
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
