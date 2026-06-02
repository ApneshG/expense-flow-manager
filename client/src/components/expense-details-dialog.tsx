import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/pages/my-expenses";
import { format, parseISO } from "date-fns";
import { ExpenseRequest, useApp } from "@/lib/store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Receipt, User, Building, Calendar, MessageSquare, CreditCard, History, Undo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export function ExpenseDetailsDialog({ 
    expense, 
    open, 
    onOpenChange 
}: { 
    expense: ExpenseRequest | null, 
    open: boolean, 
    onOpenChange: (open: boolean) => void 
}) {
    const { users, departments, currentUser, updateExpenseStatus } = useApp();
    const { toast } = useToast();
    if (!expense) return null;

    const employee = users.find(u => u.id === expense.employeeId);
    const department = departments.find(d => d.id === expense.departmentId);
    const hod = users.find(u => u.id === expense.hodId);

    const isPendingHoD = expense.status === 'pending_hod';
    const canWithdraw = currentUser?.id === expense.employeeId && isPendingHoD;

    const handleWithdraw = () => {
        if (confirm("Are you sure you want to withdraw this request? It will be moved to your drafts.")) {
            updateExpenseStatus(expense.id, { status: 'draft' });
            toast({
                title: "Request Withdrawn",
                description: "The expense has been moved back to your drafts.",
            });
            onOpenChange(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
                <DialogHeader className="px-6 py-4 border-b">
                    <div className="flex items-center justify-between">
                        <DialogTitle className="text-2xl flex items-center gap-2">
                            <Receipt className="w-6 h-6 text-primary" />
                            Expense Details
                        </DialogTitle>
                        <StatusBadge status={expense.status} />
                    </div>
                    <DialogDescription>
                        Request ID: {expense.id}
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1 px-6 py-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Left Column: Basic Info */}
                        <div className="space-y-6">
                            <section>
                                <h3 className="text-lg font-semibold flex items-center gap-2 mb-3 border-b pb-2">
                                    <FileText className="w-4 h-4" /> Request Info
                                </h3>
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Description</p>
                                        <p className="font-medium">{expense.description}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-sm text-muted-foreground">Amount</p>
                                            <p className="font-bold text-lg">${expense.amount.toFixed(2)}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground">Category</p>
                                            <Badge variant="secondary">{expense.category}</Badge>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Bill Date</p>
                                        <p className="font-medium flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {format(parseISO(expense.billDate), "MMMM d, yyyy")}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Attachment</p>
                                        <div className="mt-1">
                                            {expense.attachmentUrl ? (
                                                <a href="#" className="inline-flex items-center gap-2 text-sm text-primary hover:underline bg-primary/5 px-3 py-2 rounded-md border border-primary/20">
                                                    <FileText className="w-4 h-4" />
                                                    {expense.attachmentUrl}
                                                </a>
                                            ) : (
                                                <div className="inline-flex items-center gap-2 text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md border">
                                                    <FileText className="w-4 h-4 opacity-50" />
                                                    No attachment provided
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <h3 className="text-lg font-semibold flex items-center gap-2 mb-3 border-b pb-2">
                                    <User className="w-4 h-4" /> Submitter Info
                                </h3>
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Employee</p>
                                        <p className="font-medium">{employee?.name || 'Unknown'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Department</p>
                                        <p className="font-medium flex items-center gap-1">
                                            <Building className="w-3 h-3" />
                                            {department?.name || 'Unknown'}
                                        </p>
                                    </div>
                                </div>
                            </section>

                            {(expense.hodComment || expense.financeComment || expense.paymentMode) && (
                                <section>
                                    <h3 className="text-lg font-semibold flex items-center gap-2 mb-3 border-b pb-2">
                                        <MessageSquare className="w-4 h-4" /> Approvals & Payment
                                    </h3>
                                    <div className="space-y-4">
                                        {expense.hodComment && (
                                            <div className="bg-muted/40 p-3 rounded-md border-l-2 border-primary">
                                                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">HoD Remark ({hod?.name || 'HoD'})</p>
                                                <p className="text-sm">{expense.hodComment}</p>
                                                {expense.hodActionDate && <p className="text-xs text-muted-foreground mt-1">{format(parseISO(expense.hodActionDate), "MMM d, yyyy")}</p>}
                                            </div>
                                        )}
                                        {expense.financeComment && (
                                            <div className="bg-muted/40 p-3 rounded-md border-l-2 border-blue-500">
                                                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Finance Remark</p>
                                                <p className="text-sm">{expense.financeComment}</p>
                                            </div>
                                        )}
                                        {expense.paymentMode && (
                                            <div className="flex items-center gap-2 text-sm bg-emerald-50 text-emerald-800 p-2 rounded border border-emerald-200">
                                                <CreditCard className="w-4 h-4" />
                                                <span>Paid via <strong>{expense.paymentMode}</strong> {expense.paymentDate ? `on ${format(parseISO(expense.paymentDate), "MMM d, yyyy")}` : ''}</span>
                                            </div>
                                        )}
                                    </div>
                                </section>
                            )}
                        </div>

                        {/* Right Column: Audit Log */}
                        <div className="space-y-4">
                             <h3 className="text-lg font-semibold flex items-center gap-2 mb-3 border-b pb-2">
                                <History className="w-4 h-4" /> Audit History
                            </h3>
                            <div className="space-y-4">
                                {(expense.auditLog || []).length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-4">No history recorded.</p>
                                ) : (
                                    [...(expense.auditLog || [])].reverse().map((log, index) => (
                                        <div key={index} className="flex gap-3 text-sm border-l-2 border-muted pl-4 pb-1 relative">
                                            <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-primary" />
                                            <div className="flex-1 space-y-1">
                                                <div className="flex justify-between items-center">
                                                    <span className="font-semibold">{log.action}</span>
                                                    <span className="text-xs text-muted-foreground">{format(parseISO(log.timestamp), "MMM d, h:mm a")}</span>
                                                </div>
                                                <div className="text-muted-foreground text-xs">by {log.actorName}</div>
                                                {log.details && (
                                                    <div className="bg-muted/50 p-2 rounded text-xs mt-1 italic">
                                                        "{log.details}"
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </ScrollArea>
                {canWithdraw && (
                    <DialogFooter className="px-6 py-4 border-t bg-muted/20">
                        <Button variant="outline" onClick={handleWithdraw} className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive">
                            <Undo className="w-4 h-4 mr-2" />
                            Withdraw Request
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}