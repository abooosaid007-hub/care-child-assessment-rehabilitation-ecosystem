import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Eye, Send, Save, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Props {
  studentId: string;
  studentName: string;
  priorityDomain: string | null;
}

interface Communication {
  id: string;
  created_at: string;
  week_start: string;
  week_end: string;
  summary_urdu: string;
  summary_english: string;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  sent_at: string | null;
  sent_by: string | null;
  communication_method: string | null;
  parent_response: string | null;
  response_type: string | null;
  positive_highlight: string | null;
  challenge_observation: string | null;
  home_action: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  Draft: "bg-muted text-muted-foreground",
  Approved: "bg-blue-600 text-white",
  Approved_Not_Sent: "bg-blue-600 text-white",
  Sent: "bg-green-600 text-white",
  Failed: "bg-red-600 text-white",
};

function validateStructure(text: string): string[] {
  const errs: string[] = [];
  if (!text.includes("✅")) errs.push("Missing ✅ improvement section");
  if (!text.includes("📊")) errs.push("Missing 📊 observation section");
  if (!text.includes("🏠")) errs.push("Missing 🏠 home action section");
  if (!text.includes("⚠️")) errs.push("Missing ⚠️ gentle warning");
  if (!text.includes("📅")) errs.push("Missing 📅 next meeting section");
  const idxPlus = text.indexOf("✅");
  const idxObs = text.indexOf("📊");
  if (idxPlus >= 0 && idxObs >= 0 && idxPlus > idxObs) errs.push("Positive must come first");
  return errs;
}

const CLINICAL_TERMS = ["deficit", "disorder", "dysfunction", "pathology", "syndrome", "diagnosis"];
function findClinicalTerms(text: string): string[] {
  const lower = text.toLowerCase();
  return CLINICAL_TERMS.filter((t) => lower.includes(t));
}

