import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO, isWithinInterval } from "date-fns";
import { Download, Search, Calendar as CalendarIcon, FileText, Clock, CheckCircle2, XCircle } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { ExpenseDetailsDialog } from "@/components/expense-details-dialog";
import { ExpenseRequest, User, Department } from "@/lib/store";
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

export default function AdminExpensesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedExpense, setSelectedExpense] = useState<ExpenseRequest | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const { data: expenses = [], isLoading: loadingExp } = useQuery<ExpenseRequest[]>({
    queryKey: ["/api/admin/expenses"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const categories = useMemo(() => {
    const cats = new Set(expenses.map(e => e.category));
    return Array.from(cats);
  }, [expenses]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      // Exclude Draft and Withdrawn statuses
      if (["draft", "withdrawn"].includes(e.status)) return false;
      
      const employee = users.find(u => u.id === e.employeeId);
      const dept = departments.find(d => d.id === e.departmentId);
      const hod = users.find(u => u.id === e.hodId);

      const matchesSearch = 
        e.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dept?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (hod?.name || "").toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === "all" || e.status === statusFilter;
      const matchesDept = deptFilter === "all" || e.departmentId === deptFilter;
      const matchesCat = catFilter === "all" || e.category === catFilter;

      let matchesDate = true;
      if (dateRange?.from) {
        const billDate = parseISO(e.billDate);
        const toDate = dateRange.to || dateRange.from;
        matchesDate = isWithinInterval(billDate, { start: dateRange.from, end: toDate });
      }

      return matchesSearch && matchesStatus && matchesDept && matchesCat && matchesDate;
    });
  }, [expenses, searchTerm, statusFilter, deptFilter, catFilter, dateRange, users, departments]);

  const paginatedExpenses = filteredExpenses.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filteredExpenses.length / pageSize);

  const stats = useMemo(() => {
    const total = filteredExpenses.length;
    const pending = filteredExpenses.filter(e => ["pending_hod", "pending_finance"].includes(e.status)).length;
    const approved = filteredExpenses.filter(e => e.status === "paid").length;
    const rejected = filteredExpenses.filter(e => ["rejected_hod", "rejected_finance"].includes(e.status)).length;
    const totalAmount = filteredExpenses.filter(e => e.status === "paid").reduce((sum, e) => sum + e.amount, 0);

    return { total, pending, approved, rejected, totalAmount };
  }, [filteredExpenses]);

  const exportToCSV = () => {
    const headers = ["Request ID", "Employee", "Department", "HoD", "Category", "Amount", "Date", "Status", "Last Modified"];
    const rows = filteredExpenses.map(e => {
      const lastLog = e.auditLog?.[e.auditLog.length - 1];
      return [
        e.id,
        users.find(u => u.id === e.employeeId)?.name || "Unknown",
        departments.find(d => d.id === e.departmentId)?.name || "Unknown",
        users.find(u => u.id === e.hodId)?.name || "Unknown",
        e.category,
        e.amount.toFixed(2),
        e.billDate,
        e.status,
        lastLog ? `${lastLog.action} by ${lastLog.actorName}` : "-"
      ];
    });
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(r => r.join(",")).join("\n");
        
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `expense_report_${format(new Date(), "yyyy-MM-dd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">All Expense Requests</h1>
          <p className="text-muted-foreground mt-1">Oversight and reporting of all expenses across the company.</p>
        </div>
        <Button onClick={exportToCSV} variant="outline" className="gap-2" data-testid="button-export-csv">
          <Download className="w-4 h-4" /> Export to CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <StatCard title="Total Requests" value={stats.total} icon={<FileText className="w-4 h-4 text-blue-600" />} color="bg-blue-50" />
        <StatCard title="Total Pending" value={stats.pending} icon={<Clock className="w-4 h-4 text-amber-600" />} color="bg-amber-50" />
        <StatCard title="Total Approved" value={stats.approved} icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />} color="bg-emerald-50" />
        <StatCard title="Total Rejected" value={stats.rejected} icon={<XCircle className="w-4 h-4 text-red-600" />} color="bg-red-50" />
        <StatCard title="Paid Amount" value={`$${stats.totalAmount.toLocaleString()}`} icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />} color="bg-emerald-50" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col space-y-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by Employee, ID, Dept, or HoD..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                data-testid="input-search-expenses"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[240px] justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (dateRange.to ? <>{format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}</> : format(dateRange.from, "LLL dd, y")) : <span>Filter by Bill Date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar initialFocus mode="range" selected={dateRange} onSelect={(r) => { setDateRange(r); setCurrentPage(1); }} numberOfMonths={2} />
                </PopoverContent>
              </Popover>

              <Select value={deptFilter} onValueChange={(v) => { setDeptFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Department" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={catFilter} onValueChange={(v) => { setCatFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending_hod">Pending HoD</SelectItem>
                  <SelectItem value="pending_finance">Pending Finance</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="rejected_hod">Rejected (HoD)</SelectItem>
                  <SelectItem value="rejected_finance">Rejected (Finance)</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="needs_revision">Sent Back</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">ID</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>HoD</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Bill Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedExpenses.map((expense) => {
                  const employee = users.find(u => u.id === expense.employeeId);
                  const dept = departments.find(d => d.id === expense.departmentId);
                  const hod = users.find(u => u.id === expense.hodId);
                  const lastLog = expense.auditLog?.[expense.auditLog.length - 1];

                  return (
                    <TableRow key={expense.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedExpense(expense)}>
                      <TableCell className="font-mono text-xs">{expense.id}</TableCell>
                      <TableCell className="font-medium">{employee?.name}</TableCell>
                      <TableCell>{dept?.name}</TableCell>
                      <TableCell className="text-sm">{hod?.name}</TableCell>
                      <TableCell><span className="text-xs bg-muted px-2 py-1 rounded-full">{expense.category}</span></TableCell>
                      <TableCell className="font-bold">${expense.amount.toFixed(2)}</TableCell>
                      <TableCell className="text-sm">{format(parseISO(expense.billDate), "MMM d, yyyy")}</TableCell>
                      <TableCell><StatusBadge status={expense.status} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {lastLog ? (<div><div>{lastLog.action}</div><div>{lastLog.actorName}</div></div>) : "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {Math.min(filteredExpenses.length, (currentPage - 1) * pageSize + 1)}-{Math.min(filteredExpenses.length, currentPage * pageSize)} of {filteredExpenses.length}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ExpenseDetailsDialog expense={selectedExpense} open={!!selectedExpense} onOpenChange={(o) => !o && setSelectedExpense(null)} />
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string, value: string | number, icon: React.ReactNode, color: string }) {
  return (
    <Card className="shadow-none">
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-lg", color)}>{icon}</div>
          <div>
            <p className="text-xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{title}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
