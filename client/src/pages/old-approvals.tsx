import { useApp } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { StatusBadge } from "@/components/status-badge";
import { format, isWithinInterval, parseISO, differenceInMinutes, differenceInHours } from "date-fns";
import { useState, useMemo } from "react";
import { CalendarIcon, History, Check, Search, Download, ArrowUpDown, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ExpenseDetailsDialog } from "@/components/expense-details-dialog";
import { ExpenseRequest } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function OldApprovalsPage() {
  const { currentUser, expenses, users, updateExpenseStatus } = useApp();
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("all");
  const [selectedExpense, setSelectedExpense] = useState<ExpenseRequest | null>(null);
  
  // New Filters & Sort
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<string>("date-desc");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Find expenses that were approved by this HoD
  // If it has passed the HoD stage successfully, it won't be 'draft', 'pending_hod', or 'rejected_hod'
  const approvedStatuses = ['pending_finance', 'paid', 'on_hold', 'needs_revision', 'rejected_finance'];

  const oldApprovals = expenses.filter(e => {
    if (e.hodId !== currentUser?.id) return false;
    if (e.status === "on_hold") return false; // Show in pending, not past
    if (!approvedStatuses.includes(e.status)) return false;
    return true;
  });

  const filteredAndSortedExpenses = useMemo(() => {
    let result = [...oldApprovals];

    // Filter by Employee
    if (selectedEmployeeId !== "all") {
        result = result.filter(e => e.employeeId === selectedEmployeeId);
    }

    // Filter by Status
    if (statusFilter !== "all") {
        result = result.filter(e => e.status === statusFilter);
    }

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
            const toDate = dateRange.to || dateRange.from;
            return isWithinInterval(billDate, { start: dateRange.from as Date, end: toDate as Date });
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
  }, [oldApprovals, selectedEmployeeId, searchTerm, dateRange, sortBy, statusFilter]);

  const departmentEmployees = users.filter(u => u.departmentId === currentUser?.departmentId && u.role === 'employee');

  const handleRevoke = (expenseId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      updateExpenseStatus(expenseId, { status: 'pending_hod', hodComment: '', hodActionDate: undefined });
      toast({
          title: "Approval Revoked",
          description: "The expense has been moved back to your pending queue."
      });
  };

  const exportToCSV = () => {
    const headers = ["Employee", "Category", "Description", "Date", "Amount", "Status", "Approval Date"];
    const rows = filteredAndSortedExpenses.map(e => {
        const employee = users.find(u => u.id === e.employeeId);
        return [
            employee?.name || "Unknown",
            e.category,
            e.description,
            e.billDate,
            e.amount,
            e.status,
            e.hodActionDate ? format(new Date(e.hodActionDate), "yyyy-MM-dd") : "N/A"
        ];
    });
    
    const csvContent = "data:text/csv;charset=utf-8," 
        + headers.join(",") + "\n" 
        + rows.map(r => r.join(",")).join("\n");
        
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "past_approvals_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!currentUser || currentUser.role !== "hod") {
      return <div className="p-8 text-center text-muted-foreground">Access denied. HoD role required.</div>;
  }

  return (
      <div className="space-y-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-display font-bold">Past Approvals</h1>
              <p className="text-muted-foreground mt-1">Review previously approved expense requests.</p>
            </div>
            
            <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger className="w-[180px] bg-background">
                    <SelectValue placeholder="All Employees" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    {departmentEmployees.map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
          </div>
          <Card>
            <CardHeader className="pb-4">
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                        <CardTitle className="text-xl">Past Records</CardTitle>
                        <Badge variant="secondary" className="rounded-full">{filteredAndSortedExpenses.length}</Badge>
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

                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-full md:w-[130px] bg-background h-8 text-sm">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    <SelectItem value="pending_finance">Approved</SelectItem>
                                    <SelectItem value="rejected_finance">Rejected</SelectItem>
                                    <SelectItem value="needs_revision">Sent Back</SelectItem>
                                    <SelectItem value="paid">Paid</SelectItem>
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

                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full md:w-auto ml-auto whitespace-nowrap bg-background h-8 px-3 text-sm"
                            onClick={exportToCSV}
                        >
                            <Download className="w-3.5 h-3.5 mr-1.5" />
                            Download
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-muted/40">
                        <TableRow>
                            <TableHead>Employee</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Bill Date</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right pr-6">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredAndSortedExpenses.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-16">
                                    <History className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                                    <p className="font-medium text-muted-foreground">No records found</p>
                                    <p className="text-sm text-muted-foreground/80">You haven't approved any requests that match the current filters.</p>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredAndSortedExpenses.map((expense) => {
                                const employee = users.find(u => u.id === expense.employeeId);
                                
                                // In a real app we'd compare against current time. For this demo,
                                // we'll allow revoke if the action date is today and it's still pending_finance
                                const canRevoke = expense.status === 'pending_finance' && 
                                                  expense.hodActionDate && 
                                                  differenceInHours(new Date(), parseISO(expense.hodActionDate)) < 24;

                                return (
                                    <TableRow 
                                        key={expense.id} 
                                        className="cursor-pointer transition-colors hover:bg-muted/50"
                                        onClick={() => setSelectedExpense(expense)}
                                    >
                                        <TableCell className="font-medium">{employee?.name}</TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className="font-normal">{expense.category}</Badge>
                                        </TableCell>
                                        <TableCell className="max-w-[200px] truncate">{expense.description}</TableCell>
                                        <TableCell>{format(new Date(expense.billDate), "MMM d, yyyy")}</TableCell>
                                        <TableCell className="font-bold">${expense.amount.toFixed(2)}</TableCell>
                                        <TableCell>
                                            <StatusBadge status={expense.status} />
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-sm">
                                            {expense.hodActionDate ? format(new Date(expense.hodActionDate), "MMM d, yyyy") : 'Unknown'}
                                        </TableCell>
                                        <TableCell className="text-right pr-4" onClick={(e) => e.stopPropagation()}>
                                            {canRevoke ? (
                                                <Button 
                                                    size="sm" 
                                                    variant="outline" 
                                                    className="h-8 text-xs text-amber-600 border-amber-200 hover:bg-amber-50"
                                                    onClick={(e) => handleRevoke(expense.id, e)}
                                                    title="Undo approval (available for 24h)"
                                                >
                                                    <RotateCcw className="w-3 h-3 mr-1" /> Revoke
                                                </Button>
                                            ) : (
                                                <span className="text-xs text-muted-foreground opacity-50 block w-full text-right pr-4" title="Cannot revoke (already processed or time limit expired)">Locked</span>
                                            )}
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

