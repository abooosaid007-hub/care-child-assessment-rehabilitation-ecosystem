import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DailyLogOverlay } from "./DailyLogOverlay";

interface LogRow {
  id: string;
  log_date: string;
  created_by: string | null;
  created_at: string;
  last_modified_at: string | null;
  edited_by_admin: boolean | null;
  edit_reason: string | null;
}

interface Props {
  studentId: string;
  studentName: string;
  priorityDomain: string | null;
  refreshKey?: number;
}

export function DailyLogHistory({ studentId, studentName, priorityDomain, refreshKey }: Props) {
  const { profile } = useAuth();
  const [rows, setRows] = useState<LogRow[]>([]);
  const [creators, setCreators] = useState<Record<string, string>>({});
  const [openLogId, setOpenLogId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().slice(0, 10);
  const isPrivileged = profile?.role === "administrator" || profile?.role === "psychologist";

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("daily_logs")
        .select("id, log_date, created_by, created_at, last_modified_at, edited_by_admin, edit_reason")
        .eq("student_id", studentId)
        .order("log_date", { ascending: false })
        .limit(30);
      const list = (data ?? []) as LogRow[];
      setRows(list);
      const ids = Array.from(new Set(list.map((r) => r.created_by).filter(Boolean))) as string[];
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", ids);
        const map: Record<string, string> = {};
        (profs ?? []).forEach((p) => {
          map[p.id] = p.full_name ?? p.email ?? "—";
        });
        setCreators(map);
      }
      setLoading(false);
    })();
  }, [studentId, refreshKey]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily Log History</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No logs yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created by</TableHead>
                  <TableHead>Last modified</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const isToday = r.log_date === today;
                  const adminEdited = !!r.edited_by_admin;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.log_date}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {isToday ? (
                            <span className="inline-flex items-center rounded-full bg-green-100 text-green-800 border border-green-300 px-2 py-0.5 text-xs font-semibold">
                              🟢 EDITABLE
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground border border-border px-2 py-0.5 text-xs font-semibold">
                              🔒 LOCKED
                            </span>
                          )}
                          {adminEdited && (
                            <span
                              className="inline-flex items-center rounded-full bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 text-xs font-semibold"
                              title={r.edit_reason ?? "Admin edited"}
                            >
                              🟡 ADMIN EDITED
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.created_by ? creators[r.created_by] ?? "—" : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.last_modified_at
                          ? new Date(r.last_modified_at).toLocaleString()
                          : new Date(r.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setOpenLogId(r.id)}>
                          {isToday || isPrivileged ? "VIEW / EDIT" : "VIEW"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {openLogId && (
        <DailyLogOverlay
          studentId={studentId}
          studentName={studentName}
          priorityDomain={priorityDomain}
          logId={openLogId}
          onClose={() => setOpenLogId(null)}
          onSaved={() => {
            setOpenLogId(null);
            // trigger reload
            (async () => {
              const { data } = await supabase
                .from("daily_logs")
                .select("id, log_date, created_by, created_at, last_modified_at, edited_by_admin, edit_reason")
                .eq("student_id", studentId)
                .order("log_date", { ascending: false })
                .limit(30);
              setRows((data ?? []) as LogRow[]);
            })();
          }}
        />
      )}
    </Card>
  );
}
