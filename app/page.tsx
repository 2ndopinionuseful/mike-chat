"use client";
import { useState, useRef, useEffect } from "react";
import { upload } from "@vercel/blob/client";
import FeedbackWidget from "./components/FeedbackWidget";

type MessageContent =
  | { type: "text"; text: string }
  | { type: "image"; url: string }
  | { type: "pdf"; url: string };

type Message = {
  role: "user" | "assistant";
  content: string | MessageContent[];
  displayImages?: string[];
};

type PendingFile = {
  id: string;
  blobUrl: string;
  previewUrl: string;
  isPdf: boolean;
  name: string;
};

function generateSessionId(): string {
  return "s_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);
}

function generateFileId(): string {
  return "f_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);
}

function getRevisionCode(text: string): string {
  const match = text.match(/(test:)?MK-[A-Z0-9]{4}/i);
  return match ? match[0].toUpperCase() : "";
}

const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

// Cap on how many quotes/files can be attached to a single outgoing message.
// This is a UX/sanity limit, not an API limit - keeps upload time and the
// pending-attachment tray reasonable when comparing several proposals at once.
const MAX_ATTACHMENTS = 5;

function renderMarkdown(text: string, onCopyCode: (code: string) => void, copiedCode: boolean) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim() === "" || line.trim() === "---") {
      elements.push(<div key={key++} style={{ height: "8px" }} />);
      continue;
    }

    const boldOnly = line.match(/^\*\*(.+)\*\*$/);
    if (boldOnly) {
      elements.push(
        <div key={key++} style={{ fontWeight: "700", color: "#e8d5a3", marginTop: "10px", marginBottom: "2px", fontSize: "14px", letterSpacing: "0.03em" }}>
          {boldOnly[1]}
        </div>
      );
      continue;
    }

    if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
      const bulletText = line.trim().substring(2);
      const bulletParts = bulletText.split(/(\*\*[^*]+\*\*)/g).map((p, pi) => {
        const m = p.match(/^\*\*(.+)\*\*$/);
        return m ? <strong key={pi}>{m[1]}</strong> : p;
      });
      elements.push(
        <div key={key++} style={{ display: "flex", gap: "6px", marginBottom: "3px" }}>
          <span style={{ color: "#c8a96e", flexShrink: 0 }}>&#8226;</span>
          <span>{bulletParts}</span>
        </div>
      );
      continue;
    }

    const numbered = line.match(/^(\d+)\.\s+(.+)/);
    if (numbered) {
      elements.push(
        <div key={key++} style={{ display: "flex", gap: "6px", marginBottom: "3px" }}>
          <span style={{ color: "#c8a96e", flexShrink: 0, minWidth: "16px" }}>{numbered[1]}.</span>
          <span>{numbered[2].split(/(\*\*[^*]+\*\*)/g).map((p, pi) => {
            const m2 = p.match(/^\*\*(.+)\*\*$/);
            return m2 ? <strong key={pi}>{m2[1]}</strong> : p;
          })}</span>
        </div>
      );
      continue;
    }

    if (line.includes("Your revision code:")) {
      const codeMatch = line.match(/(test:)?MK-[A-Z0-9]{4}/i);
const code = codeMatch ? codeMatch[0].toUpperCase() : "";
      elements.push(
        <div key={key++} style={{ marginTop: "16px", marginBottom: "8px", background: "#1a2a1a", border: "1px solid #c8a96e", borderRadius: "10px", padding: "12px 14px" }}>
          <div style={{ color: "#aaa", fontSize: "11px", letterSpacing: "0.05em", textTransform: "uppercase" as const, marginBottom: "6px" }}>Save this code for your free revision</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
            <span style={{ color: "#c8a96e", fontWeight: "700", fontSize: "18px", letterSpacing: "0.1em" }}>{code}</span>
            <button
              onClick={() => onCopyCode(code)}
              style={{ background: copiedCode ? "#2a3a2a" : "#c8a96e", border: copiedCode ? "1px solid #4caf7d" : "none", color: copiedCode ? "#4caf7d" : "#111", fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "6px", cursor: "pointer", flexShrink: 0, transition: "all 0.2s" }}
            >
              {copiedCode ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      );
      continue;
    }

    const withLinks = line.split(/(https?:\/\/[^\s]+)/g).map((part, pi) =>
      part.match(/^https?:\/\//) ? (
        <a key={pi} href={part} target="_blank" rel="noopener noreferrer" style={{ color: "#c8a96e", textDecoration: "underline" }}>{part}</a>
      ) : (
        <span key={pi}>{part.split(/(\*\*[^*]+\*\*)/g).map((p, pj) => {
          const m3 = p.match(/^\*\*(.+)\*\*$/);
          return m3 ? <strong key={pj}>{m3[1]}</strong> : p;
        })}</span>
      )
    );

    elements.push(
      <div key={key++} style={{ marginBottom: "3px", lineHeight: "1.65" }}>
        {withLinks}
      </div>
    );
  }

  return <div style={{ fontSize: "14px", color: "#ccc" }}>{elements}</div>;
}

