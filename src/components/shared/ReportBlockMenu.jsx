import React, { useState } from "react";
import { Ban, Flag, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import {
  REPORT_REASONS,
  blockUser,
  isBlocked,
  submitUserReport,
} from "@/lib/trustSafetyApi";

/**
 * Compact report / block actions for cards and chat headers.
 */
export default function ReportBlockMenu({ targetId, targetName, link = "" }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  if (!user?.id || !targetId || targetId === user.id) return null;

  const alreadyBlocked = isBlocked(user.id, targetId);

  const onBlock = async () => {
    setBusy(true);
    try {
      await blockUser(user.id, targetId, targetName);
      toast({ title: alreadyBlocked ? "Already blocked" : "User blocked" });
      setOpen(false);
    } catch (err) {
      toast({ variant: "destructive", title: err?.message || "Couldn't block" });
    } finally {
      setBusy(false);
    }
  };

  const onReport = async () => {
    setBusy(true);
    try {
      await submitUserReport(user, { targetId, targetName, reason, details, link });
      toast({ title: "Report submitted" });
      setReportOpen(false);
      setOpen(false);
      setDetails("");
    } catch (err) {
      toast({ variant: "destructive", title: err?.message || "Couldn't report" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="rounded-xl h-8 w-8"
        aria-label="Safety actions"
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal className="w-4 h-4" />
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl border border-border bg-card shadow-lift py-1">
          <button
            type="button"
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted text-left"
            onClick={() => setReportOpen(true)}
          >
            <Flag className="w-3.5 h-3.5" /> Report
          </button>
          <button
            type="button"
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted text-left"
            onClick={onBlock}
            disabled={busy}
          >
            <Ban className="w-3.5 h-3.5" /> {alreadyBlocked ? "Blocked" : "Block"}
          </button>
        </div>
      )}

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>Report {targetName || "user"}</DialogTitle>
          </DialogHeader>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full h-10 px-3 rounded-xl bg-muted border border-border text-sm"
          >
            {REPORT_REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <Textarea
            rows={3}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="What happened?"
            className="rounded-xl bg-muted"
          />
          <Button
            className="rounded-xl bg-titan-cyan text-black hover:bg-titan-cyan/90"
            disabled={busy}
            onClick={onReport}
          >
            Submit report
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
