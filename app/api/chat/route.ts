import Anthropic from "@anthropic-ai/sdk";
import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const redis = new Redis({
  url: process.env.STORAGE_KV_REST_API_URL || process.env.KV_REST_API_URL || "",
  token: process.env.STORAGE_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN || "",
});

const SYSTEM_PROMPT = [
  "You are Mike - a straight-talking advisor helping homeowners decide if their HVAC quote is a good deal before they commit.",
  "",
  "You are not a Q&A bot. You are: identifying what actually matters, explaining real-world behavior clearly, exposing hidden risk, guiding decision clarity.",
  "",
  "CORE IDENTITY",
  "",
  "Give clear insight, stop before personalized solution.",
  "",
  "CORE PRINCIPLE",
  "",
  "Be clear, not vague. Be helpful, not exhaustive. Do not solve the user's exact situation publicly. Earn trust through clarity, not withholding.",
  "",
  "HOW YOU TALK",
  "",
  "Default to 1-3 sentences. Avoid perfect structure or 'complete thought' endings - a little roughness is fine and preferred.",
  "",
  "Prefer: 'might be...', 'feels like...', 'I've seen...', 'honestly...', 'this is where it gets tricky...', 'got it...', 'sounds like...'",
  "",
  "Avoid: 'the key issue is...', 'in summary...', 'what matters most is...'",
  "",
  "Every reply should lean somewhere - give a light direction, not a flat conclusion. If there's a real risk or mistake, say it directly - don't hide it inside the lean.",
  "",
  "If you introduce a distinction, give one concrete, observable anchor for it.",
  "",
  "If a response starts to feel polished, complete, or 'advisor-like' - shorten it or rough it up. Would someone actually type this casually on their phone in 20 seconds? If not, simplify.",
  "",
  "SCOPE DISCIPLINE (HIGHEST PRIORITY - OVERRIDES STYLE RULES ABOVE WHEN THEY CONFLICT)",
  "",
  "Do not withhold a conclusion you can reasonably make, even in service of sounding more casual or leaving things open.",
  "",
  "Give the full insight and the real implication clearly. Do not leave a real finding vague just to create curiosity. Do not soften something that materially affects the user's decision.",
  "",
  "What stays incomplete is personalization - their exact setup, a full step-by-step fix - not the underlying finding itself.",
  "",
  "Correct: 'If airflow isn't addressed, you can lose 15-30% efficiency - that shows up as higher bills and uneven cooling.'",
  "",
  "Incorrect: 'That's where airflow issues usually show up...' (this is a real finding stated as a vague hint - don't do this)",
  "",
  "Truthful clarity always beats conversational curiosity. If any other instruction here would make you hedge a real conclusion, ignore it and state the conclusion plainly instead.",
  "",
  "HANDLING MESSY INPUT",
  "",
  "Users won't behave logically - inputs may be unclear, rambling, emotional, partially relevant, or technically wrong. That's normal, not a problem to flag.",
  "",
  "Unclear/rambling: ask ONE grounding question. Partially relevant: answer briefly, then redirect. Emotional: acknowledge lightly, then guide. Technical: translate to real-world impact, then guide. Clean input: proceed normally.",
  "",
  "One question at a time, prefer narrowing over opening things up. Never stack multiple questions.",
  "",
  "SUPPORT / PURCHASE REQUESTS",
  "",
  "If someone asks about refunds, order status, billing, 'is this real,' or wants to talk to a human - this is not a scope violation and it has a real answer. Don't say 'I don't have access to that.'",
  "",
  "Weave together naturally, not as a checklist: a light human reason it's not you ('I'm just the advisor side, not support...'), the real contact inline and casual - mysecondopinion.review@gmail.com - and a genuine redirect back to HVAC.",
  "",
  "Example: 'Yeah - I don't have access to orders on my side. If it's about a review you bought, that email will get you someone quickly: mysecondopinion.review@gmail.com. If this is about the quote itself though... what are they telling you?'",
  "",
  "Never say 'reach out to whoever you're working with' - that reads like it means their contractor.",
  "",
  "OTHER OUT-OF-SCOPE REQUESTS",
  "",
  "For anything else outside scope with no real answer (scheduling, unrelated topics): acknowledge what they're going for, don't reject abruptly, softly note you don't have that, and redirect back to their quote or system. They should feel understood even when you can't fulfill the request. No robotic 'I'm focused on HVAC' deflections.",
  "",
  "OFFER",
  "",
  "Never offer in the first reply. After the user shows decision intent - they ask for deeper help, ask 'what should I do,' or push past a general question into their specific situation - you can offer once: 'I can take a closer look at your quote and walk through what stands out - pricing, setup, and anything easy to miss. Want a full breakdown?' Don't repeat or rephrase the offer again in the same thread.",
  "",
  "STOP RULE",
  "",
  "If the user signals they're done, stop completely. If they come back later, treat it as a fresh conversation."
].join("\n");


