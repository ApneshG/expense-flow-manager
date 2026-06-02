import { useApp } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/status-badge";
import { format, isWithinInterval, parseISO, differenceInDays } from "date-fns";
import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Search, CalendarIcon, Download, ArrowUpDown, Paperclip, AlertCircle, Zap } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ExpenseDetailsDialog } from "@/components/expense-details-dialog";
import { ExpenseRequest } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function ApprovalsPage() {
  const { currentUser, expenses, departments, updateExpenseStatus, users, getDepartmentBudget } = useApp();
  const { toast } = useToast();
  const [comment, setComment] = useState("");
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | "on_hold" | "send_back" | null>(null);
  const [selectedExpenses, setSelectedExpenses] = useState<string[]>([]);
  const [isBulkActionDialogOpen, setIsBulkActionDialogOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<"approve" | "reject" | "on_hold" | "send_back" | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseRequest | null>(null);

  // New Filters & Sort
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [sortBy, setSortBy] = useState<string>("date-desc");

  const pendingRequests = expenses.filter(
    (e) => e.hodId === currentUser?.id && e.status === "pending_hod"
  );
  
  const onHoldRequests = expenses.filter(
    (e) => e.hodId === currentUser?.id && e.status === "on_hold"
  );
  
  const budget = currentUser?.departmentId ? getDepartmentBudget(currentUser.departmentId) : { allocated: 0, spent: 0, remaining: 0 };
  const budgetPercent = budget.allocated > 0 ? (budget.spent / budget.allocated) * 100 : 0;

  // Apply filters and sorting
  const filteredAndSortedPending = useMemo(() => {
    let result = [...pendingRequests];

    // Filter by Search Term
    if (searchTerm) {
        const lowerSearch = searchTerm.toLowerCase();
        result = result.filter(e => 
            e.description.toLowerCase().includes(lowerSearch) ||
            e.category.toLowerCase().includes(lowerSearch)
        );
    }

    // Filter by Date Range
    if (dateRange?.from) {
        result = result.filter(e => {
            const billDate = parseISO(e.billDate);
            const fromDate = dateRange.from as Date;
            const toDate = (dateRange.to || dateRange.from) as Date;
            return isWithinInterval(billDate, { start: fromDate, end: toDate });
        });
    }

    // Sort
    result.sort((a, b) => {
        if (sortBy === "date-desc") {
            return new Date(b.billDate).getTime() - new Date(a.billDate).getTime();
        } else if (sortBy === "date-asc") {
            return new Date(a.billDate).getTime() - new Date(b.billDate).getTime();
        } else if (sortBy === "amount-desc") {
            return b.amount - a.amount;
        } else if (sortBy === "amount-asc") {
            return a.amount - b.amount;
        }
        return 0;
    });

    return result;
  }, [pendingRequests, searchTerm, dateRange, sortBy]);

  const filteredAndSortedOnHold = useMemo(() => {
    let result = [...onHoldRequests];

    // Filter by Search Term
    if (searchTerm) {
        const lowerSearch = searchTerm.toLowerCase();
        result = result.filter(e => 
            e.description.toLowerCase().includes(lowerSearch) ||
            e.category.toLowerCase().includes(lowerSearch)
        );
    }

    // Filter by Date Range
    if (dateRange?.from) {
        result = result.filter(e => {
            const billDate = parseISO(e.billDate);
            const fromDate = dateRange.from as Date;
            const toDate = (dateRange.to || dateRange.from) as Date;
            return isWithinInterval(billDate, { start: fromDate, end: toDate });
        });
    }

    // Sort
    result.sort((a, b) => {
        if (sortBy === "date-desc") {
            return new Date(b.billDate).getTime() - new Date(a.billDate).getTime();
        } else if (sortBy === "date-asc") {
            return new Date(a.billDate).getTime() - new Date(b.billDate).getTime();
        } else if (sortBy === "amount-desc") {
            return b.amount - a.amount;
        } else if (sortBy === "amount-asc") {
            return a.amount - b.amount;
        }
        return 0;
    });

    return result;
  }, [onHoldRequests, searchTerm, dateRange, sortBy]);

  const handleAction = () => {
    if (!selectedExpenseId || !actionType) return;

    let newStatus: string = "";
    let actionDesc = "";

    switch (actionType) {
        case "approve":
            newStatus = "pending_finance";
            actionDesc = "forwarded to Finance";
            break;
        case "reject":
            newStatus = "rejected_hod";
            actionDesc = "rejected";
            break;
        case "on_hold":
            newStatus = "on_hold";
            actionDesc = "put on hold";
            break;
        case "send_back":
            newStatus = "needs_revision";
            actionDesc = "sent back for revision";
            break;
    }

    updateExpenseStatus(selectedExpenseId, {
      status: newStatus as any,
      hodComment: comment,
      hodActionDate: new Date().toISOString(),
    });

    toast({
      title: actionType.charAt(0).toUpperCase() + actionType.slice(1).replace("_", " "),
      description: `Expense request has been ${actionDesc}.`,
    });

    setComment("");
    setSelectedExpenseId(null);
    setActionType(null);
  };

  const toggleSelectExpense = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedExpenses(prev => 
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedExpenses.length === filteredAndSortedPending.length && filteredAndSortedPending.length > 0) {
      setSelectedExpenses([]);
    } else {
      setSelectedExpenses(filteredAndSortedPending.map(e => e.id));
    }
  };

  const handleBulkAction = () => {
    if (!bulkActionType) return;

    selectedExpenses.forEach(id => {
      let targetStatus = "";
      switch (bulkActionType) {
        case "approve":
          targetStatus = "pending_finance";
          break;
        case "reject":
          targetStatus = "rejected_hod";
          break;
        case "on_hold":
          targetStatus = "on_hold";
          break;
        case "send_back":
          targetStatus = "needs_revision";
          break;
        default:
          targetStatus = "pending_hod";
      }

      updateExpenseStatus(id, {
        status: targetStatus as any,
        hodComment: comment || `Bulk ${bulkActionType.replace("_", " ")}`,
        hodActionDate: new Date().toISOString(),
      });
    });

    toast({
      title: "Bulk Action Complete",
      description: `${selectedExpenses.length} requests have been processed.`,
    });

    setComment("");
    setSelectedExpenses([]);
    setIsBulkActionDialogOpen(false);
    setBulkActionType(null);
  };

  const exportToCSV = () => {
    const headers = ["Employee", "Category", "Description", "Date", "Amount", "Status"];
    const allRelevant = [...filteredAndSortedPending, ...filteredAndSortedOnHold];
    const rows = allRelevant.map(e => {
        const employee = users.find(u => u.id === e.employeeId);
        return [
            employee?.name || "Unknown",
            e.category,
            e.description,
            e.billDate,
            e.amount,
            e.status
        ];
    });
    
    const csvContent = "data:text/csv;charset=utf-8," 
        + headers.join(",") + "\n" 
        + rows.map(r => r.join(",")).join("\n");
        
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "pending_approvals_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!currentUser || currentUser.role !== "hod") {
      return <div className="p-8 text-center text-muted-foreground">Access denied. HoD role required.</div>;
  }

  return (
      <div className="space-y-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-display font-bold">Pending Approvals</h1>
              <p className="text-muted-foreground mt-1">Review and manage expense requests from your department.</p>
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-1 border-l-4 border-l-primary">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Annual Budget</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">${budget.allocated.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground mt-1">Fiscal Year 2024</p>
                </CardContent>
            </Card>
            <Card className="md:col-span-1 border-l-4 border-l-success">
                 <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Available Budget</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-success">${budget.remaining.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground mt-1">Ready for allocation</p>
                </CardContent>
            </Card>
            <Card className="md:col-span-1 border-l-4 border-l-orange-400">
                 <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Budget Utilized</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{budgetPercent.toFixed(1)}%</div>
                    <Progress value={budgetPercent} className="h-2 mt-3" />
                </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader className="pb-4">
                <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center flex-wrap gap-4">
                                <div className="flex items-center gap-2">
                                    <CardTitle className="text-xl">Pending Requests</CardTitle>
                                    <Badge variant="secondary" className="rounded-full">{filteredAndSortedPending.length}</Badge>
                                </div>

                        {selectedExpenses.length > 0 && (
                            <div className="flex gap-2">
                                <Dialog open={isBulkActionDialogOpen} onOpenChange={setIsBulkActionDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button 
                                            size="sm"
                                            className="bg-emerald-600 hover:bg-emerald-700 h-8" 
                                            onClick={() => { setBulkActionType("approve"); }}
                                        >
                                            <Check className="w-4 h-4 mr-1" /> Approve ({selectedExpenses.length})
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Bulk Approve Expenses</DialogTitle>
                                            <DialogDescription>
                                            Approve {selectedExpenses.length} selected requests at once.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-2 py-4">
                                            <label className="text-sm font-medium">Remarks / Comments</label>
                                            <Textarea 
                                            placeholder="Optional comment for all..." 
                                            value={comment}
                                            onChange={(e) => setComment(e.target.value)}
                                            />
                                        </div>
                                        <DialogFooter>
                                            <Button onClick={handleBulkAction}>Confirm Approval</Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>

                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button 
                                            size="sm"
                                            variant="destructive" 
                                            className="h-8"
                                            onClick={() => { setBulkActionType("reject"); setIsBulkActionDialogOpen(true); }} 
                                        >
                                            <X className="w-4 h-4 mr-1" /> Reject ({selectedExpenses.length})
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Bulk Reject Expenses</DialogTitle>
                                            <DialogDescription>
                                            Reject {selectedExpenses.length} selected requests.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-2 py-4">
                                            <label className="text-sm font-medium">Reason for Rejection</label>
                                            <Textarea 
                                            placeholder="Reason for rejection..." 
                                            value={comment}
                                            onChange={(e) => setComment(e.target.value)}
                                            />
                                        </div>
                                        <DialogFooter>
                                            <Button variant="destructive" onClick={handleBulkAction}>Confirm Rejection</Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                                
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button 
                                            size="sm"
                                            variant="outline" 
                                            className="h-8 border-amber-200 text-amber-600 hover:bg-amber-50"
                                            onClick={() => { setBulkActionType("on_hold"); setIsBulkActionDialogOpen(true); }} 
                                        >
                                            Hold ({selectedExpenses.length})
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Bulk Hold Expenses</DialogTitle>
                                            <DialogDescription>
                                            Put {selectedExpenses.length} selected requests on hold.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-2 py-4">
                                            <label className="text-sm font-medium">Reason for Hold</label>
                                            <Textarea 
                                            placeholder="Reason for hold..." 
                                            value={comment}
                                            onChange={(e) => setComment(e.target.value)}
                                            />
                                        </div>
                                        <DialogFooter>
                                            <Button variant="outline" className="text-amber-600 border-amber-200 hover:bg-amber-50" onClick={handleBulkAction}>Confirm Hold</Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>

                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button 
                                            size="sm"
                                            variant="outline" 
                                            className="h-8 border-blue-200 text-blue-600 hover:bg-blue-50"
                                            onClick={() => { setBulkActionType("send_back"); setIsBulkActionDialogOpen(true); }} 
                                        >
                                            Send Back ({selectedExpenses.length})
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Bulk Send Back Expenses</DialogTitle>
                                            <DialogDescription>
                                            Send {selectedExpenses.length} selected requests back for revision.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-2 py-4">
                                            <label className="text-sm font-medium">Revision Instructions</label>
                                            <Textarea 
                                            placeholder="Instructions..." 
                                            value={comment}
                                            onChange={(e) => setComment(e.target.value)}
                                            />
                                        </div>
                                        <DialogFooter>
                                            <Button variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50" onClick={handleBulkAction}>Confirm Send Back</Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        )}
                    </div>

                    {/* Filter Controls */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 bg-muted/20 p-2 rounded-lg border border-dashed">
                        <div className="flex flex-wrap items-center gap-2 flex-1">
                            <div className="relative w-full md:w-44">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                    placeholder="Search..."
                                    className="pl-7 bg-background h-8 text-sm"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            
                            <Select value={sortBy} onValueChange={setSortBy}>
                                <SelectTrigger className="w-full md:w-[110px] bg-background h-8 text-sm">
                                    <div className="flex items-center gap-1.5">
                                        <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
                                        <span>Sort</span>
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="date-desc">Newest</SelectItem>
                                    <SelectItem value="date-asc">Oldest</SelectItem>
                                    <SelectItem value="amount-desc">Highest</SelectItem>
                                    <SelectItem value="amount-asc">Lowest</SelectItem>
                                </SelectContent>
                            </Select>

                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full md:w-[120px] justify-start text-left font-normal bg-background h-8 px-2 text-sm",
                                            !dateRange && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-1.5 h-3 w-3 flex-shrink-0" />
                                        <span className="truncate">
                                        {dateRange?.from ? (
                                            dateRange.to ? (
                                                <>{format(dateRange.from, "MMM d")} - {format(dateRange.to, "MMM d")}</>
                                            ) : (
                                                format(dateRange.from, "MMM d")
                                            )
                                        ) : (
                                            <span>Date</span>
                                        )}
                                        </span>
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

                        <Button variant="secondary" size="sm" onClick={exportToCSV} className="gap-1.5 h-8 px-3 w-full md:w-auto ml-auto whitespace-nowrap text-sm">
                            <Download className="w-3.5 h-3.5" /> Download
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-muted/40">
                        <TableRow>
                            <TableHead className="w-[50px] text-center">
                                <Checkbox 
                                    checked={selectedExpenses.length === filteredAndSortedPending.length && filteredAndSortedPending.length > 0}
                                    onCheckedChange={toggleSelectAll}
                                />
                            </TableHead>
                            <TableHead>Employee</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead className="text-center">Docs</TableHead>
                            <TableHead>Budget Impact</TableHead>
                            <TableHead className="text-right pr-6">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredAndSortedPending.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-16">
                                    <Check className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                                    <p className="font-medium text-muted-foreground">All caught up!</p>
                                    <p className="text-sm text-muted-foreground/80">No pending expense requests match your criteria.</p>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredAndSortedPending.map((expense) => {
                                const employee = users.find(u => u.id === expense.employeeId);
                                const isSelected = selectedExpenses.includes(expense.id);
                                
                                return (
                                    <TableRow 
                                        key={expense.id} 
                                        className={cn(
                                            "cursor-pointer transition-colors",
                                            isSelected ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/50"
                                        )}
                                        onClick={() => setSelectedExpense(expense)}
                                    >
                                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                            <Checkbox 
                                                checked={isSelected}
                                                onCheckedChange={(checked) => {
                                                    setSelectedExpenses(prev => 
                                                        checked 
                                                            ? [...prev, expense.id] 
                                                            : prev.filter(id => id !== expense.id)
                                                    );
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1.5">
                                                <span className="font-medium leading-none">{employee?.name}</span>
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    {differenceInDays(new Date(), parseISO(expense.createdAt || expense.billDate)) > 3 && (
                                                        <Badge variant="destructive" className="px-1 text-[10px] h-4 font-semibold uppercase tracking-wider">
                                                            <AlertCircle className="w-2.5 h-2.5 mr-0.5" /> Overdue
                                                        </Badge>
                                                    )}
                                                    {expense.amount >= 1000 && (
                                                        <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100 px-1 text-[10px] h-4 font-semibold uppercase tracking-wider border-amber-200">
                                                            <Zap className="w-2.5 h-2.5 mr-0.5 fill-amber-500 text-amber-500" /> Priority
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className="font-normal">{expense.category}</Badge>
                                        </TableCell>
                                        <TableCell>{format(new Date(expense.billDate), "MMM d, yyyy")}</TableCell>
                                        <TableCell className="font-bold">${expense.amount.toFixed(2)}</TableCell>
                                        <TableCell className="text-center">
                                            {expense.attachmentUrl ? (
                                                <Paperclip className="w-4 h-4 text-muted-foreground mx-auto" />
                                            ) : (
                                                <span className="text-muted-foreground text-xs">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {(() => {
                                                const deptBudget = getDepartmentBudget(expense.departmentId);
                                                const balanceAfter = deptBudget.remaining - expense.amount;
                                                return (
                                                    <div className="text-xs space-y-1">
                                                        <div>Avail: <span className="font-semibold">${deptBudget.remaining.toFixed(2)}</span></div>
                                                        <div className={balanceAfter >= 0 ? "text-green-600" : "text-red-600"}>
                                                            After: <span className="font-semibold">${balanceAfter.toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </TableCell>
                                        <TableCell className="text-right pr-4" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex justify-end gap-1">
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button 
                                                        size="sm"
                                                        className="bg-emerald-600 hover:bg-emerald-700 h-8 px-2" 
                                                        title="Approve"
                                                        onClick={() => { setSelectedExpenseId(expense.id); setActionType("approve"); }}
                                                    >
                                                        <Check className="w-4 h-4 mr-1" /> Approve
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent>
                                                    <DialogHeader>
                                                    <DialogTitle>Approve Expense</DialogTitle>
                                                    <DialogDescription>
                                                        Add an optional comment for the finance team.
                                                    </DialogDescription>
                                                    </DialogHeader>
                                                    <div className="space-y-2 py-4">
                                                    <label className="text-sm font-medium">Remarks / Comments</label>
                                                    <Textarea 
                                                        placeholder="e.g. Approved, consistent with project goals." 
                                                        value={comment}
                                                        onChange={(e) => setComment(e.target.value)}
                                                    />
                                                    </div>
                                                    <DialogFooter>
                                                    <Button onClick={handleAction}>Confirm Approval</Button>
                                                    </DialogFooter>
                                                </DialogContent>
                                            </Dialog>

                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button 
                                                        size="sm"
                                                        variant="destructive"
                                                        className="h-8 px-2" 
                                                        title="Reject"
                                                        onClick={() => { setSelectedExpenseId(expense.id); setActionType("reject"); }}
                                                    >
                                                        <X className="w-4 h-4 mr-1" /> Reject
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent>
                                                    <DialogHeader>
                                                    <DialogTitle>Reject Expense</DialogTitle>
                                                    <DialogDescription>
                                                        Please provide a reason for rejecting this request.
                                                    </DialogDescription>
                                                    </DialogHeader>
                                                    <div className="space-y-2 py-4">
                                                    <label className="text-sm font-medium">Reason for Rejection</label>
                                                    <Textarea 
                                                        placeholder="e.g. Missing receipt, outside of policy." 
                                                        value={comment}
                                                        onChange={(e) => setComment(e.target.value)}
                                                    />
                                                    </div>
                                                    <DialogFooter>
                                                    <Button variant="destructive" onClick={handleAction}>Confirm Rejection</Button>
                                                    </DialogFooter>
                                                </DialogContent>
                                            </Dialog>

                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button 
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-8 px-2 border-amber-200 text-amber-600 hover:bg-amber-50" 
                                                        title="Hold"
                                                        onClick={() => { setSelectedExpenseId(expense.id); setActionType("on_hold"); }}
                                                    >
                                                        Hold
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent>
                                                    <DialogHeader>
                                                    <DialogTitle>Put on Hold</DialogTitle>
                                                    <DialogDescription>
                                                        Move this request to the On Hold section for further clarification.
                                                    </DialogDescription>
                                                    </DialogHeader>
                                                    <div className="space-y-2 py-4">
                                                    <label className="text-sm font-medium">Reason for Hold</label>
                                                    <Textarea 
                                                        placeholder="e.g. Need more information before processing." 
                                                        value={comment}
                                                        onChange={(e) => setComment(e.target.value)}
                                                    />
                                                    </div>
                                                    <DialogFooter>
                                                    <Button variant="outline" className="text-amber-600 border-amber-200 hover:bg-amber-50" onClick={handleAction}>Confirm Hold</Button>
                                                    </DialogFooter>
                                                </DialogContent>
                                            </Dialog>

                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button 
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-8 px-2 border-blue-200 text-blue-600 hover:bg-blue-50" 
                                                        title="Send Back"
                                                        onClick={() => { setSelectedExpenseId(expense.id); setActionType("send_back"); }}
                                                    >
                                                        Send Back
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent>
                                                    <DialogHeader>
                                                    <DialogTitle>Send Back for Revision</DialogTitle>
                                                    <DialogDescription>
                                                        Ask the employee to revise and resubmit this request.
                                                    </DialogDescription>
                                                    </DialogHeader>
                                                    <div className="space-y-2 py-4">
                                                    <label className="text-sm font-medium">Revision Instructions</label>
                                                    <Textarea 
                                                        placeholder="e.g. Please update the category and re-upload the receipt." 
                                                        value={comment}
                                                        onChange={(e) => setComment(e.target.value)}
                                                    />
                                                    </div>
                                                    <DialogFooter>
                                                    <Button variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50" onClick={handleAction}>Confirm Send Back</Button>
                                                    </DialogFooter>
                                                </DialogContent>
                                            </Dialog>
                                        </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </CardContent>
          </Card>

          {/* On Hold Table */}
          <Card>
            <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                    <CardTitle className="text-xl">On Hold Requests</CardTitle>
                    <Badge variant="secondary" className="rounded-full bg-amber-100 text-amber-700">{filteredAndSortedOnHold.length}</Badge>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-muted/40">
                        <TableRow>
                            <TableHead className="pl-6">Employee</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead className="text-center">Docs</TableHead>
                            <TableHead>Budget Impact</TableHead>
                            <TableHead className="text-right pr-6">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredAndSortedOnHold.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                                    No requests on hold.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredAndSortedOnHold.map((expense) => {
                                const employee = users.find(u => u.id === expense.employeeId);
                                
                                return (
                                    <TableRow 
                                        key={expense.id} 
                                        className="cursor-pointer transition-colors hover:bg-muted/50"
                                        onClick={() => setSelectedExpense(expense)}
                                    >
                                        <TableCell className="font-medium pl-6">{employee?.name}</TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className="font-normal">{expense.category}</Badge>
                                        </TableCell>
                                        <TableCell>{format(new Date(expense.billDate), "MMM d, yyyy")}</TableCell>
                                        <TableCell className="font-bold">${expense.amount.toFixed(2)}</TableCell>
                                        <TableCell className="text-center">
                                            {expense.attachmentUrl ? (
                                                <Paperclip className="w-4 h-4 text-muted-foreground mx-auto" />
                                            ) : (
                                                <span className="text-muted-foreground text-xs">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {(() => {
                                                const deptBudget = getDepartmentBudget(expense.departmentId);
                                                const balanceAfter = deptBudget.remaining - expense.amount;
                                                return (
                                                    <div className="text-xs space-y-1">
                                                        <div>Avail: <span className="font-semibold">${deptBudget.remaining.toFixed(2)}</span></div>
                                                        <div className={balanceAfter >= 0 ? "text-green-600" : "text-red-600"}>
                                                            After: <span className="font-semibold">${balanceAfter.toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </TableCell>
                                        <TableCell className="text-right pr-4" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex justify-end gap-1">
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button 
                                                        size="sm"
                                                        className="bg-emerald-600 hover:bg-emerald-700 h-8 px-2" 
                                                        onClick={() => { setSelectedExpenseId(expense.id); setActionType("approve"); }}
                                                    >
                                                        <Check className="w-4 h-4 mr-1" /> Approve
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent>
                                                    <DialogHeader>
                                                    <DialogTitle>Approve Expense</DialogTitle>
                                                    </DialogHeader>
                                                    <div className="space-y-2 py-4">
                                                    <label className="text-sm font-medium">Remarks / Comments</label>
                                                    <Textarea 
                                                        placeholder="Optional comments..." 
                                                        value={comment}
                                                        onChange={(e) => setComment(e.target.value)}
                                                    />
                                                    </div>
                                                    <DialogFooter>
                                                    <Button onClick={handleAction}>Confirm Approval</Button>
                                                    </DialogFooter>
                                                </DialogContent>
                                            </Dialog>

                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button 
                                                        size="sm"
                                                        variant="destructive"
                                                        className="h-8 px-2" 
                                                        onClick={() => { setSelectedExpenseId(expense.id); setActionType("reject"); }}
                                                    >
                                                        <X className="w-4 h-4 mr-1" /> Reject
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent>
                                                    <DialogHeader>
                                                    <DialogTitle>Reject Expense</DialogTitle>
                                                    </DialogHeader>
                                                    <div className="space-y-2 py-4">
                                                    <label className="text-sm font-medium">Reason for Rejection</label>
                                                    <Textarea 
                                                        placeholder="Reason..." 
                                                        value={comment}
                                                        onChange={(e) => setComment(e.target.value)}
                                                    />
                                                    </div>
                                                    <DialogFooter>
                                                    <Button variant="destructive" onClick={handleAction}>Confirm Rejection</Button>
                                                    </DialogFooter>
                                                </DialogContent>
                                            </Dialog>

                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button 
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-8 px-2 border-blue-200 text-blue-600 hover:bg-blue-50" 
                                                        onClick={() => { setSelectedExpenseId(expense.id); setActionType("send_back"); }}
                                                    >
                                                        Send Back
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent>
                                                    <DialogHeader>
                                                    <DialogTitle>Send Back for Revision</DialogTitle>
                                                    </DialogHeader>
                                                    <div className="space-y-2 py-4">
                                                    <label className="text-sm font-medium">Revision Instructions</label>
                                                    <Textarea 
                                                        placeholder="Instructions..." 
                                                        value={comment}
                                                        onChange={(e) => setComment(e.target.value)}
                                                    />
                                                    </div>
                                                    <DialogFooter>
                                                    <Button variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50" onClick={handleAction}>Confirm Send Back</Button>
                                                    </DialogFooter>
                                                </DialogContent>
                                            </Dialog>
                                        </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </CardContent>
          </Card>

          <ExpenseDetailsDialog 
              expense={selectedExpense} 
              open={!!selectedExpense} 
              onOpenChange={(open) => !open && setSelectedExpense(null)} 
          />
      </div>
  );
}
