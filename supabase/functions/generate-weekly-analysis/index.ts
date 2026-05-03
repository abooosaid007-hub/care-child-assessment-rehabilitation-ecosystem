// Edge function: generate weekly progress analysis with structured numerical input.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are operating using the psychologist-analyst framework for weekly progress analysis in a Pakistani special education school.

Generate weekly analysis using this EXACT format. Do not omit any section.

WEEKLY ANALYSIS — {STUDENT NAME} — WEEK OF {DATE RANGE}

DOMAIN: {Priority Domain}

TEACHER-REPORTED ISSUE:
{State issue or "No specific issue reported - using behavioral data"}

1. MAIN DIFFICULTY
{One clear current issue based on data - max 2 lines}

2. MOST LIKELY TRIGGER
{Use the dominant_trigger metric - max 1 line}

3. PSYCHOLOGICAL INTERPRETATION
{Why this difficulty persists - max 2 lines, simple language, no jargon}

4. ACTION OPTIONS

Option A — {Strategy Adjustment Name}
When it works: {condition}
When it fails: {condition}
Difficulty: LOW/MEDIUM/HIGH
Action: {specific change - 1 line}

Option B — {Strategy Adjustment Name}
When it works: {condition}
When it fails: {condition}
Difficulty: LOW/MEDIUM/HIGH
Action: {specific change - 1 line}

Option C — Continue Current Strategy
When it works: {cite numerical evidence of progress from metrics}
When it fails: {cite lack of progress from metrics}
Difficulty: N/A
Reason: {based on data trend - 1 line}

5. FINAL RECOMMENDATION
{Pick ONE: Option A, B, or C}
Reasoning: {use numerical data - max 2 lines}

6. CONFIDENCE LEVEL
{LOW/MEDIUM/HIGH}
Reason: {data quality/sufficiency - max 1 line}

7. BASELINE vs SPIKE
BASELINE TREND: {pattern across ALL available historical logs}
THIS WEEK SPIKES: {any 1-2 day anomalies - state date and trigger}
SIGNAL: {Real trend requiring action OR noise to ignore? Be specific.}

CRITICAL RULES YOU MUST FOLLOW:
- Prioritize NUMERICAL DATA over assumptions
- If avg_rating improving: strongly favor Option C unless other metrics contradict
- If data insufficient (e.g. only 5 logs): reduce confidence to LOW
- Do NOT invent patterns not supported by actual log data
- BASELINE = pattern from all historical logs, SPIKE = 1-2 day anomaly
- If spike does not repeat across week: mark as anomaly, ignore for decision
- Use simple language - a teacher must understand in 15 seconds
- Always include specific numbers from metrics in your reasoning
- Option C MUST always be "Continue Current Strategy"`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userContent = `STUDENT: ${payload.studentName} | ${payload.studentCode} | ${payload.section ?? "—"}
PRIORITY DOMAIN: ${payload.priorityDomain}
ACTIVE STRATEGY: ${payload.activeStrategy ?? "—"}
CYCLE DAY: ${payload.cycleDay} of ${payload.cycleLength}
PLAN VERSION: ${payload.planVersion}

QUANTITATIVE METRICS (Past 7 Days):
- Average Performance: ${payload.metrics.avg_rating} out of 3.0
- Incident Rate: ${payload.metrics.incident_rate}%
- Strategy Compliance: ${payload.metrics.strategy_compliance}%
- Primary Trigger: ${payload.metrics.dominant_trigger}
- Weekly Trend: ${payload.metrics.rating_trend}

BASELINE COMPARISON:
- This Week Average: ${payload.metrics.avg_rating}
- Historical Baseline: ${payload.metrics.baseline_from_history ?? "No baseline - first week"}
- Change from Baseline: ${payload.metrics.change_from_baseline ?? "N/A"}

DAILY LOG DETAILS:
${payload.dailyLogLines.join("\n")}

TEACHER-REPORTED ISSUE:
${payload.teacherReportedIssue}

WEEK RANGE: ${payload.weekStart} to ${payload.weekEnd}
`;

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
    const output = data?.choices?.[0]?.message?.content ?? "";
    if (!output) {
      return new Response(JSON.stringify({ error: "AI returned empty output." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ output }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
