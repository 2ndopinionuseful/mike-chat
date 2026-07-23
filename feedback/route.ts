import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";

const redis = new Redis({
  url: process.env.STORAGE_KV_REST_API_URL || process.env.KV_REST_API_URL || "",
  token: process.env.STORAGE_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN || "",
});

interface FeedbackBody {
  revisionCode?: string;
  sessionId?: string;
  rating?: "up" | "down";
  comment?: string;
}

export async function POST(req: NextRequest) {
  const timestamp = new Date().toISOString();

  try {
    const body: FeedbackBody = await req.json();
    const { revisionCode, sessionId, rating, comment } = body;

    if (!revisionCode || (rating !== "up" && rating !== "down")) {
      return NextResponse.json({ error: "Invalid feedback payload" }, { status: 400 });
    }

    const key = "feedback:" + revisionCode;

    // A thumb click and a follow-up comment arrive as two separate POSTs
    // from the widget (rating fires immediately, comment is optional and
    // async) - merge into the same record instead of overwriting it.
    let existing: { rating?: string; comment?: string; timestamp?: string; sessionId?: string } = {};
    try {
      const stored = await redis.get(key);
      if (stored) existing = stored as typeof existing;
    } catch (e) {
      console.error("Redis get error (feedback):", e);
    }

    const record = {
      revisionCode,
      sessionId: sessionId || existing.sessionId,
      rating: rating || existing.rating,
      comment: comment !== undefined ? comment : existing.comment,
      timestamp: existing.timestamp || timestamp,
      updatedAt: timestamp,
    };

    // 30 days, matching the TTL already used for report records in the
    // chat route - keeps feedback and report data expiring together.
    await redis.set(key, JSON.stringify(record), { ex: 60 * 60 * 24 * 30 });

    console.log(JSON.stringify({
      event: "feedback_submitted",
      revisionCode,
      sessionId,
      rating: record.rating,
      hasComment: Boolean(record.comment),
      timestamp,
    }));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(JSON.stringify({
      event: "feedback_error",
      error: String(error),
      timestamp,
    }));
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
Add feedback API route