const GREETING_VARIANTS = [
  "Hi, I'm Mike. What can I help you figure out today?",
  "Hi, I'm Mike. What's going on with your HVAC system?",
  "Hey, I'm Mike. Happy to help. What's on your mind?",
  "Hi there. I'm Mike. How can I help today?",
];

function getRandomGreeting(): Message {
  const text = GREETING_VARIANTS[Math.floor(Math.random() * GREETING_VARIANTS.length)];
  return { role: "assistant", content: text };
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>(() => [getRandomGreeting()]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [restored, setRestored] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isTestMode, setIsTestMode] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isPaid = params.get("paid") === "true";
    const testMode = params.get("test") === "true";
    setIsTestMode(testMode);

    const sessionPrefix = testMode ? "test_mike_session_id" : "mike_session_id";
    const existingId = localStorage.getItem(sessionPrefix);

    if (existingId && !isPaid) {
      setSessionId(existingId);
      fetch("/api/session?sessionId=" + existingId + (testMode ? "&test=true" : ""))
        .then(res => res.json())
        .then(data => {
          if (data.messages && Array.isArray(data.messages) && data.messages.length > 1) {
            setMessages(data.messages);
          }
        })
        .catch(() => {})
        .finally(() => setRestored(true));
    } else {
      const newId = generateSessionId();
      localStorage.setItem(sessionPrefix, newId);
      setSessionId(newId);
      setRestored(true);
    }
  }, []);

  useEffect(() => {
    if (!sessionId || messages.length <= 1 || !restored) return;
    fetch("/api/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(isTestMode ? { "x-test-mode": "true" } : {}),
      },
      body: JSON.stringify({ sessionId, messages }),
    }).catch(() => {});
  }, [messages, sessionId, restored]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, loadingReport]);

  useEffect(() => {
    if (!restored) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("paid") === "true") {
      window.history.replaceState({}, "", "/");
      const paidMessage: Message = { role: "user", content: "I just paid - please write up my report." };
      const newMessages = [...messages, paidMessage];
      setMessages(newMessages);
      setLoading(true);
      setLoadingReport(true);
      const apiMessages = newMessages.map((m) => ({
        role: m.role,
        content: typeof m.content === "string" ? m.content : m.content,
      }));
      fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionId,
          ...(isTestMode ? { "x-test-mode": "true" } : {}),
        },
        body: JSON.stringify({ messages: apiMessages }),
      })
        .then((res) => res.json())
        .then((data) => {
          setMessages([...newMessages, { role: "assistant", content: data.reply || "Something went wrong - try again." }]);
        })
        .catch(() => {
          setMessages([...newMessages, { role: "assistant", content: "Something went wrong - try again." }]);
        })
        .finally(() => {
          setLoading(false);
          setLoadingReport(false);
        });
    }
  }, [restored]);

  // Handles one or many files selected at once (the <input> below has the
  // `multiple` attribute). Each valid file is uploaded to Vercel Blob and
  // appended to the pendingFiles tray - existing pending files are kept,
  // so a user can also add files across multiple picks before hitting send.
  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);

    const remainingSlots = MAX_ATTACHMENTS - pendingFiles.length;
    if (remainingSlots <= 0) {
      alert(`You can attach up to ${MAX_ATTACHMENTS} files at once. Remove one before adding another.`);
      e.target.value = "";
      return;
    }
    if (files.length > remainingSlots) {
      alert(`You can attach up to ${MAX_ATTACHMENTS} files at once - only the first ${remainingSlots} will be added.`);
    }
    const filesToProcess = files.slice(0, remainingSlots);

    setUploading(true);
    for (const file of filesToProcess) {
      if (file.type === "application/msword" || file.name.endsWith(".docx") || file.name.endsWith(".doc")) {
        alert(`"${file.name}" is a Word document and can't be uploaded directly. Please paste the text from your quote into the chat, or take a screenshot and upload that instead.`);
        continue;
      }
      const isPdf = file.type === "application/pdf";
      if (!isPdf && !SUPPORTED_IMAGE_TYPES.includes(file.type)) {
        alert(`"${file.name}" isn't a supported image format (this often happens with iPhone photos saved as HEIC). Try a screenshot instead, or re-save the photo as JPG or PNG before uploading.`);
        continue;
      }

      const previewUrl = URL.createObjectURL(file);
      try {
        // Uploads directly from the browser to Vercel Blob storage - the file
        // never passes through our own API route, which is what avoids
        // Vercel's hard 4.5MB serverless function body limit entirely.
        const newBlob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/upload",
        });
        setPendingFiles(prev => [...prev, { id: generateFileId(), blobUrl: newBlob.url, previewUrl, isPdf, name: file.name }]);
      } catch (err) {
        console.error("Blob upload failed:", err);
        alert(`Upload failed for "${file.name}" - try again, or paste the quote text directly instead.`);
        URL.revokeObjectURL(previewUrl);
      }
    }
    setUploading(false);
    e.target.value = "";
  };

  const removePendingFile = (id: string) => {
    setPendingFiles(prev => {
      const target = prev.find(f => f.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter(f => f.id !== id);
    });
  };

  const startOver = () => {
    if (confirm("Start a new conversation? Your current chat will be cleared.")) {
      const newId = generateSessionId();
      const sessionPrefix = isTestMode ? "test_mike_session_id" : "mike_session_id";
      localStorage.setItem(sessionPrefix, newId);
      setSessionId(newId);
      setMessages([getRandomGreeting()]);
      setInput("");
      pendingFiles.forEach(f => URL.revokeObjectURL(f.previewUrl));
      setPendingFiles([]);
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.style.height = "auto";
      }
    }
  };

  const send = async () => {
    if ((!input.trim() && pendingFiles.length === 0) || loading) return;
    let userMessage: Message;
    let apiContent: MessageContent[];
    if (pendingFiles.length > 0) {
      const fileBlocks: MessageContent[] = pendingFiles.map(f =>
        f.isPdf ? { type: "pdf", url: f.blobUrl } : { type: "image", url: f.blobUrl }
      );
      const textBlock: MessageContent = input.trim()
        ? { type: "text", text: input.trim() }
        : {
            type: "text",
            text: pendingFiles.length > 1
              ? `Here are ${pendingFiles.length} HVAC photos/documents. What do you think?`
              : "Here's what I've got. What do you think?",
          };
      apiContent = [...fileBlocks, textBlock];
      const displayImages = pendingFiles.filter(f => !f.isPdf).map(f => f.previewUrl);
      userMessage = { role: "user", content: apiContent, displayImages: displayImages.length ? displayImages : undefined };
    } else {
      userMessage = { role: "user", content: input.trim() };
      apiContent = [{ type: "text", text: input.trim() }];
    }

   const isPaymentSignal = ["just paid", "paid for the report", "report ready", "write the report", "write the full report", "write it up", "write my report", "do the breakdown", "do the full breakdown", "do the report", "yes, do that", "go ahead"].some(phrase => input.toLowerCase().includes(phrase));
    if (isPaymentSignal) setLoadingReport(true);

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setPendingFiles([]);
    if (inputRef.current) inputRef.current.style.height = "auto";
    setLoading(true);
    const apiMessages = newMessages.map(m => {
      if (typeof m.content === "string") {
        return { role: m.role, content: m.content };
      }
      return {
        role: m.role,
        content: m.content.map((c: MessageContent) => {
          if (c.type === "text") return { type: "text", text: c.text };
          if (c.type === "image") return { type: "image", source: { type: "url", url: c.url } };
          if (c.type === "pdf") return { type: "document", source: { type: "url", url: c.url } };
          return c;
        })
      };
    });
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionId,
          ...(isTestMode ? { "x-test-mode": "true" } : {}),
        },
        body: JSON.stringify({ messages: apiMessages }),
      });
      const data = await res.json();
      setMessages([...newMessages, { role: "assistant", content: data.reply || "Something went wrong - try again." }]);
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "Something went wrong - try again." }]);
    } finally {
      setLoading(false);
      setLoadingReport(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const downloadReport = async (text: string) => {
    try {
      const res = await fetch("/api/report-docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportText: text }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "hvac-second-opinion.docx";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Download failed - try again.");
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    });
  };

  const isReport = (text: string) => {
    return text.includes("SECTION 1") || text.includes("SITUATION SUMMARY") || text.includes("revision code");
  };

  const getDisplayText = (content: string | MessageContent[]) => {
    if (typeof content === "string") return content;
    const textPart = content.find((c: MessageContent) => c.type === "text");
    return textPart && textPart.type === "text" ? textPart.text : "";
  };

  const hasReport = messages.some(m => m.role === "assistant" && isReport(getDisplayText(m.content)));
  const lastReport = [...messages].reverse().find(m => m.role === "assistant" && isReport(getDisplayText(m.content)));

  return (
    <div className="chat-root" style={{minHeight:"100vh",background:"#0f0f0f",display:"flex",alignItems:"center",justifyContent:"center",padding:"16px",fontFamily:"Georgia,serif"}}>
      <div style={{width:"100%",maxWidth:"min(780px, calc(100vw - 32px))",background:"#161616",borderRadius:"16px",border:isTestMode ? "1px solid #3a3a1a" : "1px solid #232323",display:"flex",flexDirection:"column",height:"calc(100vh - 32px)",overflow:"hidden",boxShadow:"0 24px 64px rgba(0,0,0,.7)"}}>

        <div style={{padding:"12px 18px",borderBottom:"1px solid #1f1f1f",display:"flex",flexDirection:"column" as const,alignItems:"center",gap:"8px"}}>
          {isTestMode && (
            <div style={{width:"100%",background:"#2a2a0a",border:"1px solid #666620",borderRadius:"6px",padding:"4px 10px",color:"#aaaa44",fontSize:"11px",textAlign:"center" as const,letterSpacing:"0.05em"}}>
              TEST MODE - data saved with test: prefix
            </div>
          )}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%"}}>
            <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
              <div style={{width:"37px",height:"37px",borderRadius:"50%",background:"#c8a96e",color:"#111",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"700",fontSize:"15px"}}>M</div>
              <div>
                <div style={{color:"#ede8dc",fontWeight:"600",fontSize:"15px"}}>Mike</div>
                <div style={{color:"#aaa",fontSize:"12px",display:"flex",alignItems:"center",gap:"4px",marginTop:"2px"}}>
                  <span style={{width:"6px",height:"6px",borderRadius:"50%",background:"#4caf7d",display:"inline-block"}}/>
                  Independent HVAC Advisor
                </div>
              </div>
            </div>
            <div style={{position:"relative" as const}}>
              <div
                onClick={() => setShowTooltip(!showTooltip)}
                style={{background:"#1a1a1a",border:"1px solid #c8a96e",color:"#c8a96e",fontSize:"11px",padding:"4px 10px",borderRadius:"20px",letterSpacing:".05em",textTransform:"uppercase" as const,textAlign:"center" as const,display:"flex",alignItems:"center",gap:"5px",cursor:"pointer"}}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  <polyline points="9 12 11 14 15 10"/>
                </svg>
                Second Opinion
              </div>
              {showTooltip && (
                <div
                  onClick={() => setShowTooltip(false)}
                  style={{position:"fixed" as const,top:0,left:0,right:0,bottom:0,zIndex:99}}
                />
              )}
              {showTooltip && (
                <div style={{position:"absolute" as const,top:"calc(100% + 8px)",right:0,width:"240px",background:"#1e1e1e",border:"1px solid #c8a96e",borderRadius:"10px",padding:"12px 14px",zIndex:100,boxShadow:"0 8px 24px rgba(0,0,0,0.6)"}}>
                  <div style={{color:"#e8d5a3",fontSize:"12px",fontWeight:"600",marginBottom:"6px"}}>What is this?</div>
                  <div style={{color:"#aaa",fontSize:"12px",lineHeight:"1.6"}}>Mike is your independent HVAC advisor - no contractor ties, no commissions, no sales quotas. Just a clear read on your HVAC situation, whether it's a quote, a repair, or a decision you're trying to make.</div>
                  <div style={{color:"#aaa",fontSize:"12px",lineHeight:"1.6",marginTop:"6px"}}>What's fair, what's missing, and what's worth questioning before you decide.</div>
                  <div style={{marginTop:"8px",color:"#666",fontSize:"11px"}}>Tap outside this box to close</div>
                </div>
              )}
            </div>
          </div>
          {messages.length > 1 && (
            <button onClick={startOver} style={{
              background: "none",
              border: hasReport ? "1px solid #c8a96e" : "none",
              color: "#c8a96e",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              padding: hasReport ? "6px 16px" : "2px 0",
              borderRadius: hasReport ? "20px" : "0",
              letterSpacing: "0.03em",
              opacity: hasReport ? 1 : 0.35,
              width: hasReport ? "100%" : "auto",
              fontFamily: "Georgia,serif",
              alignSelf: hasReport ? "stretch" : "center",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              Start a new conversation
              <span style={{fontSize:"14px"}}>&#8594;</span>
            </button>
          )}
        </div>

        <div style={{flex:1,overflowY:"auto" as const,padding:"16px 14px",display:"flex",flexDirection:"column" as const,gap:"12px"}}>
          {messages.map((m, i) => (
            <div key={i} style={{display:"flex",alignItems:"flex-end",gap:"7px",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
              {m.role==="assistant" && <div style={{width:"25px",height:"25px",borderRadius:"50%",background:"#c8a96e",color:"#111",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"700",fontSize:"11px",flexShrink:0,alignSelf:"flex-start",marginTop:"4px"}}>M</div>}
              <div style={{maxWidth:"85%",display:"flex",flexDirection:"column" as const,gap:"6px",alignItems:m.role==="user"?"flex-end":"flex-start"}}>
                {m.displayImages && m.displayImages.length > 0 && (
                  m.displayImages.length === 1 ? (
                    <img src={m.displayImages[0]} alt="quote" style={{maxWidth:"100%",borderRadius:"10px",border:"1px solid #333"}}/>
                  ) : (
                    <div style={{display:"flex",flexWrap:"wrap" as const,gap:"6px",justifyContent:"flex-end"}}>
                      {m.displayImages.map((src, imgI) => (
                        <img key={imgI} src={src} alt={`quote ${imgI + 1}`} style={{width:"110px",height:"110px",objectFit:"cover" as const,borderRadius:"10px",border:"1px solid #333"}}/>
                      ))}
                    </div>
                  )
                )}
                {getDisplayText(m.content) && (
                  <div className="msg-bubble" style={m.role==="user"
                    ? {background:"#c8a96e",color:"#111",padding:"10px 13px",borderRadius:"13px 13px 3px 13px",fontSize:"14px",lineHeight:"1.65",fontWeight:"500"}
                    : {background:"#1d1d1d",border:"1px solid #262626",color:"#ccc",padding:"12px 14px",borderRadius:"13px 13px 13px 3px",fontSize:"14px",lineHeight:"1.65"}
                  }>
                    {m.role === "assistant"
                      ? renderMarkdown(getDisplayText(m.content), copyCode, copiedCode)
                      : getDisplayText(m.content).split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
                          part.match(/^https?:\/\//) ? (
                            <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{color:"#c8a96e",textDecoration:"underline"}}>{part}</a>
                          ) : part
                        )
                    }
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{display:"flex",alignItems:"flex-end",gap:"7px"}}>
              <div style={{width:"25px",height:"25px",borderRadius:"50%",background:"#c8a96e",color:"#111",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"700",fontSize:"11px",flexShrink:0}}>M</div>
              <div style={{background:"#1d1d1d",border:"1px solid #262626",padding:"12px 14px",borderRadius:"13px 13px 13px 3px"}}>
                {loadingReport ? (
                  <div style={{color:"#888",fontSize:"13px",fontStyle:"italic"}}>Putting your breakdown together...</div>
                ) : (
                  <div style={{display:"flex",gap:"4px",alignItems:"center"}}>
                    {[0,1,2].map(i=><span key={i} style={{width:"5px",height:"5px",background:"#444",borderRadius:"50%",display:"inline-block",animation:`bounce 1.2s ${i*0.2}s infinite`}}/>)}
                  </div>
                )}
              </div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>

        {uploading && (
          <div style={{padding:"8px 14px",borderTop:"1px solid #1e1e1e",display:"flex",alignItems:"center",gap:"8px"}}>
            <div style={{width:"16px",height:"16px",border:"2px solid #333",borderTopColor:"#c8a96e",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
            <span style={{color:"#888",fontSize:"12px"}}>Uploading...</span>
          </div>
        )}

        {pendingFiles.length > 0 && !uploading && (
          <div style={{padding:"8px 14px",borderTop:"1px solid #1e1e1e",display:"flex",flexDirection:"column" as const,gap:"6px"}}>
            <div style={{display:"flex",flexWrap:"wrap" as const,gap:"8px"}}>
              {pendingFiles.map(f => (
                <div key={f.id} style={{display:"flex",alignItems:"center",gap:"6px",background:"#1a1a1a",border:"1px solid #262626",borderRadius:"8px",padding:"4px 8px 4px 4px"}}>
                  {f.isPdf
                    ? <div style={{height:"36px",width:"36px",borderRadius:"6px",border:"1px solid #333",background:"#2a1a1a",display:"flex",alignItems:"center",justifyContent:"center",color:"#c8a96e",fontSize:"9px",fontWeight:"700",flexShrink:0}}>PDF</div>
                    : <img src={f.previewUrl} alt="preview" style={{height:"36px",width:"36px",objectFit:"cover" as const,borderRadius:"6px",border:"1px solid #333"}}/>
                  }
                  <span style={{color:"#888",fontSize:"11px",maxWidth:"110px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{f.name}</span>
                  <button onClick={()=>removePendingFile(f.id)} style={{background:"none",border:"none",color:"#666",cursor:"pointer",fontSize:"15px",padding:"0 2px",lineHeight:1}}>x</button>
                </div>
              ))}
            </div>
            <span style={{color:"#666",fontSize:"11px"}}>
              {pendingFiles.length} file{pendingFiles.length > 1 ? "s" : ""} ready to send
              {pendingFiles.length < MAX_ATTACHMENTS ? ` - add up to ${MAX_ATTACHMENTS - pendingFiles.length} more` : ""}
            </span>
          </div>
        )}

        <div style={{padding:"10px 13px",borderTop:"1px solid #1e1e1e",display:"flex",gap:"8px",alignItems:"flex-end"}}>
          <button onClick={()=>fileRef.current?.click()}
            style={{width:"36px",height:"36px",borderRadius:"50%",background:"#1d1d1d",border:"1px solid #333",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:"#666"}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
            </svg>
          </button>
          <input ref={fileRef} type="file" accept="image/*,.pdf" multiple onChange={handleFiles} style={{display:"none"}}/>
          <textarea ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKey}
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = "auto";
              t.style.height = Math.min(t.scrollHeight, 160) + "px";
            }}
            placeholder={pendingFiles.length > 0 ? "Add a note or just hit send..." : "Reply..."}
            rows={1} disabled={loading}
            style={{flex:1,background:"#1d1d1d",border:"1px solid #262626",borderRadius:"11px",color:"#ccc",padding:"10px 12px",fontSize:"14px",fontFamily:"Georgia,serif",resize:"none" as const,outline:"none",lineHeight:"1.5",maxHeight:"160px",overflowY:"auto" as const}}/>
          <button onClick={send} disabled={(!input.trim()&&pendingFiles.length===0)||loading||uploading}
            style={{width:"39px",height:"39px",borderRadius:"50%",background:"#c8a96e",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,opacity:(input.trim()||pendingFiles.length>0)&&!loading&&!uploading?1:0.35}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13" stroke="#111" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="#111" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {hasReport && lastReport && (
          <div style={{padding:"10px 14px",borderTop:"1px solid #1e1e1e",background:"#111"}}>
            <button
              onClick={() => downloadReport(getDisplayText(lastReport.content))}
              style={{width:"100%",background:"#1a1a1a",border:"1px solid #c8a96e",color:"#c8a96e",fontSize:"13px",padding:"9px 14px",borderRadius:"8px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",fontFamily:"Georgia,serif"}}
            >
              Download Report (.docx)
            </button>
            <FeedbackWidget
              revisionCode={getRevisionCode(getDisplayText(lastReport.content))}
              sessionId={sessionId}
              isTestMode={isTestMode}
            />
          </div>
        )}

        <div style={{textAlign:"center" as const,color:"#999",fontSize:"11px",padding:"8px",letterSpacing:".04em",borderTop:"1px solid #222"}}>
          HVAC only - No contractor ties - Your call
        </div>
      </div>
      <style>{`@keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-4px)}} @keyframes spin{to{transform:rotate(360deg)}} @media (min-width: 600px) { .chat-root .msg-bubble { font-size: 15px !important; } .chat-root textarea { font-size: 15px !important; } }`}</style>
    </div>
  );
}
