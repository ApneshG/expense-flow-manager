import { ExpenseRequest, useApp } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area, PieChart, Pie, LabelList } from "recharts";
import { format, isWithinInterval, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, differenceInDays } from "date-fns";
import { CreditCard, CalendarIcon, Clock, Search, Download, Filter, Banknote, XCircle, CheckCircle2, Activity, Users, Wallet, AlertCircle, Trash2 } from "lucide-react";
import { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExpenseDetailsDialog } from "@/components/expense-details-dialog";
import { EditExpenseDialog } from "@/components/edit-expense-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { Link } from "wouter";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function Dashboard() {
  const { currentUser, departments, expenses, getDepartmentBudget, users, deleteExpense } = useApp();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeCard, setActiveCard] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedExpense, setSelectedExpense] = useState<ExpenseRequest | null>(null);
  const [expenseToEdit, setExpenseToEdit] = useState<ExpenseRequest | null>(null);

  if (!currentUser) return null;

  // Filter expenses by date range, employee, and status (for general use)
  const filteredExpenses = expenses.filter(e => {
    let matchesDate = true;
    if (dateRange?.from) {
      const billDate = parseISO(e.billDate);
      const toDate = dateRange.to || dateRange.from;
      matchesDate = isWithinInterval(billDate, { start: dateRange.from, end: toDate });
    }
    
    let matchesEmployee = true;
    if (selectedEmployeeId !== "all") {
        matchesEmployee = e.employeeId === selectedEmployeeId;
    }

    let matchesStatus = true;
    if (statusFilter !== "all") {
        matchesStatus = e.status === statusFilter;
    }

    return matchesDate && matchesEmployee && matchesStatus;
  });

  // 1. Employee Dashboard
  if (currentUser.role === "employee") {
    const myExpenses = expenses.filter(e => e.employeeId === currentUser.id);

    // Aggregates for employee based on date filter
    const baseExpensesForAggregates = myExpenses.filter(e => {
        let matchesDate = true;
        if (dateRange?.from) {
          const billDate = parseISO(e.billDate);
          const toDate = dateRange.to || dateRange.from;
          matchesDate = isWithinInterval(billDate, { start: dateRange.from, end: toDate });
        }
        return matchesDate;
    });

    const pendingAmount = baseExpensesForAggregates
      .filter(e => e.status === 'pending_hod' || e.status === 'pending_finance')
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      
    const approvedNotPaidAmount = baseExpensesForAggregates
      .filter(e => e.status === 'on_hold' || e.status === 'needs_revision')
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const paidAmount = baseExpensesForAggregates
      .filter(e => e.status === 'paid')
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const rejectedAmount = baseExpensesForAggregates
      .filter(e => e.status === 'rejected_hod' || e.status === 'rejected_finance')
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    // Apply filters for the table
    const needsRevisionExpenses = myExpenses.filter(e => e.status === 'needs_revision');

    const tableExpenses = myExpenses
      .filter(e => e.status !== 'needs_revision')
      .filter(e => {
        let matchesDate = true;
        if (dateRange?.from) {
          const billDate = parseISO(e.billDate);
          const toDate = dateRange.to || dateRange.from;
          matchesDate = isWithinInterval(billDate, { start: dateRange.from, end: toDate });
        }
        
        let matchesStatus = true;
        if (statusFilter !== "all") {
            matchesStatus = e.status === statusFilter;
        } else if (activeCard) {
            if (activeCard === 'pending') {
                matchesStatus = e.status === 'pending_hod' || e.status === 'pending_finance';
            } else if (activeCard === 'approved') {
                matchesStatus = e.status === 'on_hold' || e.status === 'needs_revision';
            } else if (activeCard === 'paid') {
                matchesStatus = e.status === 'paid';
            } else if (activeCard === 'rejected') {
                matchesStatus = e.status === 'rejected_hod' || e.status === 'rejected_finance';
            }
        }

        let matchesSearch = true;
        if (searchTerm) {
          matchesSearch = e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          e.category.toLowerCase().includes(searchTerm.toLowerCase());
        }

        return matchesDate && matchesStatus && matchesSearch;
      });

    const exportToCSV = () => {
      const headers = ["Category", "Description", "Date", "Amount", "Status"];
      const rows = tableExpenses.map(e => [
        e.category,
        e.description,
        e.billDate,
        e.amount,
        e.status
      ]);
      
      const csvContent = "data:text/csv;charset=utf-8," 
          + headers.join(",") + "\n" 
          + rows.map(r => r.join(",")).join("\n");
          
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "my_expenses_report.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    const handleCardClick = (cardType: string) => {
        if (activeCard === cardType) {
            setActiveCard(null);
        } else {
            setActiveCard(cardType);
            setStatusFilter("all"); 
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-display font-bold">Dashboard</h1>
                    <p className="text-muted-foreground mt-1">Hello {currentUser.name.split(" ")[0]}, Welcome to Expense Management App</p>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card 
                    className={cn(
                        "shadow-sm border-blue-100 bg-blue-50/30 cursor-pointer transition-all hover:scale-[1.02]",
                        activeCard === 'pending' && "ring-2 ring-blue-500 bg-blue-100/50"
                    )}
                    onClick={() => handleCardClick('pending')}
                >
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-blue-600">Pending Request</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${pendingAmount.toLocaleString()}</div>
                    </CardContent>
                </Card>
                
                <Card 
                    className={cn(
                        "shadow-sm border-amber-100 bg-amber-50/30 cursor-pointer transition-all hover:scale-[1.02]",
                        activeCard === 'approved' && "ring-2 ring-amber-500 bg-amber-100/50"
                    )}
                    onClick={() => handleCardClick('approved')}
                >
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-amber-600">Approved but not paid</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${approvedNotPaidAmount.toLocaleString()}</div>
                    </CardContent>
                </Card>

                <Card 
                    className={cn(
                        "shadow-sm border-emerald-100 bg-emerald-50/30 cursor-pointer transition-all hover:scale-[1.02]",
                        activeCard === 'paid' && "ring-2 ring-emerald-500 bg-emerald-100/50"
                    )}
                    onClick={() => handleCardClick('paid')}
                >
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-emerald-600">Paid</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${paidAmount.toLocaleString()}</div>
                    </CardContent>
                </Card>

                <Card 
                    className={cn(
                        "shadow-sm border-red-100 bg-red-50/30 cursor-pointer transition-all hover:scale-[1.02]",
                        activeCard === 'rejected' && "ring-2 ring-red-500 bg-red-100/50"
                    )}
                    onClick={() => handleCardClick('rejected')}
                >
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-red-600">Rejected</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${rejectedAmount.toLocaleString()}</div>
                    </CardContent>
                </Card>
            </div>
            {needsRevisionExpenses.length > 0 && (
                <Card className="border-purple-200 shadow-md">
                    <CardHeader className="pb-3 bg-purple-50/50 border-b border-purple-100">
                        <CardTitle className="text-xl text-purple-800 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5" /> 
                            Needs Revision
                        </CardTitle>
                        <CardDescription className="text-purple-600/80">
                            These requests have been sent back. Please edit and resubmit them.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow>
                                    <TableHead className="pl-6">Category</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Bill Date</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Feedback</TableHead>
                                    <TableHead className="text-right pr-6">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {needsRevisionExpenses.map(expense => (
                                    <TableRow key={expense.id}>
                                        <TableCell className="font-medium pl-6">{expense.category}</TableCell>
                                        <TableCell className="max-w-[200px] truncate">{expense.description}</TableCell>
                                        <TableCell>{format(new Date(expense.billDate), "MMM d, yyyy")}</TableCell>
                                        <TableCell>${(Number(expense.amount) || 0).toFixed(2)}</TableCell>
                                        <TableCell className="text-sm text-destructive max-w-[200px] truncate">
                                            {expense.hodComment || expense.financeComment || "Please revise."}
                                        </TableCell>
                                        <TableCell className="text-right pr-4">
                                            <div className="flex justify-end gap-2">
                                                <Button 
                                                    size="sm" 
                                                    variant="outline"
                                                    className="border-purple-200 text-purple-700 hover:bg-purple-50"
                                                    onClick={() => setExpenseToEdit(expense)}
                                                >
                                                    Edit & Resubmit
                                                </Button>
                                                <Button 
                                                    size="sm" 
                                                    variant="destructive"
                                                    onClick={() => {
                                                        if (confirm("Are you sure you want to delete this expense?")) {
                                                            deleteExpense(expense.id);
                                                        }
                                                    }}
                                                >
                                                    <Trash2 className="w-3 h-3 mr-1" /> Delete
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
            <Card>
                <CardHeader className="pb-4">
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-2">
                            <CardTitle className="text-xl">My Expenses</CardTitle>
                            <span className="text-sm text-muted-foreground">- View and manage your expense history</span>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="relative w-full md:w-64">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search description or category..."
                                    className="pl-8"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            
                            <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setActiveCard(null); }}>
                                <SelectTrigger className="w-full md:w-[150px]">
                                    <SelectValue placeholder="Stage" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Stages</SelectItem>
                                    <SelectItem value="draft">Draft</SelectItem>
                                    <SelectItem value="pending_hod">Pending HoD</SelectItem>
                                    <SelectItem value="pending_finance">Pending Finance</SelectItem>
                                    <SelectItem value="paid">Paid</SelectItem>
                                    <SelectItem value="rejected_hod">Rejected (HoD)</SelectItem>
                                    <SelectItem value="rejected_finance">Rejected (Finance)</SelectItem>
                                </SelectContent>
                            </Select>

                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full md:w-[200px] justify-start text-left font-normal",
                                            !dateRange && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {dateRange?.from ? (
                                            dateRange.to ? (
                                                <>{format(dateRange.from, "LLL dd")} - {format(dateRange.to, "LLL dd")}</>
                                            ) : (
                                                format(dateRange.from, "LLL dd")
                                            )
                                        ) : (
                                            <span>Bill Date</span>
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

                            <Button variant="outline" size="sm" onClick={exportToCSV} className="gap-2 w-full md:w-auto">
                                <Download className="w-4 h-4" /> Download Report
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Category</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Bill 
                                Date</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {tableExpenses.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        No expenses found matching your filter.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                tableExpenses.map((expense) => (
                                    <TableRow key={expense.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setSelectedExpense(expense)}>
                                        <TableCell className="font-medium">{expense.category}</TableCell>
                                        <TableCell className="max-w-[200px] truncate">{expense.description}</TableCell>
                                        <TableCell>{format(new Date(expense.billDate), "MMM d, yyyy")}</TableCell>
                                        <TableCell>${(Number(expense.amount) || 0).toFixed(2)}</TableCell>
                                        <TableCell>
                                            <StatusBadge status={expense.status} />
                                        </TableCell>
                                    </TableRow>
                                ))
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
            <EditExpenseDialog 
                expense={expenseToEdit} 
                open={!!expenseToEdit} 
                onOpenChange={(open) => !open && setExpenseToEdit(null)} 
            />
        </div>
    );
  }

  // 2. HoD Dashboard
  if (currentUser.role === "hod") {
    const dept = departments.find(d => d.id === currentUser.departmentId);
    const budget = getDepartmentBudget(currentUser.departmentId);

    // Budget category buckets — same definition used by backend's spent calc.
    const PAID_STATUSES = ["paid"];
    const COMMITTED_UNPAID_STATUSES = ["pending_hod", "needs_revision", "pending_finance", "on_hold"];

    // Full dept dataset (don't apply top-bar filters to KPI cards).
    const deptAllExpenses = expenses.filter(e => e.departmentId === currentUser.departmentId);
    const paidTotal = deptAllExpenses
        .filter(e => PAID_STATUSES.includes(e.status))
        .reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const committedUnpaidTotal = deptAllExpenses
        .filter(e => COMMITTED_UNPAID_STATUSES.includes(e.status))
        .reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const pct = (v: number) => budget.allocated > 0 ? ((v / budget.allocated) * 100).toFixed(1) : "0";

    // Action Required counters (HoD's own queue).
    const pendingApprovalCount = expenses.filter(e => e.hodId === currentUser.id && e.status === "pending_hod").length;
    const onHoldCount = deptAllExpenses.filter(e => e.status === "on_hold").length;
    const needsRevisionCount = deptAllExpenses.filter(e => e.status === "needs_revision").length;
    const actionTotal = pendingApprovalCount + onHoldCount + needsRevisionCount;

    // Top 5 spenders (paid + committed unpaid), respecting top-bar filters.
    const filteredDeptExpenses = filteredExpenses
        .filter(e => e.departmentId === currentUser.departmentId
            && [...PAID_STATUSES, ...COMMITTED_UNPAID_STATUSES].includes(e.status));
    const spendByEmp = filteredDeptExpenses.reduce((acc, e) => {
        const cur = acc.get(e.employeeId) || { paid: 0, committed: 0 };
        if (e.status === "paid") cur.paid += Number(e.amount) || 0;
        else cur.committed += Number(e.amount) || 0;
        acc.set(e.employeeId, cur);
        return acc;
    }, new Map<string, { paid: number; committed: number }>());
    const topSpenders = Array.from(spendByEmp.entries())
        .map(([id, v]) => ({
            name: (users.find(u => u.id === id)?.name || id).split(" ")[0],
            total: v.paid + v.committed,
            paid: v.paid,
            committed: v.committed,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

    // Category breakdown with $ values (excludes rejected/draft, respects filters).
    const categoryData = filteredExpenses
        .filter(e => e.departmentId === currentUser.departmentId
            && [...PAID_STATUSES, ...COMMITTED_UNPAID_STATUSES].includes(e.status))
        .reduce((acc, curr) => {
            const existing = acc.find(item => item.name === curr.category);
            if (existing) existing.value += Number(curr.amount) || 0;
            else acc.push({ name: curr.category, value: Number(curr.amount) || 0 });
            return acc;
        }, [] as { name: string; value: number }[])
        .sort((a, b) => b.value - a.value);

    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
            <div>
                <h1 className="text-3xl font-display font-bold">Hello {currentUser.name.split(" ")[0]}</h1>
                <p className="text-muted-foreground mt-1">Welcome to Expense Management App</p>
            </div>

            <div className="flex gap-2 flex-wrap md:flex-nowrap">
                <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filter Employee" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Employees</SelectItem>
                        {users.filter(u => u.departmentId === currentUser.departmentId && u.role === 'employee').map(u => (
                            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

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
        </div>

        {/* Row 1: 4 KPI cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Annual Budget</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">${budget.allocated.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground mt-1">Fiscal allocation</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Paid Expenses</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-emerald-600">${paidTotal.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground mt-1">{pct(paidTotal)}% of annual</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Committed Unpaid Expenses</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-amber-600">${committedUnpaidTotal.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground mt-1">{pct(committedUnpaidTotal)}% · in approval queue</p>
                </CardContent>
            </Card>
            <Card className={cn(
                budget.allocated > 0 && (budget.spent / budget.allocated) * 100 >= 90 ? "border-destructive/50 bg-destructive/5" :
                budget.allocated > 0 && (budget.spent / budget.allocated) * 100 >= 80 ? "border-amber-500/50 bg-amber-500/5" : ""
            )}>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                        Available Budget
                        {budget.allocated > 0 && (budget.spent / budget.allocated) * 100 >= 90 && <AlertCircle className="w-4 h-4 text-destructive" />}
                        {budget.allocated > 0 && (budget.spent / budget.allocated) * 100 >= 80 && (budget.spent / budget.allocated) * 100 < 90 && <AlertCircle className="w-4 h-4 text-amber-500" />}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className={cn(
                        "text-2xl font-bold",
                        budget.allocated > 0 && (budget.spent / budget.allocated) * 100 >= 90 ? "text-destructive" :
                        budget.allocated > 0 && (budget.spent / budget.allocated) * 100 >= 80 ? "text-amber-600" : "text-blue-600"
                    )}>${budget.remaining.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground mt-1">{pct(budget.remaining)}% remaining</p>
                </CardContent>
            </Card>
        </div>


        {/* Row 3: Top Spenders + Category Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Top 5 Spenders</CardTitle>
                    <CardDescription>Paid + Committed Unpaid by employee</CardDescription>
                </CardHeader>
                <CardContent>
                    {topSpenders.length === 0 ? (
                        <div className="text-sm text-muted-foreground py-8 text-center">No spending data for the selected filters.</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={Math.max(160, topSpenders.length * 48)}>
                            <BarChart data={topSpenders} layout="vertical" margin={{ top: 8, right: 80, left: 8, bottom: 8 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                <XAxis type="number" axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} tick={{ fontSize: 11, fill: "#64748b" }} />
                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={80} tick={{ fontSize: 12, fill: "#0f172a" }} />
                                <Tooltip
                                    cursor={{ fill: "transparent" }}
                                    contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                                    formatter={(value: number, name: string) => [`$${Number(value).toLocaleString()}`, name === "paid" ? "Paid" : name === "committed" ? "Committed Unpaid" : "Total"]}
                                />
                                <Bar dataKey="paid" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} barSize={22} />
                                <Bar dataKey="committed" stackId="a" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={22}>
                                    <LabelList dataKey="total" position="right" formatter={(v: number) => `$${Number(v).toLocaleString()}`} className="text-xs fill-slate-700" />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                    {topSpenders.length > 0 && (
                        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Paid</span>
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> Committed Unpaid</span>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Spending by Category</CardTitle>
                    <CardDescription>Paid + Committed Unpaid, sorted by amount</CardDescription>
                </CardHeader>
                <CardContent>
                    {categoryData.length === 0 ? (
                        <div className="text-sm text-muted-foreground py-8 text-center">No spending data for the selected filters.</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={Math.max(160, categoryData.length * 44)}>
                            <BarChart data={categoryData} layout="vertical" margin={{ top: 8, right: 80, left: 8, bottom: 8 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                <XAxis type="number" axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} tick={{ fontSize: 11, fill: "#64748b" }} />
                                <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#0f172a" }} />
                                <Tooltip
                                    cursor={{ fill: "transparent" }}
                                    contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                                    formatter={(value: number) => [`$${Number(value).toLocaleString()}`, "Amount"]}
                                />
                                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20}>
                                    <LabelList dataKey="value" position="right" formatter={(v: number) => `$${Number(v).toLocaleString()}`} className="text-xs fill-slate-700" />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </CardContent>
            </Card>
        </div>
      </div>
    );
  }

  // 3. Finance & Admin Dashboard (CFO View)
  if (currentUser.role === "finance_head") {
    const paidExpenses = expenses.filter(e => {
        if (e.status !== 'paid') return false;
        if (!dateRange?.from) return true;
        const pDate = e.paymentDate ? new Date(e.paymentDate) : null;
        if (!pDate) return false;
        const toDate = dateRange.to || dateRange.from;
        return isWithinInterval(pDate, { start: dateRange.from, end: toDate });
    });
    
    // Monthwise Expenses Paid (Last 6 months)
    const months = eachMonthOfInterval({
        start: subMonths(new Date(), 5),
        end: new Date()
    });

    const monthwiseData = months.map(month => {
        const mStart = startOfMonth(month);
        const mEnd = endOfMonth(month);
        const total = paidExpenses
            .filter(e => {
                const pDate = e.paymentDate ? new Date(e.paymentDate) : null;
                return pDate && isWithinInterval(pDate, { start: mStart, end: mEnd });
            })
            .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        return { name: format(month, "MMM yy"), amount: total };
    });

    // Department wise Expenses Paid
    const deptwiseData = departments.map(d => {
        const total = paidExpenses
            .filter(e => e.departmentId === d.id)
            .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        return { name: d.name, amount: total };
    }).filter(d => d.amount > 0);

    // Category wise Expense spread
    const categoryDataMap = paidExpenses.reduce((acc, curr) => {
        acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
        return acc;
    }, {} as Record<string, number>);
    const categoryData = Object.entries(categoryDataMap).map(([name, value]) => ({ name, value }));

    // Average Durations by Stage
    const stageDurations = paidExpenses.reduce((acc, e) => {
        const created = new Date(e.createdAt);
        const hodApproved = e.hodActionDate ? new Date(e.hodActionDate) : null;
        const financeAction = e.financeActionDate ? new Date(e.financeActionDate) : null;
        const paid = e.paymentDate ? new Date(e.paymentDate) : null;

        if (hodApproved) acc.hod.push(differenceInDays(hodApproved, created));
        if (hodApproved && financeAction) acc.finance.push(differenceInDays(financeAction, hodApproved));
        if (financeAction && paid) acc.payout.push(differenceInDays(paid, financeAction));
        if (paid) acc.total.push(differenceInDays(paid, created));

        return acc;
    }, { hod: [] as number[], finance: [] as number[], payout: [] as number[], total: [] as number[] });

    const getAvg = (arr: number[]) => arr.length > 0 ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : "0";

    const tatData = [
        { stage: "HoD Approval", days: parseFloat(getAvg(stageDurations.hod)), color: "#f59e0b" },
        { stage: "Finance Review", days: parseFloat(getAvg(stageDurations.finance)), color: "#3b82f6" },
        { stage: "Final Payout", days: parseFloat(getAvg(stageDurations.payout)), color: "#10b981" },
        { stage: "Overall Cycle", days: parseFloat(getAvg(stageDurations.total)), color: "#6366f1" }
    ];

    // Budget vs Actual
    const budgetVsActualData = departments.map(d => {
        const budget = Number(getDepartmentBudget(d.id)) || 0;
        const actual = expenses
            .filter(e => e.departmentId === d.id && e.status !== 'draft' && e.status !== 'rejected_hod' && e.status !== 'rejected_finance')
            .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        return {
            name: d.name,
            budget,
            actual,
            variance: budget - actual
        };
    });

    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className="text-3xl font-display font-bold text-slate-900">CFO Dashboard</h1>
                <p className="text-muted-foreground mt-1">Financial overview and processing performance.</p>
            </div>
            <div className="flex items-center gap-3">
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
                                    <>{format(dateRange.from, "LLL dd")} - {format(dateRange.to, "LLL dd")}</>
                                ) : (
                                    format(dateRange.from, "LLL dd")
                                )
                            ) : (
                                <span>Filter by Date</span>
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

                <Card className="px-4 py-2 flex items-center gap-3 border-blue-100 bg-blue-50/50">
                    <Clock className="w-5 h-5 text-blue-600" />
                    <div>
                        <p className="text-[10px] uppercase tracking-wider font-bold text-blue-600/70">Avg. Cycle Time</p>
                        <p className="text-xl font-bold text-blue-900">{getAvg(stageDurations.total)} Days</p>
                    </div>
                </Card>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
                <CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Paid (YTD)</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold">${paidExpenses.reduce((a,b) => a + (Number(b.amount) || 0), 0).toLocaleString()}</div></CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pending Finance</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold text-blue-600">${expenses.filter(e => e.status === 'pending_finance').reduce((a,b) => a + (Number(b.amount) || 0), 0).toLocaleString()}</div></CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Active Departments</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold">{departments.length}</div></CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Employees</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold">{users.filter(u => u.role === 'employee').length}</div></CardContent>
            </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Monthwise Expenses Paid */}
            <Card className="shadow-sm border-slate-200/60">
                <CardHeader>
                    <CardTitle className="text-lg">Monthwise Payouts</CardTitle>
                    <CardDescription>Total amount paid to employees per month</CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={monthwiseData}>
                            <defs>
                                <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} tickFormatter={(value) => `$${value}`} />
                            <Tooltip 
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                formatter={(value: number) => [`$${value.toLocaleString()}`, "Amount Paid"]}
                            />
                            <Area type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorAmount)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Average Duration between request and payment */}
            <Card className="shadow-sm border-slate-200/60">
                <CardHeader>
                    <CardTitle className="text-lg">Stage-wise Turnaround Time (TAT)</CardTitle>
                    <CardDescription>Average days spent in each approval stage</CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={tatData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="stage" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} />
                            <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} tickFormatter={(value) => `${value}d`} />
                            <Tooltip 
                                cursor={{fill: '#f8fafc'}}
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                formatter={(value: number) => [`${value} Days`, "Avg. Duration"]}
                            />
                            <Bar dataKey="days" radius={[4, 4, 0, 0]} barSize={40}>
                                {tatData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Department wise Expenses Paid */}
            <Card className="shadow-sm border-slate-200/60 lg:col-span-2">
                <CardHeader>
                    <CardTitle className="text-lg">Department Allocation</CardTitle>
                    <CardDescription>Total paid amount distributed by department</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col md:flex-row items-center">
                    <div className="w-full md:w-1/2">
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={deptwiseData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="amount"
                                >
                                    {deptwiseData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                    formatter={(value: number) => [`$${value.toLocaleString()}`, "Total Paid"]}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="w-full md:w-1/2 mt-4 md:mt-0 px-4">
                        <div className="grid grid-cols-1 gap-3">
                            {deptwiseData.map((entry, index) => (
                                <div key={entry.name} className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                    <span className="text-sm text-slate-600 font-medium truncate">{entry.name}</span>
                                    <span className="text-sm text-slate-400 ml-auto">${entry.amount.toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Category wise Expense spread */}
            <Card className="shadow-sm border-slate-200/60 lg:col-span-2">
                <CardHeader>
                    <CardTitle className="text-lg">Category Distribution</CardTitle>
                    <CardDescription>Breakdown of paid expenses by category</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col md:flex-row items-center">
                    <div className="w-full md:w-1/2">
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={categoryData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {categoryData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                    formatter={(value: number) => [`$${value.toLocaleString()}`, "Total Paid"]}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="w-full md:w-1/2 mt-4 md:mt-0 px-4">
                        <div className="grid grid-cols-1 gap-3">
                            {categoryData.map((entry, index) => (
                                <div key={entry.name} className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[(index + 2) % COLORS.length] }} />
                                    <span className="text-sm text-slate-600 font-medium truncate">{entry.name}</span>
                                    <span className="text-sm text-slate-400 ml-auto">${entry.value.toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Budget vs Actual */}
            <Card className="shadow-sm border-slate-200/60 lg:col-span-2">
                <CardHeader>
                    <CardTitle className="text-lg">Budget vs Actual by Department</CardTitle>
                    <CardDescription>Comparison of planned budget against current spending</CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={budgetVsActualData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                            <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} tickFormatter={(value) => `$${value}`} />
                            <Tooltip 
                                cursor={{fill: '#f8fafc'}}
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                formatter={(value: number) => [`$${value.toLocaleString()}`, "Amount"]}
                            />
                            <Bar dataKey="budget" name="Budget" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="actual" name="Actual Spend" fill="#ef4444" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
      </div>
    );
  }

  return null;
}
