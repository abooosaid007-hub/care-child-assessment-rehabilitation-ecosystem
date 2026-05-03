import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Eye } from "lucide-react";
import { WeeklyAnalysisOverlay } from "./WeeklyAnalysisOverlay";

interface Props {
  studentId: string;
  studentName: string;
  studentCode: string;
  schoolSection: string | null;
  subCategory: string | null;
  priorityDomain: string | null;
  interventionStatus: string | null;
}

interface Report {
  id: string;
  created_at: string;
  rating_trend: string | null;
  psychologist_status: string | null;
  ai_analysis_output: string;
  report_week_start: string;
  report_week_end: string;
}

export function WeeklyAnalysisPanel(props: Props) {
  const { profile } = useAuth();
  const canGenerate = profile?.role === "psychologist" || profile?.role === "administrator";
  const [logCount, setLogCount] = useState<number | null>(null);
  const [latest, setLatest] = useState<Report | null>(null);
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<Report | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const hasActiveIntervention = (props.interventionStatus ?? "").toLowerCase().includes("active");

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const { count } = await supabase
        .from("daily_logs")
        .select("id", { count: "exact", head: true })
        .eq("student_id", props.studentId)
        .gte("log_date", since);
      setLogCount(count ?? 0);

      const { data } = await supabase
        .from("progress_reports")
        .select("id, created_at, rating_trend, psychologist_status, ai_analysis_output, report_week_start, report_week_end")
        .eq("student_id", props.studentId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setLatest((data as Report) ?? null);
    })();
  }, [props.studentId, refreshKey]);

  const enoughLogs = (logCount ?? 0) >= 5;
  const enabled = canGenerate && hasActiveIntervention && enoughLogs && !!props.priorityDomain;

  const daysSinceLast = latest
    ? Math.floor((Date.now() - new Date(latest.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const canGenerateNew = enabled && (!latest || (daysSinceLast ?? 999) >= 7);

  const trendBadge = (trend: string | null) => {
    if (trend === "Improving") return "bg-green-600 text-white";
    if (trend === "Declining") return "bg-amber-600 text-white";
    return "bg-blue-600 text-white";
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Weekly Progress Analysis</CardTitle>
          {latest?.rating_trend && (
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${trendBadge(latest.rating_trend)}`}>
              Trend: {latest.rating_trend}
            </span>
          )}
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {latest ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Last Analysis</p>
                <p className="font-medium mt-1">{new Date(latest.created_at).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Status</p>
                <p className="font-medium mt-1">{latest.psychologist_status ?? "Pending"}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Week</p>
                <p className="font-medium mt-1">{latest.report_week_start} → {latest.report_week_end}</p>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">No weekly analyses yet.</p>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            {latest && (
              <Button variant="outline" onClick={() => setViewing(latest)}>
                <Eye className="h-4 w-4" /> View Analysis
              </Button>
            )}
            {canGenerate && (
              <div title={!enabled
                ? !hasActiveIntervention ? "Active intervention required"
                  : !props.priorityDomain ? "Priority domain required"
                  : !enoughLogs ? "Need 5+ daily logs from past week to generate analysis"
                  : ""
                : ""}>
                <Button
                  className="bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
                  disabled={!enabled || (!!latest && !canGenerateNew)}
                  onClick={() => setOpen(true)}
                >
                  <Sparkles className="h-4 w-4" />
                  {latest ? "Generate New Analysis" : "Generate Weekly Analysis"}
                </Button>
              </div>
            )}
          </div>

          {canGenerate && !enabled && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              {!hasActiveIntervention && "Active intervention required. "}
              {!props.priorityDomain && "Priority domain required. "}
              {!enoughLogs && `Need 5+ daily logs from past week (have ${logCount ?? 0}).`}
            </p>
          )}
          {canGenerate && enabled && latest && !canGenerateNew && (
            <p className="text-xs text-muted-foreground">
              Next analysis available in {7 - (daysSinceLast ?? 0)} day(s).
            </p>
          )}
        </CardContent>
      </Card>

      {open && props.priorityDomain && (
        <WeeklyAnalysisOverlay
          studentId={props.studentId}
          studentName={props.studentName}
          studentCode={props.studentCode}
          schoolSection={props.schoolSection}
          subCategory={props.subCategory}
          priorityDomain={props.priorityDomain}
          onClose={() => setOpen(false)}
          onSaved={() => setRefreshKey((k) => k + 1)}
        />
      )}

      {viewing && (
        <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
          <div className="sticky top-0 bg-card border-b border-border">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Weekly Analysis — {viewing.report_week_start} → {viewing.report_week_end}</p>
                <p className="text-xs text-muted-foreground">Status: {viewing.psychologist_status ?? "Pending"}</p>
              </div>
              <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
            </div>
          </div>
          <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-24">
            <Card>
              <CardContent className="pt-6">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{viewing.ai_analysis_output}</pre>
              </CardContent>
            </Card>
          </main>
        </div>
      )}
    </>
  );
}
