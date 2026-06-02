import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, subDays } from "date-fns";
import { useApp, User, UserRole, ExpenseCategory } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { UploadCloud, Loader2, Sparkles, ScanLine, FileText, Save, Trash2, Info, Upload, Camera, AlertCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";

// Helper for schema validation
const expenseSchema = z.object({
  employeeId: z.string().min(1, "Please select an employee"),
  description: z.string().min(5, "Description must be at least 5 characters"),
  category: z.string().min(1, "Please select a category"),
  amount: z.coerce.number().positive("Amount must be positive"),
  billDate: z.string().refine((val) => {
    const date = new Date(val);
    const ninetyDaysAgo = subDays(new Date(), 90);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    return date >= ninetyDaysAgo && date <= today;
  }, "Bill date must be within the last 90 days and cannot be in the future."),
});

export default function NewExpensePage() {
  const appContext = useApp();
  const { data: categories = [] } = useQuery<ExpenseCategory[]>({
    queryKey: ["/api/categories"],
    enabled: !!appContext?.currentUser,
  });
  if (!appContext) return null;
  const { currentUser, setCurrentUser, departments, users, addExpense, expenses, getEmployeeExceptionCount } = appContext;

  const { toast } = useToast();
  const [, setLocation] = useLocation();
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

  // Watch values for validation checks and employee changes
  const watchedAmount = form.watch("amount");
  const watchedCategory = form.watch("category");
  const watchedEmployeeId = form.watch("employeeId");
  const [limitError, setLimitError] = useState<string | null>(null);
  const [requestException, setRequestException] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedEmployeeDept, setSelectedEmployeeDept] = useState<any>(null);
  const [selectedEmployeeHoD, setSelectedEmployeeHoD] = useState<any>(null);

  // Auto-update department and HoD based on selected employee
  useEffect(() => {
    const selectedEmp = users.find(u => u.id === watchedEmployeeId);
    if (selectedEmp) {
      const dept = departments.find(d => d.id === selectedEmp.departmentId);
      setSelectedEmployeeDept(dept);
      if (dept) {
        const hod = users.find(u => u.id === dept.hodId);
        setSelectedEmployeeHoD(hod);
      }
    }
  }, [watchedEmployeeId, users, departments]);

  // Fallback to current user's department/HoD if no employee selected
  const userDept = selectedEmployeeDept || departments.find(d => d.id === currentUser?.departmentId);
  const deptHod = selectedEmployeeHoD || users.find(u => u.id === userDept?.hodId);

  const exceptionCount = getEmployeeExceptionCount(currentUser?.id || "", new Date().getFullYear());

  useEffect(() => {
    const categoryLimit = categories.find(c => c.name === watchedCategory)?.budgetLimit || 0;
    if (watchedCategory && categoryLimit > 0) {
        if (watchedAmount > categoryLimit) {
            setLimitError(`The maximum allowed amount for ${watchedCategory} is $${categoryLimit}.`);
        } else {
            setLimitError(null);
            setRequestException(false);
        }
    } else {
        setLimitError(null);
        setRequestException(false);
    }
  }, [watchedAmount, watchedCategory, categories]);

  // Update form employeeId if currentUser changes
  useEffect(() => {
    if (currentUser) {
        form.setValue("employeeId", currentUser.id);
    }
  }, [currentUser, form]);

  const validateSubmission = (values: z.infer<typeof expenseSchema>) => {
    // Duplicate Detection
    const isDuplicate = expenses.some(e => 
        e.employeeId === values.employeeId && 
        e.category === values.category && 
        e.amount === values.amount && 
        e.billDate === values.billDate &&
        e.status !== "rejected_hod" &&
        e.status !== "rejected_finance"
    );

    if (isDuplicate) {
        toast({
            title: "Duplicate Detected",
            description: "An expense with the same category, amount, and date already exists.",
            variant: "destructive"
        });
        return false;
    }

    // 1. Check Category Limits
    const categoryLimit = categories.find(c => c.name === values.category)?.budgetLimit || 0;
    if (values.category && categoryLimit > 0) {
        if (values.amount > categoryLimit) {
            if (!requestException) {
                toast({
                    title: "Limit Exceeded",
                    description: `The maximum allowed amount for ${values.category} is $${categoryLimit}. Check the exception box if you need special approval.`,
                    variant: "destructive"
                });
                return false;
            }
            if (exceptionCount >= 5) {
                toast({
                    title: "Exception Limit Reached",
                    description: `You have already used all 5 of your allowed exceptions for this year.`,
                    variant: "destructive"
                });
                return false;
            }
        }
    }
    
    // 2. Check Bill Date (Double check, although Zod handles it)
    const date = new Date(values.billDate);
    const ninetyDaysAgo = subDays(new Date(), 90);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (date < ninetyDaysAgo || date > today) {
         toast({
            title: "Invalid Date",
            description: "Bill date must be within the last 90 days.",
            variant: "destructive"
        });
        return false;
    }

    return true;
  };

  const handleDraft = async () => {
    const values = form.getValues();
    // Drafts don't need strict validation, but basic fields should exist
    if (!currentUser || !userDept || !deptHod) return;

    addExpense({
      employeeId: values.employeeId,
      departmentId: userDept.id,
      hodId: deptHod.id,
      description: values.description || "Untitled Draft",
      category: values.category || "Office",
      amount: values.amount || 0,
      billDate: values.billDate,
      attachmentUrl: scannedFile || undefined,
      status: "draft",
      isException: limitError ? requestException : false,
    });

    toast({ title: "Draft Saved", description: "Expense saved to drafts." });
    setLocation("/drafts");
  };

  const onSubmit = (values: z.infer<typeof expenseSchema>) => {
    if (!currentUser || !userDept || !deptHod) {
      toast({ title: "Error", description: "Missing user or department configuration", variant: "destructive" });
      return;
    }

    if (!validateSubmission(values)) return;

    addExpense({
      departmentId: userDept.id,
      hodId: deptHod.id,
      status: "pending_hod",
      ...values,
      attachmentUrl: scannedFile || undefined,
      isException: limitError ? requestException : false,
    });

    toast({
      title: "Expense Submitted",
      description: "Your expense request has been sent to your HoD for approval.",
    });

    setLocation("/my-expenses");
  };

  const simulateScan = () => {
    setIsScanning(true);
    // Simulate OCR delay
    setTimeout(() => {
      setIsScanning(false);
      setScannedFile("invoice_scan_sample.pdf");
      
      // Auto-fill form with "scanned" data
      form.setValue("amount", 124.50);
      form.setValue("billDate", format(subDays(new Date(), 2), "yyyy-MM-dd"));
      form.setValue("category", "Meals");
      form.setValue("description", "Team Lunch at Bistro");
      
      toast({
        title: "Scan Complete",
        description: "Invoice details auto-populated successfully.",
      });
    }, 2000);
  };

  if (!currentUser || currentUser.role !== "employee") {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <h2 className="text-xl font-semibold">Access Restricted</h2>
        <p>Only employees can submit new expenses.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">New Expense Request</h1>
        <p className="text-muted-foreground mt-2">Submit your business expenses for reimbursement.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
        <Card className="order-2 md:order-1">
            <CardHeader>
                <CardTitle>Expense Details</CardTitle>
                <CardDescription>Fill in the details of your expenditure.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    
                    {limitError && (
                        <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-lg space-y-3 animate-in fade-in slide-in-from-top-1">
                            <div className="flex items-start gap-3 text-destructive">
                                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                <div className="text-sm">
                                    <p className="font-bold uppercase text-[10px] tracking-wider mb-0.5">Policy Limit Exceeded</p>
                                    <p>{limitError}</p>
                                </div>
                            </div>
                            
                            <div className="pl-7 pt-2 border-t border-destructive/10 flex items-start space-x-2">
                              <Checkbox 
                                id="request-exception" 
                                checked={requestException}
                                onCheckedChange={(checked) => setRequestException(checked === true)}
                                disabled={exceptionCount >= 5}
                              />
                              <div className="grid gap-1.5 leading-none">
                                <label
                                  htmlFor="request-exception"
                                  className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${exceptionCount >= 5 ? 'text-destructive font-bold' : ''}`}
                                >
                                  Request Exception for Over-limit Amount
                                </label>
                                <p className="text-xs text-muted-foreground">
                                  You have used {exceptionCount} of 5 exceptions this year.
                                  {exceptionCount >= 5 && " You cannot request any more exceptions."}
                                </p>
                              </div>
                            </div>
                        </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="employeeId"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Employee ID</FormLabel>
                                <Select 
                                    onValueChange={(val) => {
                                        field.onChange(val);
                                        const user = users.find(u => u.id === val);
                                        if (user) setCurrentUser(user);
                                    }} 
                                    defaultValue={field.value}
                                    value={field.value}
                                >
                                <FormControl>
                                    <SelectTrigger>
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
                            <FormLabel>Category <span className="text-destructive">*</span></FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                <SelectValue placeholder="Select expense category" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {categories.map((cat) => (
                                    <SelectItem key={cat.id} value={cat.name}>{cat.name} {cat.budgetLimit ? `(Max $${cat.budgetLimit})` : ""}</SelectItem>
                                ))}
                            </SelectContent>
                            </Select>
                            <FormDescription className="flex items-center gap-1 text-[10px]">
                                <Info className="w-3 h-3" /> Policy limits apply based on category.
                            </FormDescription>
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
                            <FormLabel>Amount ($) <span className="text-destructive">*</span></FormLabel>
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
                            <FormLabel>Bill Date <span className="text-destructive">*</span></FormLabel>
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
                            <FormLabel>Description <span className="text-destructive">*</span></FormLabel>
                            <FormControl>
                                <Textarea placeholder="Describe the business purpose..." className="resize-none" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />

                    <div className="flex items-center space-x-2 pt-1 pb-2">
                        <Checkbox 
                            id="recurring-expense" 
                            checked={isRecurring}
                            onCheckedChange={(checked) => setIsRecurring(checked === true)}
                        />
                        <div className="grid gap-1.5 leading-none">
                            <label
                                htmlFor="recurring-expense"
                                className="text-sm font-medium leading-none"
                            >
                                Make this a recurring monthly expense
                            </label>
                            <p className="text-xs text-muted-foreground">
                                Automatically draft this expense on the 1st of every month.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <Button type="button" variant="outline" className="flex-1" onClick={() => setLocation('/')}>
                            Discard
                        </Button>
                        <Button type="button" variant="secondary" className="flex-1" onClick={handleDraft}>
                            <Save className="w-4 h-4 mr-2" /> Save Draft
                        </Button>
                        <Button type="submit" className="flex-[2]" disabled={!!limitError}>Submit Request</Button>
                    </div>
                    </form>
                </Form>
            </CardContent>
        </Card>

        <Card className="order-1 md:order-2 h-fit">
            <CardHeader className="bg-muted/30 border-b pb-4">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    Receipt Upload
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <div 
                            className="border-2 border-dashed border-primary/25 bg-primary/5 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-primary/10 transition-colors group"
                        >
                            {isScanning ? (
                                <>
                                    <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
                                    <p className="text-sm font-medium">Scanning Invoice...</p>
                                    <p className="text-xs text-muted-foreground mt-1">Extracting dates & amounts</p>
                                </>
                            ) : scannedFile ? (
                                <>
                                    <FileText className="w-8 h-8 text-success mb-3" />
                                    <p className="text-sm font-medium text-success">Scan Successful</p>
                                    <p className="text-xs text-muted-foreground mt-1 break-all">{scannedFile}</p>
                                    <Button variant="ghost" size="sm" className="mt-3 text-xs h-8" onClick={(e) => { e.stopPropagation(); setScannedFile(null); }}>Remove</Button>
                                </>
                            ) : (
                                <>
                                    <div className="bg-primary/20 p-2.5 rounded-full mb-3 group-hover:scale-110 transition-transform">
                                        <ScanLine className="w-5 h-5 text-primary" />
                                    </div>
                                    <p className="text-sm font-medium text-primary">Smart Scan / Upload</p>
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
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
