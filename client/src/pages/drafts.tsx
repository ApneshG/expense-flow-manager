import { useApp, ExpenseRequest, CATEGORY_LIMITS } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Pencil, Trash2, Send, Save } from "lucide-react";
import { format, subDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UploadCloud, Loader2, ScanLine, Camera, Upload } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const expenseSchema = z.object({
  employeeId: z.string().min(1, "Please select an employee"),
  description: z.string().min(5, "Description must be at least 5 characters"),
  category: z.string().min(1, "Please select a category"),
  amount: z.coerce.number().positive("Amount must be positive"),
  billDate: z.string().refine((val) => {
    const date = new Date(val);
    const ninetyDaysAgo = subDays(new Date(), 90);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return date >= ninetyDaysAgo && date <= today;
  }, "Bill date must be within the last 90 days and cannot be in the future."),
});

export default function DraftsPage() {
  const { currentUser, expenses, updateExpenseStatus, departments, users, deleteExpense } = useApp();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [draftToDelete, setDraftToDelete] = useState<string | null>(null);
  
  const [draftToEdit, setDraftToEdit] = useState<ExpenseRequest | null>(null);
  const [draftToSubmit, setDraftToSubmit] = useState<ExpenseRequest | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedFile, setScannedFile] = useState<string | null>(null);

  const form = useForm<z.infer<typeof expenseSchema>>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      employeeId: currentUser?.id || "",
      description: "",
      category: "",
      amount: 0,
      billDate: format(new Date(), "yyyy-MM-dd"),
    },
  });

  const userDept = departments.find(d => d.id === currentUser?.departmentId);
  const deptHod = users.find(u => u.id === userDept?.hodId);

  if (!currentUser) return null;

  const drafts = expenses
    .filter(e => e.employeeId === currentUser.id && e.status === "draft")
    // Sort by Bill Date, most recent first
    .sort((a, b) => new Date(b.billDate).getTime() - new Date(a.billDate).getTime());

  const handleSubmitDraft = (draft: any) => {
    updateExpenseStatus(draft.id, {
        status: "pending_hod",
        createdAt: new Date().toISOString()
    });
    
    toast({
        title: "Draft Submitted",
        description: "Your draft has been submitted for approval.",
    });
  };

  const confirmSubmit = () => {
    if (draftToSubmit) {
      handleSubmitDraft(draftToSubmit);
      setDraftToSubmit(null);
    }
  };

  const openEditModal = (draft: ExpenseRequest) => {
    setDraftToEdit(draft);
    setScannedFile(draft.attachmentUrl || null);
    form.reset({
      employeeId: draft.employeeId,
      description: draft.description,
      category: draft.category,
      amount: draft.amount,
      billDate: draft.billDate,
    });
  };

  const handleSaveEdit = (values: z.infer<typeof expenseSchema>) => {
    if (draftToEdit) {
      updateExpenseStatus(draftToEdit.id, {
        amount: values.amount,
        description: values.description,
        category: values.category,
        billDate: values.billDate,
        attachmentUrl: scannedFile || undefined,
      });
      setDraftToEdit(null);
      toast({ title: "Draft Updated", description: "Your changes have been saved." });
    }
  };

  const simulateScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      setScannedFile("invoice_scan_sample.pdf");
      toast({
        title: "Scan Complete",
        description: "Invoice attached successfully.",
      });
    }, 1500);
  };

  const handleDeleteDraft = () => {
      if (draftToDelete) {
          deleteExpense(draftToDelete);
          setDraftToDelete(null);
          toast({
              title: "Deleted",
              description: "Draft has been deleted successfully.",
          });
      }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold">Draft Expenses</h1>
        <p className="text-muted-foreground mt-1">Continue working on your saved expense reports.</p>
      </div>

      <Card>
        <CardHeader>
            <CardTitle>Saved Drafts</CardTitle>
            <CardDescription>You can edit and submit these requests.</CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
            <TableHeader>
                <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Bill Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {drafts.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            No drafts found.
                        </TableCell>
                    </TableRow>
                ) : (
                    drafts.map((draft) => (
                    <TableRow key={draft.id}>
                        <TableCell className="font-medium">{draft.category}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{draft.description}</TableCell>
                        <TableCell>
                            <div>
                                {format(new Date(draft.billDate), "MMM d, yyyy")}
                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                    Last saved: {format(new Date(draft.createdAt || new Date()), "MMM d, HH:mm")}
                                </div>
                            </div>
                        </TableCell>
                        <TableCell>${Number(draft.amount).toFixed(2)}</TableCell>
                        <TableCell className="text-right space-x-2">
                             <Button variant="ghost" size="sm" onClick={() => setDraftToDelete(draft.id)} className="text-destructive hover:text-destructive">
                                <Trash2 className="w-4 h-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => openEditModal(draft)}>
                                <Pencil className="w-4 h-4 mr-2" /> Edit
                            </Button>
                            <Button size="sm" onClick={() => setDraftToSubmit(draft)}>
                                <Send className="w-4 h-4 mr-2" /> Submit
                            </Button>
                        </TableCell>
                    </TableRow>
                    ))
                )}
            </TableBody>
            </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!draftToDelete} onOpenChange={(open) => !open && setDraftToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Draft?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. Are you sure you want to delete this draft?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDraft} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!draftToEdit} onOpenChange={(open) => !open && setDraftToEdit(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Draft</DialogTitle>
            <DialogDescription>
              Make changes to your saved draft before submitting.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
                <Form {...form}>
                    <form id="edit-draft-form" onSubmit={form.handleSubmit(handleSaveEdit)} className="space-y-4">
                    
                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="employeeId"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Employee ID</FormLabel>
                                <Select disabled value={field.value}>
                                <FormControl>
                                    <SelectTrigger className="bg-muted/50">
                                    <SelectValue placeholder="Select Employee" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {users.filter(u => u.role === 'employee').map(u => (
                                        <SelectItem key={u.id} value={u.id}>{u.name} ({u.id})</SelectItem>
                                    ))}
                                </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Department</label>
                            <div className="p-2 bg-muted/50 rounded-md text-sm font-medium border h-10 flex items-center">{userDept?.name || "N/A"}</div>
                        </div>
                    </div>

                    <div className="space-y-2">
                         <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Approving HoD</label>
                        <div className="p-2 bg-muted/50 rounded-md text-sm border flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-primary/50"></div>
                            {deptHod?.name || "N/A"}
                        </div>
                    </div>

                    <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Category</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                <SelectValue placeholder="Select expense category" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {Object.entries(CATEGORY_LIMITS).map(([cat, limit]) => (
                                    <SelectItem key={cat} value={cat}>{cat} (Max ${limit})</SelectItem>
                                ))}
                            </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                        control={form.control}
                        name="amount"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Amount ($)</FormLabel>
                            <FormControl>
                                <Input type="number" step="0.01" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        <FormField
                        control={form.control}
                        name="billDate"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Bill Date</FormLabel>
                            <FormControl>
                                <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                    </div>

                    <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                                <Textarea placeholder="Describe the business purpose..." className="resize-none" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />

                    <div className="space-y-2">
                        <Label>Attachment (Optional)</Label>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <div 
                                    className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-muted/20 transition-colors group h-32"
                                >
                                    {isScanning ? (
                                        <>
                                            <Loader2 className="w-6 h-6 text-primary animate-spin mb-2" />
                                            <p className="text-sm font-medium">Scanning Invoice...</p>
                                        </>
                                    ) : scannedFile ? (
                                        <>
                                            <FileText className="w-8 h-8 text-success mb-2" />
                                            <p className="text-sm font-medium text-success">File Attached</p>
                                            <p className="text-xs text-muted-foreground mt-1 break-all">{scannedFile}</p>
                                            <Button variant="ghost" size="sm" className="mt-2 text-xs h-6" onClick={(e) => { e.stopPropagation(); setScannedFile(null); }}>Remove</Button>
                                        </>
                                    ) : (
                                        <>
                                            <div className="bg-primary/10 p-2 rounded-full mb-2 group-hover:scale-110 transition-transform">
                                                <ScanLine className="w-4 h-4 text-primary" />
                                            </div>
                                            <p className="text-sm font-medium">Upload Invoice</p>
                                            <p className="text-xs text-muted-foreground mt-1 px-2">Click to select upload method</p>
                                            <p className="text-[10px] text-muted-foreground/70 mt-2">Supports PDF, JPG, PNG (Max 5MB)</p>
                                        </>
                                    )}
                                </div>
                            </DropdownMenuTrigger>
                            {!isScanning && !scannedFile && (
                                <DropdownMenuContent align="center" className="w-56">
                                    <DropdownMenuItem onClick={simulateScan} className="cursor-pointer py-3">
                                        <Camera className="w-4 h-4 mr-3 text-muted-foreground" />
                                        <div className="flex flex-col">
                                            <span className="font-medium">Use Camera</span>
                                            <span className="text-xs text-muted-foreground">Take a photo of receipt</span>
                                        </div>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={simulateScan} className="cursor-pointer py-3">
                                        <Upload className="w-4 h-4 mr-3 text-muted-foreground" />
                                        <div className="flex flex-col">
                                            <span className="font-medium">Upload File</span>
                                            <span className="text-xs text-muted-foreground">Choose from device</span>
                                        </div>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            )}
                        </DropdownMenu>
                    </div>

                    </form>
                </Form>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraftToEdit(null)}>Cancel</Button>
            <Button type="submit" form="edit-draft-form">
                <Save className="w-4 h-4 mr-2" /> Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!draftToSubmit} onOpenChange={(open) => !open && setDraftToSubmit(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Expense Request?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to submit this expense request? It will be sent to your Head of Department for approval.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSubmit}>Yes, Submit</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
