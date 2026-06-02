import { StatusBadge } from "@/components/status-badge";
import { useApp, ExpenseRequest } from "@/lib/store";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Clock, CheckCircle2, XCircle, AlertCircle, Banknote, Filter, FileText, Search, Download } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { ExpenseDetailsDialog } from "@/components/expense-details-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export { StatusBadge };

export default function MyExpensesPage() {
  const { currentUser, expenses } = useApp();
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedExpense, setSelectedExpense] = useState<ExpenseRequest | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  if (!currentUser) return null;

  const myExpenses = expenses
    .filter(e => e.employeeId === currentUser.id)
    .filter(e => !["draft", "withdrawn"].includes(e.status))
    .filter(e => filter === "all" || e.status === filter)
    .filter(e => 
      e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const totalPages = Math.ceil(myExpenses.length / itemsPerPage);
  const paginatedExpenses = myExpenses.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const exportToCSV = () => {
    const headers = ["Category", "Description", "Date", "Amount", "Status"];
    const rows = myExpenses.map(e => [
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">My Expenses</h1>
          <p className="text-muted-foreground mt-1">Track the status of your reimbursement requests.</p>
        </div>
        
        <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Requests</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="pending_hod">Pending Approval</SelectItem>
                    <SelectItem value="pending_finance">Pending Finance</SelectItem>
                    <SelectItem value="rejected_hod">Rejected</SelectItem>
                </SelectContent>
            </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
            <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-100 text-blue-700 rounded-full">
                        <Clock className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Pending</p>
                        <h3 className="text-2xl font-bold">{myExpenses.filter(e => e.status.includes('pending')).length}</h3>
                    </div>
                </div>
            </CardContent>
        </Card>
        <Card>
            <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-100 text-emerald-700 rounded-full">
                        <Banknote className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Total Paid</p>
                        <h3 className="text-2xl font-bold">${myExpenses.filter(e => e.status === 'paid').reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()}</h3>
                    </div>
                </div>
            </CardContent>
        </Card>
        <Card>
            <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-red-100 text-red-700 rounded-full">
                        <XCircle className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Rejected</p>
                        <h3 className="text-2xl font-bold">{myExpenses.filter(e => e.status.includes('rejected')).length}</h3>
                    </div>
                </div>
            </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
                <CardTitle>Request History</CardTitle>
                <CardDescription>A complete log of your submitted expenses.</CardDescription>
            </div>
            <div className="flex items-center gap-3">
                <div className="relative w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search description or category..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Button variant="outline" size="sm" onClick={exportToCSV} className="gap-2">
                    <Download className="w-4 h-4" /> Download Report
                </Button>
            </div>
        </CardHeader>
        <CardContent>
            <Table>
            <TableHeader>
                <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Details</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {paginatedExpenses.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No expenses found matching your filter.
                        </TableCell>
                    </TableRow>
                ) : (
                    paginatedExpenses.map((expense) => (
                    <TableRow key={expense.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setSelectedExpense(expense)}>
                        <TableCell className="font-medium">{expense.category}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{expense.description}</TableCell>
                        <TableCell>{format(new Date(expense.billDate), "MMM d, yyyy")}</TableCell>
                        <TableCell>${expense.amount.toFixed(2)}</TableCell>
                        <TableCell>
                            <StatusBadge status={expense.status} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                            {expense.status === "paid" && (
                                <span className="text-xs">Paid via {expense.paymentMode} on {expense.paymentDate ? format(new Date(expense.paymentDate), "MMM d") : ""}</span>
                            )}
                            {expense.status.includes("rejected") && (
                                <span className="text-xs text-destructive">Reason: {expense.hodComment || expense.financeComment}</span>
                            )}
                            {expense.status === "pending_hod" && "Waiting for HoD"}
                            {expense.status === "pending_finance" && "Waiting for Finance"}
                        </TableCell>
                    </TableRow>
                    ))
                )}
            </TableBody>
            </Table>
            
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-2 py-4 border-t">
                    <div className="text-sm text-muted-foreground">
                        Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, myExpenses.length)} of {myExpenses.length} entries
                    </div>
                    <div className="flex items-center gap-2">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                        >
                            Previous
                        </Button>
                        <div className="text-sm font-medium px-2">
                            Page {currentPage} of {totalPages}
                        </div>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}
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