function generateSessionId(): string {
  return "sess_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);
}

function generateRevisionCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "MK-";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

const HIGH_INTENT_SIGNALS = [
  "break this down",
  "break it down",
  "full breakdown",
  "full analysis",
  "full report",
  "what would you do",
  "should i go with",
  "should i sign",
  "is this fair",
  "can you look at my quote",
  "look at my quote",
  "second opinion",
  "worth it or not",
  "help me decide",
  "what should i do",
  "should i do this",
  "give me your take",
  "full take",
  "analyze this",
  "analyze my quote",
  "review my quote",
  "evaluate this",
];

function detectRevisionCode(text: string): string | null {
  const match = text.match(/\bMK-[A-Z0-9]{4}\b/i);
  return match ? match[0].toUpperCase() : null;
}

function detectSignals(messages: Array<{ role: string; content: string | Array<{ type: string; text?: string }> }>): {
  gumroadLinkSent: boolean;
  reportRequested: boolean;
  highIntentDetected: boolean;
  hasMinimumContext: boolean;
  revisionCode: string | null;
  messageCount: number;
  lastUserMessage: string;
} {
  let gumroadLinkSent = false;
  let reportRequested = false;
  let highIntentDetected = false;
  let hasMinimumContext = false;
  let revisionCode: string | null = null;
  let lastUserMessage = "";
  let fullConversationText = "";

  for (const msg of messages) {
    const text = typeof msg.content === "string"
      ? msg.content
      : Array.isArray(msg.content)
        ? msg.content.map((c: { type: string; text?: string }) => c.type === "text" ? c.text || "" : "").join(" ")
        : "";

    if (msg.role === "user") {
      fullConversationText += " " + text;
    }

    if (msg.role === "assistant" && text.includes("gumroad.com")) {
      gumroadLinkSent = true;
    }

    if (msg.role === "user") {
      lastUserMessage = text;
      const t = text.toLowerCase();

      if (t.includes("report ready") ||
          t.includes("paid for the report") ||
          t.includes("purchased the report") ||
          t.includes("bought the report") ||
          t.includes("i just paid for") ||
          t.includes("i am back with my report") ||
          t.includes("i'm back with my report") ||
          t.includes("i purchased the report") ||
          t.includes("i just paid for the report")) {
        reportRequested = true;
      }

      if (!gumroadLinkSent && HIGH_INTENT_SIGNALS.some(signal => t.includes(signal))) {
        highIntentDetected = true;
      }

      const code = detectRevisionCode(text);
      if (code) revisionCode = code;
    }
  }

  const conv = fullConversationText.toLowerCase();
  const hasDollarAmount = /\$[\d,]+|\d+k|\d+,\d{3}/.test(conv);
  const hasSystemType = ["ac", "heat pump", "furnace", "mini split", "minisplit", "hvac", "air conditioner", "cooling", "heating", "duct", "unit"].some(t => conv.includes(t));
  const hasSpecificSituation = ["swap", "replace", "replacement", "install", "new system", "quote", "bid", "estimate"].some(t => conv.includes(t));
  hasMinimumContext = hasDollarAmount || hasSystemType || hasSpecificSituation;

  return { gumroadLinkSent, reportRequested, highIntentDetected, hasMinimumContext, revisionCode, messageCount: messages.length, lastUserMessage };
}

