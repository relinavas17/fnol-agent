import { useState, useRef, useEffect } from "react";

const SYSTEM_PROMPT = `You are an empathetic, professional AI claims agent for an insurance company. You are handling a First Notice of Loss (FNOL) call for an auto accident.

Your name is Alex. Introduce yourself by name in your very first message. Be warm, concise, and conversational throughout. Handle edge cases gracefully (e.g., if they don't have their policy number, move on and flag it). Keep responses short and natural — never list multiple questions at once.

You must collect the following information in a natural conversational flow:
1. Policyholder name and policy number (if available)
2. Date and time of the accident
3. Location of the accident
4. Description of what happened
5. Other parties involved (names, insurance if known)
6. Any injuries (self or others)
7. Vehicle damage description
8. Police report filed? (report number if yes)

After collecting all info, follow these steps in order:

1. Summarize the claim in exactly this format, with a blank line before and after the list:

Here is what I have so far:

Policyholder Name: [value]
Policy Number: [value]
Accident Date: [value]
Accident Time: [value]
Location: [value]
Description: [value]
Other Parties: [value]
Injuries: [value]
Vehicle Damage: [value]
Police Report: [value]

Does everything look correct?

Do not generate a claim number yet.
2. Ask the claimant to confirm the details are correct.
3. Once they confirm, ask if there is anything else they would like to add.
4. Wait for them to say no or indicate they are done.
5. Only then generate a claim number (format CLM-XXXXXX), thank them, and explain next steps (adjuster will follow up within 24 to 48 hours). Set status to Complete only at this final step.

WRITING STYLE: Never use em dashes or asterisks in your responses. Use plain, conversational language only.

CRITICAL: After EVERY response, append a JSON block at the very end in this exact format:
---JSON---
{
  "step": <number 1-8 representing how far along the intake is>,
  "coverageFlags": ["<flag1>", "<flag2>"],
  "claimData": {
    "policyholderName": "<string or null>",
    "policyNumber": "<string or null>",
    "accidentDate": "<string or null>",
    "accidentTime": "<string or null>",
    "location": "<string or null>",
    "description": "<string or null>",
    "otherParties": "<string or null>",
    "injuries": "<string or null>",
    "vehicleDamage": "<string or null>",
    "policeReport": "<string or null>",
    "claimNumber": "<string or null>",
    "status": "In Progress" | "Complete"
  }
}
---END---`;

const STEPS = ["Policyholder Info","Policy #","Date & Time","Location","What Happened","Other Parties","Injuries","Vehicle Damage","Police Report"];
const ADJUSTERS = [
  { name: "Sarah Mitchell", avatar: "SM", specialty: "Auto" },
  { name: "James Okafor", avatar: "JO", specialty: "Auto" },
  { name: "Paige Doe", avatar: "PD", specialty: "Auto / Injury" },
];
const priorityColor  = { Low:"#22c55e", Medium:"#f59e0b", High:"#ef4444", Critical:"#7c3aed" };
const priorityBg     = { Low:"#f0fdf4", Medium:"#fffbeb", High:"#fef2f2", Critical:"#f5f3ff" };
const priorityBorder = { Low:"#bbf7d0", Medium:"#fde68a", High:"#fecaca", Critical:"#ddd6fe" };

const parseResponse = (text) => {
  const m = text.match(/---JSON---([\s\S]*?)---END---/);
  let parsed={}, stepNum=0, pri=null, priReason="", flags=[];
  if (m) {
    try {
      const j = JSON.parse(m[1].trim());
      parsed=j.claimData||{}; stepNum=j.step||0;
      pri=j.priority||null; priReason=j.priorityReason||""; flags=j.coverageFlags||[];
    } catch(e){}
  }
  return { cleanText: text.replace(/---JSON---([\s\S]*?)---END---/,"").trim(), parsed, stepNum, pri, priReason, flags };
};

