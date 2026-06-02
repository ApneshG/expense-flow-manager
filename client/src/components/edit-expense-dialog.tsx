import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExpenseRequest, useApp, CATEGORY_LIMITS } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";

export function EditExpenseDialog({ 
    expense, 
    open, 
    onOpenChange 
}: { 
    expense: ExpenseRequest | null, 
    open: boolean, 
    onOpenChange: (open: boolean) => void 
}) {
    const { updateExpenseStatus, currentUser, getEmployeeExceptionCount } = useApp();
    const { toast } = useToast();
    
    const [amount, setAmount] = useState<number | string>(0);
    const [category, setCategory] = useState("");
    const [description, setDescription] = useState("");
    const [billDate, setBillDate] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [requestException, setRequestException] = useState(false);

    const exceptionCount = getEmployeeExceptionCount(currentUser?.id || "", new Date().getFullYear());

    useEffect(() => {
        if (expense) {
            setAmount(expense.amount);
            setCategory(expense.category);
            setDescription(expense.description);
            setBillDate(expense.billDate);
            setError(null);
            setRequestException(expense.isException || false);
        }
    }, [expense]);

    useEffect(() => {
        const numAmount = Number(amount);
        if (category && CATEGORY_LIMITS[category]) {
            if (numAmount > CATEGORY_LIMITS[category]) {
                setError(`The maximum allowed amount for ${category} is $${CATEGORY_LIMITS[category]}.`);
            } else {
                setError(null);
                setRequestException(false);
            }
        } else {
            setError(null);
            setRequestException(false);
        }
    }, [amount, category]);

    if (!expense) return null;

    const handleSubmit = () => {
        const numAmount = Number(amount);
        
        // Final validation before submission
        if (category && CATEGORY_LIMITS[category] && numAmount > CATEGORY_LIMITS[category]) {
            if (!requestException) {
                toast({
                    title: "Limit Exceeded",
                    description: `Cannot resubmit. The maximum allowed amount for ${category} is $${CATEGORY_LIMITS[category]}. Check the exception box if you need special approval.`,
                    variant: "destructive"
                });
                return;
            }
            if (exceptionCount >= 5 && (!expense.isException)) {
                 // only block if they weren't already using an exception for this expense
                 toast({
                    title: "Exception Limit Reached",
                    description: `You have already used all 5 of your allowed exceptions for this year.`,
                    variant: "destructive"
                });
                return;
            }
        }

        updateExpenseStatus(expense.id, {
            amount: numAmount,
            category,
            description,
            billDate,
            status: "pending_hod",
            isException: error ? requestException : false,
        });
        
        toast({
            title: "Expense Resubmitted",
            description: "Your expense has been updated and resubmitted for approval."
        });
        
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Revise Expense Request</DialogTitle>
                    <DialogDescription>
                        Update the details of your expense and resubmit it for approval.
                    </DialogDescription>
                </DialogHeader>
                
                {expense.hodComment && (
                    <div className="bg-amber-50 border-l-4 border-amber-500 p-3 my-2 text-sm text-amber-800 rounded-r-md">
                        <span className="font-semibold block mb-1">HoD Feedback:</span>
                        {expense.hodComment}
                    </div>
                )}
                {expense.financeComment && (
                    <div className="bg-amber-50 border-l-4 border-amber-500 p-3 my-2 text-sm text-amber-800 rounded-r-md">
                        <span className="font-semibold block mb-1">Finance Feedback:</span>
                        {expense.financeComment}
                    </div>
                )}

                <div className="grid gap-4 py-4">
                    {error && (
                        <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-lg space-y-3">
                            <div className="flex items-start gap-3 text-destructive">
                                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                <div className="text-sm">
                                    <p className="font-bold uppercase text-[10px] tracking-wider mb-0.5">Policy Limit Exceeded</p>
                                    <p>{error}</p>
                                </div>
                            </div>
                            
                            <div className="pl-7 pt-2 border-t border-destructive/10 flex items-start space-x-2">
                              <Checkbox 
                                id="edit-request-exception" 
                                checked={requestException}
                                onCheckedChange={(checked) => setRequestException(checked === true)}
                                disabled={exceptionCount >= 5 && !expense.isException}
                              />
                              <div className="grid gap-1.5 leading-none">
                                <label
                                  htmlFor="edit-request-exception"
                                  className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${(exceptionCount >= 5 && !expense.isException) ? 'text-destructive font-bold' : ''}`}
                                >
                                  Request Exception for Over-limit Amount
                                </label>
                                <p className="text-xs text-muted-foreground">
                                  You have used {exceptionCount} of 5 exceptions this year.
                                  {(exceptionCount >= 5 && !expense.isException) && " You cannot request any more exceptions."}
                                </p>
                              </div>
                            </div>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Category</label>
                            <Select value={category} onValueChange={setCategory}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(CATEGORY_LIMITS).map(([cat, limit]) => (
                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Amount ($)</label>
                            <Input 
                                type="number" 
                                value={amount} 
                                onChange={(e) => setAmount(e.target.value)} 
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Bill Date</label>
                        <Input 
                            type="date" 
                            value={billDate} 
                            onChange={(e) => setBillDate(e.target.value)} 
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Description</label>
                        <Textarea 
                            value={description} 
                            onChange={(e) => setDescription(e.target.value)} 
                            placeholder="Describe the business purpose..."
                            className="resize-none"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={!!error}>Resubmit</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}