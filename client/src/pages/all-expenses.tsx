import { useApp } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, parseISO, isWithinInterval } from "date-fns";
import { useState } from "react";
import { Download, FileText, Filter, Search, Eye, History, CalendarIcon } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { ExpenseDetailsDialog } from "@/components/expense-details-dialog";
import { ExpenseRequest } from "@/lib/store";
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

export default function AllExpensesPage() {
  const { currentUser, expenses, users, departments } = useApp();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedExpense, setSelectedExpense] = useState<ExpenseRequest | null>(null);

  if (!currentUser || currentUser.role !== "finance_head") {
    return <div className="p-8 text-center text-muted-foreground">Access denied. Finance role required.</div>;
  }

  // Filter logic
  const filteredExpenses = expenses.filter(e => {
    // Only show expenses that reached Finance at some point, exclude Draft and Withdrawn
    const reachedFinance = ["pending_finance", "paid", "on_hold", "needs_revision"].includes(e.status);
    if (!reachedFinance) return false;
    
    // Exclude Draft and Withdrawn statuses
    if (["draft", "withdrawn"].includes(e.status)) return false;

    if (dateRange?.from) {
        const billDate = parseISO(e.billDate);
        const toDate = dateRange.to || dateRange.from;
        if (!isWithinInterval(billDate, { start: dateRange.from, end: toDate })) return false;
    }

    const matchesSearch = 
        e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        users.find(u => u.id === e.employeeId)?.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || e.status === statusFilter;
    const matchesDept = deptFilter === "all" || e.departmentId === deptFilter;

    return matchesSearch && matchesStatus && matchesDept;
  });

  const exportToCSV = () => {
    // Basic CSV export logic
    const headers = ["ID", "Employee", "Department", "Description", "Date", "Amount", "Status", "Payment Mode"];
    const rows = filteredExpenses.map(e => [
        e.id,
        users.find(u => u.id === e.employeeId)?.name || "Unknown",
        departments.find(d => d.id === e.departmentId)?.name || "Unknown",
        e.description,
        e.billDate,
        e.amount,
        e.status,
        e.paymentMode || "-"
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
        + headers.join(",") + "\n" 
        + rows.map(e => e.join(",")).join("\n");
        
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "all_expenses_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getAuditLog = (expenseId: string) => {
    const expense = expenses.find(e => e.id === expenseId);
    return expense?.auditLog || [];
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h1 className="text-3xl font-display font-bold">Old Expenses</h1>
           <p className="text-muted-foreground mt-1">List of all expenses that have reached the finance team.</p>
        </div>
        
        <Button onClick={exportToCSV} variant="outline" className="gap-2">
            <Download className="w-4 h-4" /> Export Report
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by description or employee..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-2 flex-wrap md:flex-nowrap">
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
                                        <>{format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}</>
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

                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filter Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            <SelectItem value="pending_finance">Pending Finance</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="on_hold">On Hold</SelectItem>
                            <SelectItem value="needs_revision">Send Back</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={deptFilter} onValueChange={setDeptFilter}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filter Department" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Departments</SelectItem>
                            {departments.map(d => (
                                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </CardHeader>
        <CardContent>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Employee</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Bill Date</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredExpenses.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                    No expenses found matching your filters.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredExpenses.map((expense) => (
                                <TableRow key={expense.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedExpense(expense)}>
                                    <TableCell>
                                        <div className="font-medium">{users.find(u => u.id === expense.employeeId)?.name}</div>
                                        <div className="text-xs text-muted-foreground">{departments.find(d => d.id === expense.departmentId)?.name}</div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-medium">{expense.description}</div>
                                        <div className="text-xs text-muted-foreground">{expense.category}</div>
                                    </TableCell>
                                    <TableCell>{format(parseISO(expense.billDate), "MMM d, yyyy")}</TableCell>
                                    <TableCell className="font-bold">${expense.amount.toFixed(2)}</TableCell>
                                    <TableCell><StatusBadge status={expense.status} /></TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
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
