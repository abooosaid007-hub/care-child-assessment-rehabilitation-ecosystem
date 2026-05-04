// Edge function: generate parent weekly summary in Urdu and English.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You generate parent communication for a special education child in Pakistan, sent via WhatsApp/SMS.

Generate in BOTH Urdu and English using this MANDATORY structure exactly. Do not skip or rename sections.

---
URDU VERSION:

✅ بہتری (IMPROVEMENT):
[One positive — what went well. Start positive. Max 1 line. Use child's name. Be specific with days/numbers.]

📊 مشاہدہ (OBSERVATION):
[One neutral fact about challenge — no blame. Max 1 line. Mention trigger/context.]

🏠 گھر پر کریں (HOME ACTION):
[One simple action. Max 2 lines. Specific and doable. Include duration/frequency.]

⚠️ آہستہ آہستہ اپنائیں، دباؤ نہ ڈالیں

📅 اگلی ملاقات:
اگلے ہفتے - کوئی سوال ہو تو پوچھیں

---
ENGLISH VERSION:

✅ IMPROVEMENT THIS WEEK:
[Same positive in English. Max 1 line.]

📊 OBSERVATION:
[Same neutral in English. Max 1 line.]

🏠 WHAT TO DO AT HOME:
[Same action in English. Max 2 lines.]

⚠️ Apply gently, do not pressure the child

📅 NEXT MEETING:
Next week - bring any questions

---

CRITICAL RULES:
- ALWAYS start with positive (✅ first)
- Never lead with problems
- Challenges as observations, not criticism
- No clinical language ("deficit", "disorder", "dysfunction")
- No raw incident numbers without context
- Home action specific: "10 minutes daily" not "spend time"
- Simple action parent can start TODAY
- No medical/therapy advice
- Max 1-2 lines per section
- Use child's name in positive
- Mandatory gentle warning included EXACTLY as shown
- Warm supportive tone`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const p = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userContent = `STUDENT: ${p.studentName}
WEEK OF: ${p.weekStart} to ${p.weekEnd}

DATA:
- Good performance days: ${p.daysGoodPerformance} of 7
- Average level: ${p.avgRating} of 3
- Challenge area: ${p.priorityDomain}
- Primary trigger: ${p.dominantTrigger ?? "—"}
- Intervention focus: ${p.activeStrategy ?? "—"}
- Incidents: ${p.incidentCount}

HIGHLIGHTS:
${p.positiveHighlight}

CHALLENGE:
${p.challengeObservation}

HOME ACTION:
${p.homeAction}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Lovable Cloud." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      const txt = await aiResp.text();
      return new Response(JSON.stringify({ error: `AI error: ${txt}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const output: string = data?.choices?.[0]?.message?.content ?? "";
    if (!output) {
      return new Response(JSON.stringify({ error: "AI returned empty output." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Split into Urdu / English by the marker headers.
    const urduMatch = output.match(/URDU VERSION:\s*([\s\S]*?)(?=ENGLISH VERSION:|---\s*ENGLISH|$)/i);
    const englishMatch = output.match(/ENGLISH VERSION:\s*([\s\S]*?)$/i);
    const urdu = (urduMatch?.[1] ?? "").trim().replace(/^---+\s*/g, "").replace(/---+$/g, "").trim();
    const english = (englishMatch?.[1] ?? "").trim().replace(/^---+\s*/g, "").replace(/---+$/g, "").trim();

    return new Response(JSON.stringify({ output, urdu, english }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
