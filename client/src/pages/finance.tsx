import { StatusBadge } from "@/components/status-badge";
import { useApp } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { format, isWithinInterval, parseISO } from "date-fns";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, Send, Archive, AlertOctagon, Filter, Check, X, CalendarIcon, Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { ExpenseDetailsDialog } from "@/components/expense-details-dialog";
import { ExpenseRequest } from "@/lib/store";
import { Badge } from "@/components/ui/badge";

export default function FinancePage() {
  const { currentUser, expenses, updateExpenseStatus, users, departments, getDepartmentBudget } = useApp();
  const { toast } = useToast();
  const [comment, setComment] = useState("");
  const [paymentMode, setPaymentMode] = useState("");
  const [paymentDateInput, setPaymentDateInput] = useState(format(new Date(), "yyyy-MM-dd"));
  const [paymentRef, setPaymentRef] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  
  // Single action state
  const [isItemActionDialogOpen, setIsItemActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"paid" | "on_hold" | "needs_revision" | null>(null);

  // Bulk actions state
  const [selectedExpenses, setSelectedExpenses] = useState<string[]>([]);
  const [isBulkActionDialogOpen, setIsBulkActionDialogOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<"paid" | "on_hold" | "needs_revision" | null>(null);

  const [selectedExpense, setSelectedExpense] = useState<ExpenseRequest | null>(null);

  if (!currentUser || currentUser.role !== "finance_head") {
    return <div className="p-8 text-center text-muted-foreground">Access denied. Finance role required.</div>;
  }

  const financeQueue = expenses.filter(e => {
    // Show expenses pending finance only
    if (e.status !== "pending_finance") return false;
    
    if (dateRange?.from) {
        const billDate = parseISO(e.billDate);
        const toDate = dateRange.to || dateRange.from;
        if (!isWithinInterval(billDate, { start: dateRange.from, end: toDate })) return false;
    }

    if (selectedDepartment !== "all" && e.departmentId !== selectedDepartment) return false;

    if (searchTerm) {
        const employee = users.find(u => u.id === e.employeeId);
        const matchesSearch = 
            e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (employee?.name.toLowerCase().includes(searchTerm.toLowerCase()) || false);
        if (!matchesSearch) return false;
    }
    
    return true;
  });

  const onHoldFinance = expenses.filter(e => {
    // Show expenses specifically marked as on_hold
    if (e.status !== "on_hold") return false;
    
    if (dateRange?.from) {
        const billDate = parseISO(e.billDate);
        const toDate = dateRange.to || dateRange.from;
        if (!isWithinInterval(billDate, { start: dateRange.from, end: toDate })) return false;
    }

    if (selectedDepartment !== "all" && e.departmentId !== selectedDepartment) return false;

    if (searchTerm) {
        const employee = users.find(u => u.id === e.employeeId);
        const matchesSearch = 
            e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (employee?.name.toLowerCase().includes(searchTerm.toLowerCase()) || false);
        if (!matchesSearch) return false;
    }
    
    return true;
  });
  
  // Enterprise stats
  const totalSpent = expenses.filter(e => e.status === 'paid').reduce((acc, curr) => acc + curr.amount, 0);
  const pendingAmount = financeQueue.reduce((acc, curr) => acc + curr.amount, 0);

  const handleProcess = () => {
    if (!selectedExpenseId || !actionType) return;

    const updates: any = {
      status: actionType,
      financeComment: comment,
      financeActionDate: new Date().toISOString(),
    };

    if (actionType === "paid") {
      updates.paymentMode = paymentMode || "Bank Transfer";
      updates.paymentDate = new Date(paymentDateInput).toISOString();
      updates.paymentRef = paymentRef;
    }

    updateExpenseStatus(selectedExpenseId, updates);
    
    toast({
      title: "Processed",
      description: `Expense marked as ${actionType.replace("_", " ")}.`,
    });

    setComment("");
    setPaymentMode("");
    setPaymentDateInput(format(new Date(), "yyyy-MM-dd"));
    setPaymentRef("");
    setSelectedExpenseId(null);
    setActionType(null);
    setIsItemActionDialogOpen(false);
  };

  const toggleSelectExpense = (id: string) => {
    setSelectedExpenses(prev => 
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedExpenses.length === financeQueue.length) {
      setSelectedExpenses([]);
    } else {
      setSelectedExpenses(financeQueue.map(e => e.id));
    }
  };

  const handleBulkAction = () => {
    if (!bulkActionType) return;

    selectedExpenses.forEach(id => {
       const updates: any = {
        status: bulkActionType,
        financeComment: comment || (bulkActionType === "paid" ? "Bulk Paid" : "Bulk On Hold"),
        financeActionDate: new Date().toISOString(),
      };

      if (bulkActionType === "paid") {
        updates.paymentMode = paymentMode || "Bulk Transfer";
        updates.paymentDate = new Date(paymentDateInput).toISOString();
        updates.paymentRef = paymentRef;
      }

      updateExpenseStatus(id, updates);
    });

    toast({
      title: "Bulk Action Complete",
      description: `${selectedExpenses.length} requests have been processed.`,
    });

    setComment("");
    setPaymentMode("");
    setPaymentDateInput(format(new Date(), "yyyy-MM-dd"));
    setPaymentRef("");
    setSelectedExpenses([]);
    setIsBulkActionDialogOpen(false);
    setBulkActionType(null);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
            <h1 className="text-3xl font-display font-bold">Finance Review</h1>
            <p className="text-muted-foreground mt-1">Enterprise-wide expense oversight and payment processing.</p>
        </div>

        <Popover>
            <PopoverTrigger asChild>
            <Button
                variant={"outline"}
                className={cn(
                "w-[240px] justify-start text-left font-normal",
                !dateRange && "text-muted-foreground"
                )}
            >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                dateRange.to ? (
                    <>
                    {format(dateRange.from, "LLL dd, y")} -{" "}
                    {format(dateRange.to, "LLL dd, y")}
                    </>
                ) : (
                    format(dateRange.from, "LLL dd, y")
                )
                ) : (
                <span>Filter by Bill Date</span>
                )}
            </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
            <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
            />
            </PopoverContent>
        </Popover>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Disbursed</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">${totalSpent.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Pending Payouts</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-blue-600">${pendingAmount.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Queue Length</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{financeQueue.length}</div></CardContent>
        </Card>
        <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Departments</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{departments.length}</div></CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1 w-full">
                <h2 className="text-xl font-semibold whitespace-nowrap">Payment Queue</h2>
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search description or employee..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Department" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Departments</SelectItem>
                        {departments.map(d => (
                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            
            {selectedExpenses.length > 0 && (
                <div className="flex gap-2 flex-wrap justify-end">
                    <Button 
                        className="bg-emerald-600 hover:bg-emerald-700" 
                        onClick={() => { setBulkActionType("paid"); setIsBulkActionDialogOpen(true); }}
                    >
                        <Check className="w-4 h-4 mr-2" /> Paid ({selectedExpenses.length})
                    </Button>
                    <Button 
                        variant="outline"
                        onClick={() => { setBulkActionType("on_hold"); setIsBulkActionDialogOpen(true); }}
                    >
                        <AlertOctagon className="w-4 h-4 mr-2" /> On Hold ({selectedExpenses.length})
                    </Button>
                    <Button 
                        variant="outline"
                        onClick={() => { setBulkActionType("needs_revision"); setIsBulkActionDialogOpen(true); }}
                    >
                        <Send className="w-4 h-4 mr-2" /> Send Back ({selectedExpenses.length})
                    </Button>

                     <Dialog open={isBulkActionDialogOpen} onOpenChange={setIsBulkActionDialogOpen}>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Bulk Action</DialogTitle>
                              <DialogDescription>
                                Process {selectedExpenses.length} selected requests.
                              </DialogDescription>
                            </DialogHeader>
                             <div className="space-y-4 py-4">
                                {bulkActionType === "paid" && (
                                <>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Payment Mode</label>
                                    <Select onValueChange={setPaymentMode}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Method" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Bank transfer">Bank transfer</SelectItem>
                                            <SelectItem value="Cheque">Cheque</SelectItem>
                                            <SelectItem value="Payroll Reimbursement">Payroll Reimbursement</SelectItem>
                                            <SelectItem value="Cash">Cash</SelectItem>
                                            <SelectItem value="UPI">UPI</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Payment Date</label>
                                        <Input type="date" value={paymentDateInput} onChange={e => setPaymentDateInput(e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Reference Number</label>
                                        <Input placeholder="e.g. BLK-12345" value={paymentRef} onChange={e => setPaymentRef(e.target.value)} />
                                    </div>
                                </div>
                                </>
                                )}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Remarks / Comments</label>
                                    <Textarea 
                                        placeholder="Optional bulk comment..." 
                                        value={comment}
                                        onChange={(e) => setComment(e.target.value)}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                              <Button onClick={handleBulkAction}>
                                {bulkActionType === 'paid' ? 'Confirm Payment' : bulkActionType === 'on_hold' ? 'Put On Hold' : 'Send Back'}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                </div>
            )}
        </div>

        {financeQueue.length > 0 && (
            <div className="flex items-center gap-2 p-4 bg-muted/20 rounded-lg border mb-2">
                <Checkbox 
                    checked={selectedExpenses.length === financeQueue.length && financeQueue.length > 0}
                    onCheckedChange={toggleSelectAll}
                />
                <span className="text-sm font-medium">Select All Pending Payouts</span>
            </div>
        )}

          {/* Main Queue */}
          {financeQueue.length === 0 ? (
             <Card className="bg-muted/30 border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                 <DollarSign className="w-12 h-12 text-muted-foreground/50 mb-4" />
                 <p className="font-medium text-muted-foreground">Nothing to pay</p>
                 <p className="text-sm text-muted-foreground/80">All approved expenses have been processed.</p>
              </CardContent>
            </Card>
          ) : (
              financeQueue.map(expense => {
                  const employee = users.find(u => u.id === expense.employeeId);
                  const department = departments.find(d => d.id === expense.departmentId);
                  const departmentHoD = department ? users.find(u => u.id === department.hodId) : undefined;

                  return (
                      <Card key={expense.id} className={`flex flex-col md:flex-row overflow-hidden transition-all mb-4 ${selectedExpenses.includes(expense.id) ? 'ring-2 ring-primary border-primary' : ''}`}>
                           <div className="p-4 flex items-center justify-center border-r bg-muted/10">
                              <Checkbox
                                  checked={selectedExpenses.includes(expense.id)}
                                  onCheckedChange={() => toggleSelectExpense(expense.id)}
                              />
                            </div>
                          <div className="p-6 flex-1 space-y-3 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setSelectedExpense(expense)}>
                              <div className="flex justify-between">
                                  <div>
                                      <h3 className="font-semibold">{expense.description}</h3>
                                      <p className="text-sm text-muted-foreground">
                                          {employee?.name} • {department?.name} Department
                                      </p>
                                      <p className="text-xs text-muted-foreground mt-0.5">
                                          HoD: {departmentHoD?.name || 'Not assigned'}
                                      </p>
                                  </div>
                                  <div className="text-right">
                                      <div className="text-xl font-bold">${expense.amount.toFixed(2)}</div>
                                      <span className="text-xs text-muted-foreground">Approved by HoD on {expense.hodActionDate ? format(new Date(expense.hodActionDate), "MMM d") : 'N/A'}</span>
                                  </div>
                              </div>
                              
                              {expense.hodComment && (
                                  <div className="bg-muted/50 p-3 rounded-md text-sm border-l-2 border-primary">
                                      <span className="font-medium text-xs uppercase tracking-wide text-muted-foreground block mb-1">HoD Note</span>
                                      "{expense.hodComment}"
                                  </div>
                              )}
                          </div>

                          <div className="bg-muted/30 p-6 flex flex-col justify-center gap-2 border-l min-w-[220px]">
                              <Button 
                                  className="w-full bg-emerald-600 hover:bg-emerald-700" 
                                  onClick={() => { setSelectedExpenseId(expense.id); setActionType('paid'); setIsItemActionDialogOpen(true); }}
                              >
                                  <Check className="w-4 h-4 mr-2" /> Paid
                              </Button>
                              <Button 
                                  variant="outline" className="w-full" 
                                  onClick={() => { setSelectedExpenseId(expense.id); setActionType('on_hold'); setIsItemActionDialogOpen(true); }}
                              >
                                  <AlertOctagon className="w-4 h-4 mr-2" /> On Hold
                              </Button>
                              <Button 
                                  variant="outline" className="w-full" 
                                  onClick={() => { setSelectedExpenseId(expense.id); setActionType('needs_revision'); setIsItemActionDialogOpen(true); }}
                              >
                                  <Send className="w-4 h-4 mr-2" /> Send Back
                              </Button>
                          </div>
                      </Card>
                  );
              })
          )}

          {/* On Hold Section */}
          <div className="mt-12 space-y-4">
              <h2 className="text-xl font-semibold text-amber-700 flex items-center gap-2">
                  <AlertOctagon className="w-5 h-5" /> On Hold Requests
                  <Badge variant="secondary" className="rounded-full bg-amber-100 text-amber-700 ml-2">{onHoldFinance.length}</Badge>
              </h2>
              
              {onHoldFinance.length === 0 ? (
                  <Card className="bg-muted/10 border-dashed">
                      <CardContent className="py-8 text-center text-muted-foreground">
                          No requests currently on hold.
                      </CardContent>
                  </Card>
              ) : (
                  onHoldFinance.map(expense => {
                      const employee = users.find(u => u.id === expense.employeeId);
                      const department = departments.find(d => d.id === expense.departmentId);
                      const departmentHoD = department ? users.find(u => u.id === department.hodId) : undefined;

                      return (
                          <Card key={expense.id} className="flex flex-col md:flex-row overflow-hidden transition-all mb-4 border-amber-200">
                              <div className="p-6 flex-1 space-y-3 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setSelectedExpense(expense)}>
                                  <div className="flex justify-between">
                                      <div>
                                          <h3 className="font-semibold">{expense.description}</h3>
                                          <p className="text-sm text-muted-foreground">
                                              {employee?.name} • {department?.name} Department
                                          </p>
                                          <p className="text-xs text-muted-foreground mt-0.5">
                                              HoD: {departmentHoD?.name || 'Not assigned'}
                                          </p>
                                      </div>
                                      <div className="text-right">
                                          <div className="text-xl font-bold">${expense.amount.toFixed(2)}</div>
                                          <Badge className="bg-amber-100 text-amber-700 border-amber-200 mb-1">ON HOLD</Badge>
                                      </div>
                                  </div>
                                  
                                  {expense.financeComment && (
                                      <div className="bg-amber-50/50 p-3 rounded-md text-sm border-l-2 border-amber-400">
                                          <span className="font-medium text-xs uppercase tracking-wide text-amber-700 block mb-1">Finance Note</span>
                                          "{expense.financeComment}"
                                      </div>
                                  )}
                              </div>

                              <div className="bg-muted/30 p-6 flex flex-col justify-center gap-2 border-l min-w-[220px]">
                                  <Button 
                                      className="w-full bg-emerald-600 hover:bg-emerald-700" 
                                      onClick={() => { setSelectedExpenseId(expense.id); setActionType('paid'); setIsItemActionDialogOpen(true); }}
                                  >
                                      <Check className="w-4 h-4 mr-2" /> Paid
                                  </Button>
                                  <Button 
                                      variant="outline" className="w-full" 
                                      onClick={() => { setSelectedExpenseId(expense.id); setActionType('needs_revision'); setIsItemActionDialogOpen(true); }}
                                  >
                                      <Send className="w-4 h-4 mr-2" /> Send Back
                                  </Button>
                              </div>
                          </Card>
                      );
                  })
              )}
          </div>
      </div>
      
      <Dialog open={isItemActionDialogOpen} onOpenChange={setIsItemActionDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>
                    {actionType === 'paid' ? 'Process Payment' : actionType === 'on_hold' ? 'Put On Hold' : 'Send Back'}
                </DialogTitle>
                <DialogDescription>
                    Provide necessary details to complete this action.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                {actionType === "paid" && (
                <>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Payment Mode</label>
                    <Select onValueChange={setPaymentMode}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select Method" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Bank transfer">Bank transfer</SelectItem>
                            <SelectItem value="Cheque">Cheque</SelectItem>
                            <SelectItem value="Payroll Reimbursement">Payroll Reimbursement</SelectItem>
                            <SelectItem value="Cash">Cash</SelectItem>
                            <SelectItem value="UPI">UPI</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Payment Date</label>
                        <Input type="date" value={paymentDateInput} onChange={e => setPaymentDateInput(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Reference Number</label>
                        <Input placeholder="e.g. TRX-12345" value={paymentRef} onChange={e => setPaymentRef(e.target.value)} />
                    </div>
                </div>
                </>
                )}
                <div className="space-y-2">
                    <label className="text-sm font-medium">Remarks / Comments</label>
                    <Textarea 
                        placeholder={actionType === 'paid' ? "Transaction ID or notes..." : "Reason for this action..."} 
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                    />
                </div>
            </div>
            <DialogFooter>
                <Button 
                    variant={actionType === 'paid' ? 'default' : 'secondary'}
                    onClick={handleProcess}
                >
                    Confirm Action
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExpenseDetailsDialog 
          expense={selectedExpense} 
          open={!!selectedExpense} 
          onOpenChange={(open) => !open && setSelectedExpense(null)} 
      />
    </div>
  );
}
