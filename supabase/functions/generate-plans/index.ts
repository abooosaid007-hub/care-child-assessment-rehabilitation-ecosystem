// Edge function: generate 5 intervention plans via Lovable AI Gateway
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `[PLAN] You are a special-education planning assistant for a Pakistani school. Using the approved clinical assessment below, generate FIVE intervention plans for the student.

You MUST return ONLY valid JSON in this exact shape, no prose, no markdown fences:
{
  "plans": [
    { "plan_type": "educational_iep", "title": "Educational IEP", "content": "..." },
    { "plan_type": "behavioral", "title": "Behavioral Intervention Plan", "content": "..." },
    { "plan_type": "nutritional", "title": "Nutritional Plan", "content": "..." },
    { "plan_type": "physical_activity", "title": "Physical Activity Plan", "content": "..." },
    { "plan_type": "therapy", "title": "Therapy Recommendations", "content": "..." }
  ]
}

Content rules per plan (use clear markdown with headings and bullet points inside the "content" string):
1. Educational IEP — must include exactly 3 SMART goals (Specific, Measurable, Achievable, Relevant, Time-bound), accommodations, and progress monitoring.
2. Behavioral Intervention Plan — list target behaviors, antecedents, replacement behaviors, reinforcement strategies, de-escalation steps.
3. Nutritional Plan — dietary considerations relevant to the diagnosis, sample daily structure, foods to favor/avoid, hydration, cultural fit for Pakistan.
4. Physical Activity Plan — weekly schedule, sensory/motor goals, suitable activities, safety notes.
5. Therapy Recommendations — speech/OT/PT/psychological as relevant, frequency, expected outcomes, referral notes.

Use professional clinical language. Every plan must reference specific findings from the approved assessment.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { studentSummary, approvedAssessment } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userContent = `STUDENT SUMMARY:\n${JSON.stringify(studentSummary ?? {}, null, 2)}\n\nAPPROVED ASSESSMENT (final clinical output):\n${approvedAssessment ?? ""}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(
        JSON.stringify({ error: "AI credits exhausted. Add funds in Lovable Cloud workspace." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!aiResp.ok) {
      const txt = await aiResp.text();
      return new Response(JSON.stringify({ error: `AI error: ${txt}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const raw = data?.choices?.[0]?.message?.content ?? "";

    let parsed: { plans?: Array<{ plan_type: string; title: string; content: string }> } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Try to extract JSON object from prose
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) {
        try { parsed = JSON.parse(m[0]); } catch { /* ignore */ }
      }
    }

    if (!parsed.plans || !Array.isArray(parsed.plans) || parsed.plans.length === 0) {
      return new Response(JSON.stringify({ error: "AI did not return valid plans JSON.", raw }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ plans: parsed.plans }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
