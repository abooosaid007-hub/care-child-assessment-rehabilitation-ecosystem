// Edge function: generate domain-focused intervention OPTIONS via Lovable AI Gateway
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const buildSystemPrompt = (domain: string) => `You are operating using the psychologist-analyst framework for special education. Analyze this child's profile focusing ONLY on the selected priority domain: ${domain}. Generate intervention options using this EXACT format and nothing else:

MAIN DIFFICULTY (one clear issue in this domain)

MOST LIKELY TRIGGER (context or cause)

PSYCHOLOGICAL INTERPRETATION (1-2 lines, no jargon)

ACTION OPTIONS (exactly 3 strategies)

For each option include:
- When it works
- When it fails
- Difficulty: LOW/MEDIUM/HIGH
- Action: (brief description)

Label them OPTION A, OPTION B, OPTION C.

FINAL RECOMMENDATION (pick ONE option: A, B, or C)

CONFIDENCE LEVEL (Low/Medium/High + reason)

OPTION D — Continue current plan (include reason even if not applicable)

Keep output SHORT. No paragraphs longer than 2 lines. Teacher must be able to read and understand in under 2 minutes.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { studentSummary, approvedAssessment, priorityDomain, feedback, previousOptions } = await req.json();
    if (!priorityDomain) {
      return new Response(JSON.stringify({ error: "priorityDomain is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userContent =
      `STUDENT SUMMARY:\n${JSON.stringify(studentSummary ?? {}, null, 2)}\n\n` +
      `APPROVED ASSESSMENT:\n${approvedAssessment ?? ""}\n\n` +
      (previousOptions ? `PREVIOUS AI OPTIONS:\n${previousOptions}\n\n` : "") +
      (feedback
        ? `PSYCHOLOGIST REFINEMENT FEEDBACK:\n${feedback}\n\nINSTRUCTION: Regenerate intervention options incorporating this feedback. Modify strategy LOGIC, not just wording. Keep the same structure (Options A/B/C with When it works, When it fails, Difficulty, Action).\n`
        : "");

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: buildSystemPrompt(priorityDomain) },
          { role: "user", content: userContent },
        ],
        max_completion_tokens: 8192,
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
    const output = data?.choices?.[0]?.message?.content ?? "";
    if (!output) {
      return new Response(JSON.stringify({ error: "AI returned empty output." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ output }), {
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
