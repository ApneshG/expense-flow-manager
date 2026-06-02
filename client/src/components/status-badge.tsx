import { ExpenseRequest } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, XCircle, AlertCircle, FileText } from "lucide-react";

export function StatusBadge({ status }: { status: ExpenseRequest['status'] }) {
  const styles = {
    pending_hod: "bg-amber-100 text-amber-700 hover:bg-amber-100/80 border-amber-200",
    rejected_hod: "bg-red-100 text-red-700 hover:bg-red-100/80 border-red-200",
    pending_finance: "bg-blue-100 text-blue-700 hover:bg-blue-100/80 border-blue-200",
    on_hold: "bg-orange-100 text-orange-700 hover:bg-orange-100/80 border-orange-200",
    paid: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100/80 border-emerald-200",
    rejected_finance: "bg-red-100 text-red-700 hover:bg-red-100/80 border-red-200",
    needs_revision: "bg-purple-100 text-purple-700 hover:bg-purple-100/80 border-purple-200",
    draft: "bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200",
  };

  const labels = {
    pending_hod: "Pending HoD",
    rejected_hod: "Rejected (HoD)",
    pending_finance: "Pending Finance",
    on_hold: "On Hold",
    paid: "Paid",
    rejected_finance: "Rejected (Finance)",
    needs_revision: "Sent Back",
    draft: "Draft",
  };

  const Icons = {
    pending_hod: Clock,
    rejected_hod: XCircle,
    pending_finance: Clock,
    on_hold: AlertCircle,
    paid: CheckCircle2,
    rejected_finance: XCircle,
    needs_revision: AlertCircle,
    draft: FileText,
  };

  const Icon = Icons[status];

  return (
    <Badge variant="outline" className={`${styles[status] || "bg-gray-100 text-gray-700 border-gray-200"} gap-1 pr-3`}>
      <Icon className="w-3.5 h-3.5" />
      {labels[status]}
    </Badge>
  );
}
