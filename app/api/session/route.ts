import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";

const redis = new Redis({
  url: process.env.STORAGE_KV_REST_API_URL || process.env.KV_REST_API_URL || "",
  token: process.env.STORAGE_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN || "",
});

export async function POST(req: NextRequest) {
  try {
    const { sessionId, messages } = await req.json();
    if (!sessionId || !messages) {
      return NextResponse.json({ error: "Missing sessionId or messages" }, { status: 400 });
    }
    await redis.set("session:" + sessionId, JSON.stringify(messages), { ex: 60 * 60 * 24 * 7 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Session save error:", error);
    return NextResponse.json({ error: "Failed to save session" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get("sessionId");
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }
    const data = await redis.get("session:" + sessionId);
    if (!data) {
      return NextResponse.json({ messages: null });
    }
    return NextResponse.json({ messages: data });
  } catch (error) {
    console.error("Session load error:", error);
    return NextResponse.json({ error: "Failed to load session" }, { status: 500 });
  }
}