export function ParentSummaryPanel(props: Props) {
  const { profile, user } = useAuth();
  const canGenerate = profile?.role === "psychologist" || profile?.role === "administrator";

  const [logCount, setLogCount] = useState(0);
  const [hasWeeklyAnalysis, setHasWeeklyAnalysis] = useState(false);
  const [history, setHistory] = useState<Communication[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const [generating, setGenerating] = useState(false);
  const [reviewComm, setReviewComm] = useState<Communication | null>(null);
  const [editingReview, setEditingReview] = useState(false);
  const [reviewUrdu, setReviewUrdu] = useState("");
  const [reviewEnglish, setReviewEnglish] = useState("");

  const [sendComm, setSendComm] = useState<Communication | null>(null);
  const [sendUrdu, setSendUrdu] = useState("");
  const [sendEnglish, setSendEnglish] = useState("");
  const [sendUrduEnabled, setSendUrduEnabled] = useState(true);
  const [sendEnglishEnabled, setSendEnglishEnabled] = useState(true);
  const [sending, setSending] = useState(false);

  const [viewComm, setViewComm] = useState<Communication | null>(null);
  const [feedbackComm, setFeedbackComm] = useState<Communication | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackType, setFeedbackType] = useState<string>("Positive");

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const { count } = await supabase
        .from("daily_logs")
        .select("id", { count: "exact", head: true })
        .eq("student_id", props.studentId)
        .gte("log_date", since);
      setLogCount(count ?? 0);

      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: pr } = await supabase
        .from("progress_reports")
        .select("id, psychologist_status, created_at")
        .eq("student_id", props.studentId)
        .eq("psychologist_status", "Approved")
        .gte("created_at", weekAgo)
        .limit(1);
      setHasWeeklyAnalysis((pr?.length ?? 0) > 0);

      const { data: hist } = await supabase
        .from("parent_communications")
        .select("*")
        .eq("student_id", props.studentId)
        .order("created_at", { ascending: false });
      setHistory((hist as Communication[]) ?? []);
    })();
  }, [props.studentId, refreshKey]);

  const enoughLogs = logCount >= 5;
  const meetsCriteria = hasWeeklyAnalysis || enoughLogs;
  const enabled = canGenerate && meetsCriteria && !!props.priorityDomain;

  const latest = history[0] ?? null;
  const daysSinceLast = latest
    ? Math.floor((Date.now() - new Date(latest.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const canGenerateNew = !latest || (daysSinceLast ?? 999) >= 7;

  const generateSummary = async () => {
    if (!enabled) return;
    if (!props.priorityDomain) return;
    setGenerating(true);
    try {
      // Fetch context
      const since = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);
      const { data: logs } = await supabase
        .from("daily_logs")
        .select("rating, behavioral_incidents, context_trigger, teacher_notes, log_date")
        .eq("student_id", props.studentId)
        .gte("log_date", since)
        .order("log_date", { ascending: true });

      const logRows = logs ?? [];
      if (logRows.length < 5 && !hasWeeklyAnalysis) {
        toast.error("Insufficient data for parent summary");
        setGenerating(false);
        return;
      }

      const ratings = logRows.map((l) => l.rating ?? 0).filter((r) => r > 0);
      const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
      const incidentCount = logRows.reduce((s, l) => s + (l.behavioral_incidents ?? 0), 0);
      const daysGoodPerformance = logRows.filter((l) => (l.rating ?? 0) >= 2).length;

      const triggerCounts: Record<string, number> = {};
      for (const l of logRows) {
        const t = (l.context_trigger ?? "").trim();
        if (t && t.toLowerCase() !== "unknown") triggerCounts[t] = (triggerCounts[t] ?? 0) + 1;
      }
      const dominantTrigger = Object.entries(triggerCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "varied contexts";

      const bestDay = logRows.reduce<typeof logRows[0] | null>(
        (best, l) => ((l.rating ?? 0) > (best?.rating ?? 0) ? l : best),
        null,
      );
      const positiveNote = logRows.find((l) => (l.teacher_notes ?? "").length > 10 && (l.rating ?? 0) >= 2);
      const positiveHighlight = positiveNote?.teacher_notes
        ?? (bestDay ? `Best day was ${bestDay.log_date} with strong engagement` : `${daysGoodPerformance} good day(s) this week`);

      // Active strategy
      const { data: plan } = await supabase
        .from("intervention_plans")
        .select("selected_strategy, content")
        .eq("student_id", props.studentId)
        .eq("status", "Active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const activeStrategy = plan?.selected_strategy ?? "current strategy";
      const homeAction = `Practice ${props.priorityDomain.toLowerCase()} support for 10 minutes daily at home using the school strategy.`;
      const challengeObservation = `${props.priorityDomain} difficulties most often during ${dominantTrigger}.`;

      // Weekly analysis context
      let progressReportId: string | null = null;
      const { data: latestReport } = await supabase
        .from("progress_reports")
        .select("id")
        .eq("student_id", props.studentId)
        .eq("psychologist_status", "Approved")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestReport) progressReportId = latestReport.id;

      const weekStart = since;
      const weekEnd = today;

      const callAi = async () => {
        const { data, error } = await supabase.functions.invoke("generate-parent-summary", {
          body: {
            studentName: props.studentName,
            weekStart,
            weekEnd,
            daysGoodPerformance,
            avgRating: avgRating.toFixed(2),
            priorityDomain: props.priorityDomain,
            dominantTrigger,
            activeStrategy,
            incidentCount,
            positiveHighlight,
            challengeObservation,
            homeAction,
          },
        });
        if (error) throw error;
        return data as { output: string; urdu: string; english: string };
      };

      let result = await callAi();
      const fullText = (result.urdu + "\n" + result.english) || result.output;
      let errs = validateStructure(fullText);
      if (errs.length > 0 || findClinicalTerms(fullText).length > 0) {
        // retry once
        result = await callAi();
        const ft2 = (result.urdu + "\n" + result.english) || result.output;
        errs = validateStructure(ft2);
        if (errs.length > 0) {
          toast.error("AI output failed validation. Please retry.", {
            description: errs.join("; "),
          });
          setGenerating(false);
          return;
        }
      }

      const { data: inserted, error: insErr } = await supabase
        .from("parent_communications")
        .insert({
          student_id: props.studentId,
          progress_report_id: progressReportId,
          week_start: weekStart,
          week_end: weekEnd,
          summary_urdu: result.urdu || result.output,
          summary_english: result.english || result.output,
          positive_highlight: positiveHighlight,
          challenge_observation: challengeObservation,
          home_action: homeAction,
          status: "Draft",
          created_by: user?.id ?? null,
        })
        .select("*")
        .single();

      if (insErr) throw insErr;

      const c = inserted as Communication;
      setReviewComm(c);
      setReviewUrdu(c.summary_urdu);
      setReviewEnglish(c.summary_english);
      setEditingReview(false);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to generate parent summary";
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  const saveReviewEdits = async () => {
    if (!reviewComm) return;
    const { error } = await supabase
      .from("parent_communications")
      .update({ summary_urdu: reviewUrdu, summary_english: reviewEnglish })
      .eq("id", reviewComm.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setReviewComm({ ...reviewComm, summary_urdu: reviewUrdu, summary_english: reviewEnglish });
    setEditingReview(false);
    toast.success("Edits saved");
  };

  const approveAndOpenSend = async () => {
    if (!reviewComm) return;
    const { error } = await supabase
      .from("parent_communications")
      .update({
        status: "Approved",
        approved_by: user?.id ?? null,
        approved_at: new Date().toISOString(),
        summary_urdu: reviewUrdu,
        summary_english: reviewEnglish,
      })
      .eq("id", reviewComm.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    const updated: Communication = {
      ...reviewComm,
      status: "Approved",
      approved_by: user?.id ?? null,
      approved_at: new Date().toISOString(),
      summary_urdu: reviewUrdu,
      summary_english: reviewEnglish,
    };
    setReviewComm(null);
    openSendPanel(updated);
    setRefreshKey((k) => k + 1);
  };

  const saveWithoutSendingFromReview = async () => {
    if (!reviewComm) return;
    const { error } = await supabase
      .from("parent_communications")
      .update({
        status: "Approved_Not_Sent",
        approved_by: user?.id ?? null,
        approved_at: new Date().toISOString(),
        summary_urdu: reviewUrdu,
        summary_english: reviewEnglish,
        communication_method: "Not Sent",
      })
      .eq("id", reviewComm.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setReviewComm(null);
    toast.success("Saved. You can send later from student profile.");
    setRefreshKey((k) => k + 1);
  };

  const openSendPanel = (c: Communication) => {
    setSendComm(c);
    setSendUrdu(c.summary_urdu);
    setSendEnglish(c.summary_english);
    setSendUrduEnabled(true);
    setSendEnglishEnabled(true);
  };

  const sendNow = async () => {
    if (!sendComm) return;
    if (!sendUrduEnabled && !sendEnglishEnabled) {
      toast.error("Select at least one language");
      return;
    }
    if (sendUrduEnabled && !sendUrdu.trim()) {
      toast.error("Urdu message is empty");
      return;
    }
    if (sendEnglishEnabled && !sendEnglish.trim()) {
      toast.error("English message is empty");
      return;
    }
    if (!confirm("Send this message to parents?")) return;
    setSending(true);
    const { error } = await supabase
      .from("parent_communications")
      .update({
        summary_urdu: sendUrdu,
        summary_english: sendEnglish,
        status: "Sent",
        sent_at: new Date().toISOString(),
        sent_by: user?.id ?? null,
        communication_method: "WhatsApp",
      })
      .eq("id", sendComm.id);
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("✅ Message sent successfully");
    setSendComm(null);
    setRefreshKey((k) => k + 1);
  };

  const saveWithoutSendingFromSend = async () => {
    if (!sendComm) return;
    const { error } = await supabase
      .from("parent_communications")
      .update({
        summary_urdu: sendUrdu,
        summary_english: sendEnglish,
        status: "Approved_Not_Sent",
        communication_method: "Not Sent",
      })
      .eq("id", sendComm.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSendComm(null);
    toast.success("Saved. You can send later.");
    setRefreshKey((k) => k + 1);
  };

  const submitFeedback = async () => {
    if (!feedbackComm) return;
    const { error } = await supabase
      .from("parent_communications")
      .update({ parent_response: feedbackText, response_type: feedbackType })
      .eq("id", feedbackComm.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Feedback saved");
    setFeedbackComm(null);
    setFeedbackText("");
    setFeedbackType("Positive");
    setRefreshKey((k) => k + 1);
  };

  const sendValidationWarnings = useMemo(() => {
    const warns: string[] = [];
    const text = sendUrdu + "\n" + sendEnglish;
    if (!text.trimStart().startsWith("✅") && !text.includes("✅")) warns.push("Recommended: Start with positive (✅)");
    const actionText = (sendUrdu + " " + sendEnglish).toLowerCase();
    if (!/\d+\s*(min|minute|day|daily|week|hour)/.test(actionText)) {
      warns.push("Action should be specific (e.g., 10 min daily)");
    }
    return warns;
  }, [sendUrdu, sendEnglish]);

  const tooltip = !canGenerate
    ? "Psychologist or administrator only"
    : !props.priorityDomain
      ? "Priority domain required"
      : !meetsCriteria
        ? "Need weekly analysis or 5+ daily logs"
        : "";

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Parent Communication</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {latest ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Last Summary</p>
                <p className="font-medium mt-1">{new Date(latest.created_at).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Status</p>
                <p className="mt-1">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[latest.status] ?? "bg-muted"}`}>
                    {latest.status === "Sent" ? "✓ Sent" : latest.status}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Last Sent</p>
                <p className="font-medium mt-1">
                  {latest.sent_at ? new Date(latest.sent_at).toLocaleDateString() : "Not sent yet"}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">No parent summaries yet.</p>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            {latest && (
              <Button variant="outline" onClick={() => setViewComm(latest)}>
                <Eye className="h-4 w-4" /> View Message
              </Button>
            )}
            {latest && latest.status === "Approved_Not_Sent" && canGenerate && (
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => openSendPanel(latest)}
              >
                <Send className="h-4 w-4" /> Send Now
              </Button>
            )}
            {canGenerate && (
              <div title={tooltip}>
                <Button
                  className="bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50"
                  disabled={!enabled || generating || (!!latest && !canGenerateNew)}
                  onClick={generateSummary}
                >
                  <MessageSquare className="h-4 w-4" />
                  {generating ? "📱 Generating parent summary..." : latest ? "Generate New" : "Generate Parent Summary"}
                </Button>
              </div>
            )}
          </div>

          {canGenerate && !enabled && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              {tooltip}
            </p>
          )}
          {canGenerate && enabled && latest && !canGenerateNew && (
            <p className="text-xs text-muted-foreground">
              Next summary available in {7 - (daysSinceLast ?? 0)} day(s).
            </p>
          )}
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Communication History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-muted-foreground border-b">
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Method</th>
                    <th className="py-2 pr-3">Response</th>
                    <th className="py-2 pr-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((c) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="py-2 pr-3">
                        {c.sent_at ? new Date(c.sent_at).toLocaleDateString() : new Date(c.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-2 pr-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[c.status] ?? "bg-muted"}`}>
                          {c.status === "Sent" ? "✓ Sent" : c.status}
                        </span>
                      </td>
                      <td className="py-2 pr-3">{c.communication_method ?? "—"}</td>
                      <td className="py-2 pr-3">
                        {c.response_type ? (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                            c.response_type === "Concerned" ? "bg-red-600 text-white" : "bg-secondary"
                          }`}>
                            {c.response_type === "Concerned" ? "⚠️ " : ""}{c.response_type}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex flex-wrap gap-1">
                          <Button size="sm" variant="outline" onClick={() => setViewComm(c)}>View</Button>
                          {c.status === "Sent" && canGenerate && (
                            <Button size="sm" variant="outline" onClick={() => { setFeedbackComm(c); setFeedbackText(c.parent_response ?? ""); setFeedbackType(c.response_type ?? "Positive"); }}>
                              Feedback
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Review overlay */}
      {reviewComm && (
        <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
          <div className="sticky top-0 bg-yellow-100 border-b border-yellow-300 px-4 py-2 text-sm font-semibold text-yellow-900">
            ⚠️ PARENT SUMMARY — REVIEW BEFORE SENDING
          </div>
          <div className="max-w-5xl mx-auto px-4 py-4">
            <p className="text-xs text-muted-foreground mb-3">
              This will be shared with parents. Ensure tone is supportive and action is safe.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Urdu</CardTitle></CardHeader>
                <CardContent>
                  {editingReview ? (
                    <Textarea rows={14} dir="rtl" value={reviewUrdu} onChange={(e) => setReviewUrdu(e.target.value)} />
                  ) : (
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed" dir="rtl">{reviewUrdu}</pre>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">English</CardTitle></CardHeader>
                <CardContent>
                  {editingReview ? (
                    <Textarea rows={14} value={reviewEnglish} onChange={(e) => setReviewEnglish(e.target.value)} />
                  ) : (
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{reviewEnglish}</pre>
                  )}
                </CardContent>
              </Card>
            </div>
            <div className="flex flex-wrap gap-2 mt-4 pb-8">
              <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={editingReview ? async () => { await saveReviewEdits(); approveAndOpenSend(); } : approveAndOpenSend}>
                Approve &amp; Continue to Send
              </Button>
              {!editingReview ? (
                <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setEditingReview(true)}>
                  Edit Before Approving
                </Button>
              ) : (
                <Button variant="outline" onClick={saveReviewEdits}>
                  Save Edits
                </Button>
              )}
              <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={saveWithoutSendingFromReview}>
                <Save className="h-4 w-4" /> Save Without Sending
              </Button>
              <Button variant="ghost" onClick={() => setReviewComm(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* Send overlay */}
      {sendComm && (
        <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
          <div className="sticky top-0 bg-card border-b px-4 py-3 flex items-center justify-between">
            <p className="font-semibold">Send Parent Communication</p>
            <Button variant="ghost" onClick={() => setSendComm(null)}>Close</Button>
          </div>
          <div className="max-w-5xl mx-auto px-4 py-4 space-y-4 pb-24">
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={sendUrduEnabled} onChange={(e) => setSendUrduEnabled(e.target.checked)} /> Send Urdu
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={sendEnglishEnabled} onChange={(e) => setSendEnglishEnabled(e.target.checked)} /> Send English
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs uppercase text-muted-foreground mb-1">Urdu Message</p>
                <Textarea rows={14} dir="rtl" value={sendUrdu} onChange={(e) => setSendUrdu(e.target.value)} disabled={!sendUrduEnabled} />
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground mb-1">English Message</p>
                <Textarea rows={14} value={sendEnglish} onChange={(e) => setSendEnglish(e.target.value)} disabled={!sendEnglishEnabled} />
              </div>
            </div>
            {sendValidationWarnings.length > 0 && (
              <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                {sendValidationWarnings.map((w) => <p key={w}>• {w}</p>)}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Recommended: ✅ Improvement → 📊 Observation → 🏠 Action
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="lg" className="bg-green-600 hover:bg-green-700 text-white" disabled={sending} onClick={sendNow}>
                <Send className="h-4 w-4" /> Send to Parent
              </Button>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => toast.info("Edit the message above, then click Send to Parent.")}>
                Edit Before Sending
              </Button>
              <Button variant="outline" onClick={() => { setSendUrdu(""); setSendEnglish(""); toast.info("Cleared. Write your message manually."); }}>
                <RefreshCw className="h-4 w-4" /> Write Manual Message
              </Button>
              <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={saveWithoutSendingFromSend}>
                <Save className="h-4 w-4" /> Save Without Sending
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* View overlay */}
      {viewComm && (
        <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
          <div className="sticky top-0 bg-card border-b px-4 py-3 flex items-center justify-between">
            <p className="text-sm font-semibold">
              Parent Summary — {viewComm.week_start} → {viewComm.week_end}
            </p>
            <Button variant="outline" onClick={() => setViewComm(null)}>Close</Button>
          </div>
          <div className="max-w-5xl mx-auto px-4 py-4 grid grid-cols-1 md:grid-cols-2 gap-4 pb-24">
            <Card>
              <CardHeader><CardTitle className="text-base">Urdu</CardTitle></CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed" dir="rtl">{viewComm.summary_urdu}</pre>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">English</CardTitle></CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{viewComm.summary_english}</pre>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Feedback modal */}
      {feedbackComm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4">
          <Card className="max-w-md w-full">
            <CardHeader><CardTitle>Add Parent Feedback</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs uppercase text-muted-foreground mb-1">Parent Response</p>
                <Textarea rows={4} value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} placeholder="Summarize what parent said/wrote" />
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground mb-1">Response Type</p>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={feedbackType} onChange={(e) => setFeedbackType(e.target.value)}>
                  <option>Positive</option>
                  <option>Neutral</option>
                  <option>Concerned</option>
                  <option>No Response</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setFeedbackComm(null)}>Cancel</Button>
                <Button onClick={submitFeedback}>Save</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
