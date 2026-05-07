// Edge function: generate monthly cycle review using weekly progress reports.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are generating a strategic monthly cycle review for a special education student in Pakistan. This review determines whether to continue, modify, or change the intervention approach for next month.

Generate the monthly cycle review using this EXACT format. Do not omit any section.

MONTHLY CYCLE REVIEW — {STUDENT NAME} — {DATE RANGE}

DOMAIN REVIEWED: {Priority Domain}

1. PROGRESS SUMMARY
{2-3 lines summarizing overall progress using specific numbers. Include baseline -> current comparison.}

2. INTERVENTION EFFECTIVENESS
{2 lines on whether strategy worked. Use compliance rate and trend data.}

3. KEY INSIGHTS
{2-3 lines on what was learned about this child's response patterns.}

4. RED FLAGS
{List concerns if any, otherwise state "No major concerns detected"}

5. NEXT MONTH OPTIONS

Option A — Continue Current Domain + Current Strategy
When recommended: {cite improving trend or positive data}
Risk: {if any}
Action: Maintain for 30 more days

Option B — Continue Current Domain + Modify Strategy
When recommended: {cite plateau or partial progress}
Risk: {strategy instability if changed too often}
Action: {specific modification needed}

Option C — Switch to New Priority Domain
When recommended: {cite goal achieved or no progress possible}
Suggested New Domain: {based on observation data}
Risk: {abandoning current progress}
Action: Return to domain selection

Option D — Reduce Support / Discharge
When recommended: {cite consistent high performance across month}
Risk: {regression without support}
Action: Move to monitoring-only status

6. FINAL RECOMMENDATION
{Choose ONE: Option A, B, C, or D}
Reasoning: {Use monthly data, cite specific numbers, max 3 lines}

7. CONFIDENCE LEVEL
{LOW/MEDIUM/HIGH}
Reason: {data quality, consistency, duration - 1 line}

CRITICAL RULES:
- Use specific numbers from monthly metrics
- Trend must be based on Week 1 vs Week 4 comparison
- If overall_trend = Improving -> strongly favor Option A
- If overall_trend = Declining for 3+ weeks -> recommend Option C or B
- If strategy_compliance < 50% -> flag implementation problem
- Option D only if avg_rating > 2.5 for entire month
- All 4 options must be present
- Be honest about lack of progress if data shows it
- Simple language - teacher and parent should understand`;

function validateOutput(text: string): boolean {
  const required = [
    /1\.\s*PROGRESS SUMMARY/i,
    /2\.\s*INTERVENTION EFFECTIVENESS/i,
    /3\.\s*KEY INSIGHTS/i,
    /4\.\s*RED FLAGS/i,
    /5\.\s*NEXT MONTH OPTIONS/i,
    /Option A/,
    /Option B/,
    /Option C/,
    /Option D/,
    /6\.\s*FINAL RECOMMENDATION/i,
    /7\.\s*CONFIDENCE LEVEL/i,
  ];
  return required.every((r) => r.test(text));
}

async function callAI(apiKey: string, userContent: string): Promise<string> {
  const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    }),
  });
  if (aiResp.status === 429) throw new Error("RATE_LIMIT");
  if (aiResp.status === 402) throw new Error("PAYMENT_REQUIRED");
  if (!aiResp.ok) throw new Error(`AI error: ${await aiResp.text()}`);
  const data = await aiResp.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const payload = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userContent = `STUDENT: ${payload.studentName} | ${payload.studentCode} | ${payload.primaryCondition ?? "—"}
INTERVENTION CYCLE: ${payload.cycleStart} to ${payload.cycleEnd} (${payload.daysElapsed} days)
PRIORITY DOMAIN: ${payload.priorityDomain}
STRATEGY IMPLEMENTED: ${payload.selectedStrategy ?? "—"}
PLAN VERSION: ${payload.planVersion ?? 1}

MONTHLY PERFORMANCE METRICS:
- Overall Trend: ${payload.metrics.overall_trend}
- Average Rating: ${payload.metrics.average_rating_month} out of 3.0
- Week 1 Baseline: ${payload.metrics.baseline_rating}
- Week 4 Current: ${payload.metrics.current_rating}
- Change from Baseline: ${payload.metrics.change_from_baseline}
- Monthly Incident Rate: ${payload.metrics.incident_trend}
- Strategy Compliance: ${payload.metrics.strategy_compliance}%
- Rating Consistency: ${payload.metrics.consistency}

WEEKLY PROGRESS SUMMARY:
${payload.weeklyLines.join("\n")}

RED FLAGS DETECTED:
${payload.redFlags?.length ? payload.redFlags.join("\n- ") : "None detected"}

PARENT ENGAGEMENT:
- Summaries Sent: ${payload.parentSummariesSent ?? 0}
- Parent Response: ${payload.parentResponse ?? "None"}
`;

    let output = "";
    try {
      output = await callAI(LOVABLE_API_KEY, userContent);
      if (!validateOutput(output)) {
        output = await callAI(LOVABLE_API_KEY, userContent + "\n\nIMPORTANT: Include all 7 numbered sections and Options A, B, C, D.");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "AI failed";
      const status = msg === "RATE_LIMIT" ? 429 : msg === "PAYMENT_REQUIRED" ? 402 : 500;
      const err = msg === "RATE_LIMIT" ? "Rate limit exceeded. Try again shortly." :
                  msg === "PAYMENT_REQUIRED" ? "AI credits exhausted. Add funds in Lovable Cloud." : msg;
      return new Response(JSON.stringify({ error: err }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!output || !validateOutput(output)) {
      return new Response(JSON.stringify({ error: "AI output validation failed. Please retry." }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