export default function App() {
  const [view, setView]                   = useState("policyholder");
  const [messages, setMessages]           = useState([]);
  const [input, setInput]                 = useState("");
  const [loading, setLoading]             = useState(false);
  const [claimData, setClaimData]         = useState({});
  const [step, setStep]                   = useState(0);
  const [started, setStarted]             = useState(false);
  const [priority, setPriority]           = useState(null);
  const [priorityReason, setPriorityReason] = useState("");
  const [coverageFlags, setCoverageFlags] = useState([]);
  const [assignedAdjuster, setAssignedAdjuster] = useState(null);
  const [handoffTime, setHandoffTime]     = useState(null);
  const [tab, setTab]                     = useState("overview");
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  const isComplete = claimData.status === "Complete";
  const progress   = Math.min(Math.round((step / 8) * 100), 100);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages, loading]);

  useEffect(() => {
    if (isComplete && !assignedAdjuster) {
      setAssignedAdjuster(ADJUSTERS[2]);
      setHandoffTime(new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}));
    }
  }, [isComplete]);

  const applyParsed = (parsed, stepNum, pri, priReason, flags) => {
    setClaimData(prev => {
      const m={...prev};
      Object.entries(parsed).forEach(([k,v])=>{ if(v&&v!=="null"&&v!==null) m[k]=v; });
      return m;
    });
    setStep(stepNum);
    if (pri) setPriority(pri);
    if (priReason) setPriorityReason(priReason);
    if (flags.length) setCoverageFlags(flags);
  };

  const callAPI = async (msgs) => {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000, system:SYSTEM_PROMPT, messages:msgs }),
    });
    return res.json();
  };

  const startClaim = async () => {
    setStarted(true); setLoading(true);
    try {
      const data = await callAPI([{ role:"user", content:"Hello, I need to report an accident." }]);
      const raw  = data.content?.[0]?.text||"";
      const { cleanText, parsed, stepNum, pri, priReason, flags } = parseResponse(raw);
      setMessages([
        { role:"user",      content:"Hello, I need to report an accident." },
        { role:"assistant", content:cleanText },
      ]);
      applyParsed(parsed, stepNum, pri, priReason, flags);
    } catch(e){}
    setLoading(false);
    setTimeout(()=>inputRef.current?.focus(), 50);
  };

  const sendMessage = async (txt) => {
    const newMsgs = [...messages, { role:"user", content:txt }];
    setMessages(newMsgs); setInput(""); setLoading(true);
    try {
      const data = await callAPI(newMsgs.map(m=>({ role:m.role, content:m.content })));
      const raw  = data.content?.[0]?.text||"";
      const { cleanText, parsed, stepNum, pri, priReason, flags } = parseResponse(raw);
      setMessages(prev=>[...prev,{ role:"assistant", content:cleanText }]);
      applyParsed(parsed, stepNum, pri, priReason, flags);
    } catch(e){ setMessages(p=>[...p,{ role:"assistant", content:"Sorry, something went wrong." }]); }
    setLoading(false);
    setTimeout(()=>inputRef.current?.focus(), 50);
  };

  // ── ADJUSTER VIEW ──────────────────────────────────────────────────────────
  const adjusterFields = [
    ["Policyholder", claimData.policyholderName],
    ["Policy #",     claimData.policyNumber],
    ["Date",         claimData.accidentDate],
    ["Time",         claimData.accidentTime],
    ["Location",     claimData.location],
    ["Other Parties",claimData.otherParties],
    ["Injuries",     claimData.injuries],
    ["Vehicle Damage",claimData.vehicleDamage],
    ["Police Report",claimData.policeReport],
  ];

  const AdjusterView = () => (
    <div style={{display:"flex",height:"100%",flexDirection:"column"}}>
      <div style={{background:"#0f172a",color:"white",padding:"14px 20px",display:"flex",alignItems:"center",gap:12}}>
        <div style={{fontSize:13,fontWeight:700,color:"#94a3b8",letterSpacing:1,textTransform:"uppercase"}}>⚡ Adjuster Workspace</div>
        <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"}}>
          {priority&&<div style={{fontSize:11,background:priorityColor[priority],color:"white",padding:"3px 10px",borderRadius:20,fontWeight:700}}>{priority} Priority</div>}
          <div style={{fontSize:11,background:"#22c55e",color:"white",padding:"3px 10px",borderRadius:20,fontWeight:600}}>● Assigned {handoffTime}</div>
        </div>
      </div>
      <div style={{display:"flex",background:"#1e293b",borderBottom:"1px solid #334155"}}>
        {["overview","timeline"].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{padding:"10px 18px",fontSize:12,fontWeight:600,color:tab===t?"white":"#64748b",background:"transparent",border:"none",cursor:"pointer",borderBottom:tab===t?"2px solid #3b82f6":"2px solid transparent",textTransform:"capitalize"}}>
            {t==="overview"?"📋 Overview":"🕐 Timeline"}
          </button>
        ))}
      </div>
      <div style={{flex:1,overflowY:"auto",background:"#f1f5f9"}}>
        {tab==="overview"&&(
          <div style={{padding:16,display:"flex",flexDirection:"column",gap:12}}>
            <div style={{display:"flex",gap:10}}>
              <div style={{flex:1,background:"white",borderRadius:10,padding:"12px 14px",boxShadow:"0 1px 3px rgba(0,0,0,0.07)"}}>
                <div style={{fontSize:10,color:"#64748b",fontWeight:600,textTransform:"uppercase",marginBottom:4}}>Claim Number</div>
                <div style={{fontSize:16,fontWeight:800,color:"#1a3c5e",letterSpacing:1}}>{claimData.claimNumber||"—"}</div>
              </div>
              <div style={{flex:1,background:"white",borderRadius:10,padding:"12px 14px",boxShadow:"0 1px 3px rgba(0,0,0,0.07)"}}>
                <div style={{fontSize:10,color:"#64748b",fontWeight:600,textTransform:"uppercase",marginBottom:4}}>Assigned To</div>
                <div style={{display:"flex",alignItems:"center",gap:7}}>
                  <div style={{width:28,height:28,borderRadius:"50%",background:"#2e6da4",color:"white",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700}}>{assignedAdjuster?.avatar}</div>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:"#1e293b"}}>{assignedAdjuster?.name}</div>
                    <div style={{fontSize:10,color:"#64748b"}}>{assignedAdjuster?.specialty}</div>
                  </div>
                </div>
              </div>
            </div>
  
            {coverageFlags.length>0&&(
              <div style={{background:"white",borderRadius:10,padding:"12px 14px",boxShadow:"0 1px 3px rgba(0,0,0,0.07)"}}>
                <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",marginBottom:8}}>Coverage Flags</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {coverageFlags.map((f,i)=>(
                    <div key={i} style={{fontSize:11,background:"#fef3c7",color:"#92400e",border:"1px solid #fde68a",padding:"3px 10px",borderRadius:20,fontWeight:600}}>{f}</div>
                  ))}
                </div>
              </div>
            )}
            <div style={{background:"white",borderRadius:10,padding:"12px 14px",boxShadow:"0 1px 3px rgba(0,0,0,0.07)"}}>
              <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",marginBottom:10}}>Intake Summary</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {adjusterFields.map(([label,val])=>val&&(
                  <div key={label} style={{display:"flex",gap:10,fontSize:13}}>
                    <div style={{width:110,color:"#64748b",fontWeight:600,flexShrink:0}}>{label}</div>
                    <div style={{color:"#1e293b",flex:1}}>{val}</div>
                  </div>
                ))}
              </div>
            </div>
            {claimData.description&&(
              <div style={{background:"white",borderRadius:10,padding:"12px 14px",boxShadow:"0 1px 3px rgba(0,0,0,0.07)"}}>
                <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",marginBottom:6}}>Incident Description</div>
                <div style={{fontSize:13,color:"#1e293b",lineHeight:1.7}}>{claimData.description}</div>
              </div>
            )}
          </div>
        )}
        {tab==="timeline"&&(
          <div style={{padding:16}}>
            {[
              {time:"Now",  icon:"🤖",label:"AI Intake Complete",    desc:"All FNOL data collected automatically",                done:true},
              {time:"+1h",  icon:"👤",label:"Adjuster Review",       desc:`${assignedAdjuster?.name||"Adjuster"} reviews claim`, done:false},
              {time:"+24h", icon:"📞",label:"Policyholder Contact",  desc:"Adjuster calls to confirm details",                   done:false},
              {time:"+48h", icon:"🔍",label:"Inspection Scheduled",  desc:"Vehicle inspection arranged if needed",               done:false},
              {time:"+5d",  icon:"💰",label:"Coverage Decision",     desc:"Liability assessment and coverage determination",      done:false},
              {time:"+14d", icon:"✅",label:"Claim Resolved",        desc:"Payment issued or repair authorized",                  done:false},
            ].map((item,i,arr)=>(
              <div key={i} style={{display:"flex",gap:12}}>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
                  <div style={{width:36,height:36,borderRadius:"50%",background:item.done?"#1a3c5e":"#e2e8f0",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{item.icon}</div>
                  {i<arr.length-1&&<div style={{width:2,flex:1,background:item.done?"#1a3c5e":"#e2e8f0",minHeight:32,margin:"4px 0"}}/>}
                </div>
                <div style={{paddingBottom:20,paddingTop:4}}>
                  <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:2}}>
                    <div style={{fontSize:13,fontWeight:600,color:item.done?"#1a3c5e":"#475569"}}>{item.label}</div>
                    <div style={{fontSize:10,background:item.done?"#dbeafe":"#f1f5f9",color:item.done?"#1d4ed8":"#94a3b8",padding:"1px 7px",borderRadius:10,fontWeight:600}}>{item.time}</div>
                  </div>
                  <div style={{fontSize:12,color:"#64748b"}}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div style={{height:"100vh",display:"flex",flexDirection:"column",fontFamily:"'Inter',sans-serif",background:"#e2e8f0"}}>
      {/* Top Nav */}
      <div style={{background:"#0f172a",padding:"0 20px",display:"flex",alignItems:"center",gap:16,height:48,flexShrink:0}}>
        <div style={{color:"white",fontWeight:800,fontSize:15,letterSpacing:0.5}}>
          <span style={{color:"#3b82f6"}}>Claims Platform</span> 
        </div>
        <div style={{marginLeft:"auto",display:"flex",gap:4}}>
          {["policyholder","adjuster"].map(v=>(
            <button key={v} onClick={()=>setView(v)} style={{padding:"5px 14px",fontSize:12,fontWeight:600,borderRadius:6,border:"none",cursor:"pointer",background:view===v?"#3b82f6":"transparent",color:view===v?"white":"#64748b",position:"relative"}}>
              {v==="policyholder"?"👤 Policyholder":"⚡ Adjuster"}
              {v==="adjuster"&&isComplete&&<span style={{position:"absolute",top:3,right:3,width:7,height:7,borderRadius:"50%",background:"#22c55e"}}/>}
            </button>
          ))}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <div style={{width:7,height:7,borderRadius:"50%",background:"#22c55e"}}/>
          <div style={{fontSize:11,color:"#64748b"}}>Live</div>
        </div>
      </div>

      {/* Main */}
      <div style={{flex:1,overflow:"hidden"}}>
        {/* ── POLICYHOLDER PANEL ── */}
        {view==="policyholder"&&(
          <div style={{display:"flex",height:"100%",flexDirection:"column"}}>
            {/* Header */}
            <div style={{background:"#1a3c5e",color:"white",padding:"14px 20px",display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:36,height:36,borderRadius:"50%",background:"#2e6da4",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:"white"}}>AI</div>
              <div>
                <div style={{fontWeight:700,fontSize:14}}>Alex</div>
                <div style={{fontSize:11,opacity:0.7}}>Claims Assistant · FNOL Intake</div>
              </div>
              <div style={{marginLeft:"auto"}}>
                <div style={{fontSize:11,background:isComplete?"#22c55e":"#f59e0b",color:"white",padding:"3px 10px",borderRadius:20,fontWeight:600}}>{isComplete?"✓ Complete":"● Live"}</div>
              </div>
            </div>


            {/* Messages */}
            <div style={{flex:1,overflowY:"auto",padding:"16px",display:"flex",flexDirection:"column",gap:12,background:"#f8fafc"}}>
              {!started?(
                <div style={{margin:"auto",textAlign:"center",maxWidth:320}}>
                  <div style={{fontSize:17,fontWeight:700,color:"#1a3c5e",marginBottom:6}}>Report an Auto Accident</div>
                  <div style={{fontSize:13,color:"#64748b",marginBottom:20}}>Our AI agent will guide you through the full claim intake in minutes.</div>
                  <button onClick={startClaim} style={{background:"#1a3c5e",color:"white",border:"none",borderRadius:8,padding:"11px 26px",fontSize:14,fontWeight:600,cursor:"pointer"}}>
                    Start My Claim →
                  </button>
                </div>
              ):(
                <>
                  {messages.map((m,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
                      {m.role==="assistant"&&(
                        <div style={{width:26,height:26,borderRadius:"50%",background:"#1a3c5e",color:"white",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,marginRight:7,flexShrink:0,marginTop:2}}>🤖</div>
                      )}
                      <div style={{maxWidth:"74%",padding:"9px 13px",borderRadius:m.role==="user"?"14px 14px 4px 14px":"14px 14px 14px 4px",background:m.role==="user"?"#1a3c5e":"white",color:m.role==="user"?"white":"#1e293b",fontSize:13,lineHeight:1.6,boxShadow:"0 1px 3px rgba(0,0,0,0.07)",whiteSpace:"pre-wrap"}}>
                        {m.content}
                      </div>
                    </div>
                  ))}
                  {loading&&(
                    <div style={{display:"flex",alignItems:"center",gap:7}}>
                      <div style={{width:26,height:26,borderRadius:"50%",background:"#1a3c5e",color:"white",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}}>🤖</div>
                      <div style={{background:"white",borderRadius:"14px 14px 14px 4px",padding:"9px 14px",boxShadow:"0 1px 3px rgba(0,0,0,0.07)"}}>
                        <div style={{display:"flex",gap:4}}>{[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:"#94a3b8",animation:`bounce 1.2s ${i*0.2}s infinite`}}/>)}</div>
                      </div>
                    </div>
                  )}
                  {isComplete&&assignedAdjuster&&(
                    <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10,padding:"12px 14px",fontSize:13,color:"#166534"}}>
                      Claim submitted. Your adjuster <strong>{assignedAdjuster.name}</strong> will contact you within 24 to 48 hours.
                    </div>
                  )}
                  <div ref={bottomRef}/>
                </>
              )}
            </div>
            {/* Input */}
            {started&&(
              <div style={{padding:"10px 14px",background:"white",borderTop:"1px solid #e2e8f0",display:"flex",gap:8}}>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if(e.key==="Enter"&&!loading&&input.trim()) sendMessage(input.trim()); }}
                  placeholder={isComplete?"Intake complete":"Type your response..."}
                  disabled={loading||isComplete}
                  style={{flex:1,border:"1px solid #cbd5e1",borderRadius:8,padding:"9px 13px",fontSize:13,outline:"none",background:"white",color:"#1e293b"}}
                />
                <button
                  onClick={()=>{ if(input.trim()) sendMessage(input.trim()); }}
                  disabled={loading||!input.trim()||isComplete}
                  style={{background:"#1a3c5e",color:"white",border:"none",borderRadius:8,padding:"9px 16px",fontSize:13,cursor:"pointer",fontWeight:600,opacity:loading||!input.trim()||isComplete?0.5:1}}
                >
                  Send
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── ADJUSTER PANEL ── */}
        {view==="adjuster"&&<AdjusterView/>}
      </div>

      <style>{`
        @keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:10px}
      `}</style>
    </div>
  );
}
