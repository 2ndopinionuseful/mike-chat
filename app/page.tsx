"use client";
import { useState, useRef, useEffect } from "react";

type Message = { role: "user" | "assistant"; content: string };

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hey — tell me what you've got and I'll take a quick look." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();
      setMessages([...newMessages, { role: "assistant", content: data.reply || "Something went wrong — try again." }]);
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "Something went wrong — try again." }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div style={{minHeight:"100vh",background:"#0f0f0f",display:"flex",alignItems:"center",justifyContent:"center",padding:"16px",fontFamily:"Georgia,serif"}}>
      <div style={{width:"100%",maxWidth:"500px",background:"#161616",borderRadius:"16px",border:"1px solid #232323",display:"flex",flexDirection:"column",height:"calc(100vh - 32px)",maxHeight:"760px",overflow:"hidden",boxShadow:"0 24px 64px rgba(0,0,0,.7)"}}>
        
        <div style={{padding:"15px 18px",borderBottom:"1px solid #1f1f1f",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
            <div style={{width:"37px",height:"37px",borderRadius:"50%",background:"#c8a96e",color:"#111",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"700",fontSize:"15px"}}>M</div>
            <div>
              <div style={{color:"#ede8dc",fontWeight:"600",fontSize:"15px"}}>Mike</div>
              <div style={{color:"#555",fontSize:"12px",display:"flex",alignItems:"center",gap:"4px",marginTop:"2px"}}>
                <span style={{width:"6px",height:"6px",borderRadius:"50%",background:"#4caf7d",display:"inline-block"}}/>
                HVAC Advisor
              </div>
            </div>
          </div>
          <div style={{background:"#1c1c1c",border:"1px solid #2d2d2d",color:"#666",fontSize:"11px",padding:"3px 9px",borderRadius:"20px",letterSpacing:".05em",textTransform:"uppercase" as const}}>Second Opinion</div>
        </div>

        <div style={{flex:1,overflowY:"auto" as const,padding:"16px 14px",display:"flex",flexDirection:"column" as const,gap:"12px"}}>
          {messages.map((m, i) => (
            <div key={i} style={{display:"flex",alignItems:"flex-end",gap:"7px",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
              {m.role==="assistant" && <div style={{width:"25px",height:"25px",borderRadius:"50%",background:"#c8a96e",color:"#111",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"700",fontSize:"11px",flexShrink:0}}>M</div>}
              <div style={m.role==="user"?{background:"#c8a96e",color:"#111",padding:"10px 13px",borderRadius:"13px 13px 3px 13px",maxWidth:"80%",fontSize:"14px",lineHeight:"1.65",fontWeight:"500"}:{background:"#1d1d1d",border:"1px solid #262626",color:"#ccc",padding:"10px 13px",borderRadius:"13px 13px 13px 3px",maxWidth:"80%",fontSize:"14px",lineHeight:"1.65"}}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{display:"flex",alignItems:"flex-end",gap:"7px"}}>
              <div style={{width:"25px",height:"25px",borderRadius:"50%",background:"#c8a96e",color:"#111",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"700",fontSize:"11px",flexShrink:0}}>M</div>
              <div style={{background:"#1d1d1d",border:"1px solid #262626",padding:"12px 14px",borderRadius:"13px 13px 13px 3px"}}>
                <div style={{display:"flex",gap:"4px",alignItems:"center"}}>
                  {[0,1,2].map(i=><span key={i} style={{width:"5px",height:"5px",background:"#444",borderRadius:"50%",display:"inline-block",animation:`bounce 1.2s ${i*0.2}s infinite`}}/>)}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>

        <div style={{padding:"10px 13px",borderTop:"1px solid #1e1e1e",display:"flex",gap:"8px",alignItems:"flex-end"}}>
          <textarea ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKey} placeholder="Describe your quote or situation..." rows={1} disabled={loading}
            style={{flex:1,background:"#1d1d1d",border:"1px solid #262626",borderRadius:"11px",color:"#ccc",padding:"10px 12px",fontSize:"14px",fontFamily:"Georgia,serif",resize:"none" as const,outline:"none",lineHeight:"1.5",maxHeight:"100px",overflowY:"auto" as const}}/>
          <button onClick={send} disabled={!input.trim()||loading}
            style={{width:"39px",height:"39px",borderRadius:"50%",background:"#c8a96e",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,opacity:input.trim()&&!loading?1:0.35}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13" stroke="#111" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="#111" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <div style={{textAlign:"center" as const,color:"#333",fontSize:"11px",padding:"8px",letterSpacing:".04em",borderTop:"1px solid #191919"}}>
          HVAC only · No contractor ties · Your call
        </div>
      </div>
      <style>{`@keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-4px)}}`}</style>
    </div>
  );
}