export async function POST(req: NextRequest) {
  const sessionId = req.headers.get("x-session-id") || generateSessionId();
  const timestamp = new Date().toISOString();
  const isTestMode = req.headers.get("x-test-mode") === "true";
  const keyPrefix = isTestMode ? "test:" : "";

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
      isTestMode,
      messageCount: signals.messageCount,
      gumroadLinkSent: signals.gumroadLinkSent,
      reportRequested: signals.reportRequested,
      highIntentDetected: signals.highIntentDetected,
      hasMinimumContext: signals.hasMinimumContext,
      revisionCode: signals.revisionCode,
      lastUserMessage: signals.lastUserMessage.substring(0, 200),
    }));

    let systemPrompt = SYSTEM_PROMPT;

    if (signals.revisionCode) {
      try {
        const stored = await redis.get(signals.revisionCode);
        if (stored) {
          const data = stored as { report: string; conversation: string[] };
          systemPrompt = SYSTEM_PROMPT + "\n\nREVISION CONTEXT: The user has returned with revision code " + signals.revisionCode + ". Their original report was:\n\n" + data.report + "\n\nUpdate the relevant sections based on what they tell you changed. Keep the same revision code in the footer.";
        } else {
          systemPrompt = SYSTEM_PROMPT + "\n\nNOTE: User entered revision code " + signals.revisionCode + " but it was not found or has expired. Let them know politely and offer to help with their current situation.";
        }
      } catch (e) {
        console.error("Redis get error:", e);
      }
    } else if (signals.highIntentDetected && !signals.gumroadLinkSent) {
      if (signals.hasMinimumContext) {
        systemPrompt = SYSTEM_PROMPT + "\n\nSYSTEM NOTE: The user has shown LEVEL 2 DECISION INTENT and has shared enough context. You MUST offer the breakdown immediately. Do NOT ask any questions. Do NOT add any sentences after the offer link. The offer is your entire response. Follow the LEVEL 2 path exactly.";
      } else {
        systemPrompt = SYSTEM_PROMPT + "\n\nSYSTEM NOTE: The user has shown LEVEL 2 DECISION INTENT but has not shared any specific details yet. Ask ONE grounding question: What did they quote you, and what system are they proposing? Do not offer yet. On their next message, offer regardless of what they say.";
      }
    }

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 4000,
      system: systemPrompt,
      messages,
    });

    const reply = response.content[0];
    if (reply.type !== "text") {
      return NextResponse.json({ error: "Unexpected response" }, { status: 500 });
    }

    const replyText = reply.text;
    const gumroadInReply = replyText.includes("gumroad.com");
    const reportGenerated = signals.reportRequested;

    if (reportGenerated) {
      const revisionCode = generateRevisionCode();
      const recordToStore = {
        report: replyText,
        sessionId,
        timestamp,
        conversation: messages.map((m: { role: string; content: unknown }) => m.role + ": " + JSON.stringify(m.content)).slice(-10),
      };

      try {
        await redis.set(keyPrefix + revisionCode, JSON.stringify(recordToStore), { ex: 60 * 60 * 24 * 30 });
        const finalReply = replyText.replace("[REVISION_CODE]", keyPrefix + revisionCode);

        console.log(JSON.stringify({
          event: "report_generated",
          sessionId,
          timestamp,
          isTestMode,
          revisionCode: keyPrefix + revisionCode,
          messageCount: signals.messageCount,
        }));

        return NextResponse.json({ reply: finalReply, sessionId });
      } catch (e) {
        console.error("Redis set error:", e);
        const finalReply = replyText.replace("[REVISION_CODE]", "MK-ERROR");
        return NextResponse.json({ reply: finalReply, sessionId });
      }
    }

    if (gumroadInReply) {
      console.log(JSON.stringify({
        event: "gumroad_link_shown",
        sessionId,
        timestamp,
        isTestMode,
        messageCount: signals.messageCount,
        highIntentDetected: signals.highIntentDetected,
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
