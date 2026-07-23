"use client";

import { useState } from "react";

const GUMROAD_LINK = "https://my2ndopinion.gumroad.com/l/hvac-review";

type Rating = "up" | "down";

interface FeedbackWidgetProps {
  revisionCode: string;
  sessionId: string;
  isTestMode: boolean;
}

export default function FeedbackWidget({ revisionCode, sessionId, isTestMode }: FeedbackWidgetProps) {
  const [rating, setRating] = useState<Rating | null>(null);
  const [comment, setComment] = useState("");
  const [commentSent, setCommentSent] = useState(false);

  async function sendFeedback(newRating: Rating, newComment?: string) {
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(isTestMode ? { "x-test-mode": "true" } : {}),
        },
        body: JSON.stringify({ revisionCode, sessionId, rating: newRating, comment: newComment || undefined }),
      });
    } catch (e) {
      console.error("Feedback submit failed:", e);
    }
  }

  function handleThumb(chosen: Rating) {
    if (rating) return;
    setRating(chosen);
    sendFeedback(chosen);
  }

  function handleCommentSubmit() {
    if (!comment.trim() || !rating) return;
    sendFeedback(rating, comment.trim());
    setCommentSent(true);
  }

  const inputStyle: React.CSSProperties = {
    flex: 1,
    background: "#1d1d1d",
    border: "1px solid #262626",
    borderRadius: "8px",
    color: "#ccc",
    padding: "8px 11px",
    fontSize: "13px",
    fontFamily: "Georgia,serif",
    outline: "none",
  };

  const sendBtnStyle = (disabled: boolean): React.CSSProperties => ({
    background: "none",
    border: "1px solid #c8a96e",
    color: "#c8a96e",
    fontSize: "12px",
    fontWeight: 600,
    padding: "8px 12px",
    borderRadius: "8px",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.35 : 1,
    fontFamily: "Georgia,serif",
    flexShrink: 0,
  });

  return (
    <div style={{ marginTop: "10px", background: "#111", border: "1px solid #262626", borderRadius: "10px", padding: "12px 14px" }}>
      {!rating && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
          <span style={{ color: "#aaa", fontSize: "13px" }}>Was this report helpful?</span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => handleThumb("up")}
              aria-label="Thumbs up"
              style={{ background: "#1d1d1d", border: "1px solid #333", borderRadius: "50%", width: "34px", height: "34px", cursor: "pointer", fontSize: "15px" }}
            >
              👍
            </button>
            <button
              onClick={() => handleThumb("down")}
              aria-label="Thumbs down"
              style={{ background: "#1d1d1d", border: "1px solid #333", borderRadius: "50%", width: "34px", height: "34px", cursor: "pointer", fontSize: "15px" }}
            >
              👎
            </button>
          </div>
        </div>
      )}

      {rating === "up" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ color: "#aaa", fontSize: "13px", lineHeight: 1.5 }}>
            Glad it helped. Mind sharing a quick line about what worked? (optional, okay to use anonymously as a quote)
          </div>
          {!commentSent ? (
            <div style={{ display: "flex", gap: "8px" }}>
              <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What helped most..." style={inputStyle} />
              <button onClick={handleCommentSubmit} disabled={!comment.trim()} style={sendBtnStyle(!comment.trim())}>
                Send
              </button>
            </div>
          ) : (
            <div style={{ color: "#4caf7d", fontSize: "13px" }}>Thanks — really appreciate it.</div>
          )}
          <div style={{ color: "#aaa", fontSize: "13px", lineHeight: 1.5 }}>
            If it saved you money or gave you confidence, there's an optional tip — totally up to you, including $0:{" "}
            <a href={GUMROAD_LINK} target="_blank" rel="noopener noreferrer" style={{ color: "#c8a96e", textDecoration: "underline" }}>
              leave a tip
            </a>
          </div>
        </div>
      )}

      {rating === "down" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ color: "#aaa", fontSize: "13px", lineHeight: 1.5 }}>Sorry to hear that. What felt missing or unclear?</div>
          {!commentSent ? (
            <div style={{ display: "flex", gap: "8px" }}>
              <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What was missing..." style={inputStyle} />
              <button onClick={handleCommentSubmit} disabled={!comment.trim()} style={sendBtnStyle(!comment.trim())}>
                Send
              </button>
            </div>
          ) : (
            <div style={{ color: "#4caf7d", fontSize: "13px" }}>Got it — thanks for the honesty.</div>
          )}
        </div>
      )}

      {!rating && (
        <div style={{ marginTop: "8px", fontSize: "11px", color: "#666" }}>
          Found this useful?{" "}
          <a href={GUMROAD_LINK} target="_blank" rel="noopener noreferrer" style={{ color: "#c8a96e", textDecoration: "underline" }}>
            Optional tip
          </a>
        </div>
      )}
    </div>
  );
}
