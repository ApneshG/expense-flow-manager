import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Info, AlertTriangle, CheckCircle, FileText, Edit3, Save, X, Plus, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface PolicyData {
  generalRules: string[];
  exceptions: string[];
  payoutSLA: string[];
  categories: { name: string; limit: string; documentation: string; rules: string }[];
}

const defaultPolicy: PolicyData = {
  generalRules: [
    "All expenses must be submitted within 30 days.",
    "Receipts are mandatory for all expenses.",
    "Personal expenses will not be reimbursed."
  ],
  exceptions: [
    "Exceptions require HoD + CFO approval.",
    "Lost receipts require a signed declaration."
  ],
  payoutSLA: [
    "HoD Review: within 3 days.",
    "Finance Processing: within 5 days.",
    "Payout: Weekly on Fridays."
  ],
  categories: [
    { name: "Travel", limit: "$2,000", documentation: "Tickets, Boarding Passes, Itinerary", rules: "Economy class only for flights under 6 hours." },
    { name: "Meals", limit: "$100", documentation: "Itemized receipt", rules: "Alcohol is capped at 20% of meal cost." },
    { name: "Accommodation", limit: "$300 / night", documentation: "Hotel Folio/Invoice", rules: "Must use corporate partnered hotels if available." },
    { name: "Equipment", limit: "$500", documentation: "Invoice & Asset Registration", rules: "IT department pre-approval required for hardware." },
    { name: "Software", limit: "$200", documentation: "Invoice", rules: "Annual subscriptions must go through procurement." },
    { name: "Training", limit: "$1,000 / year", documentation: "Certificate of Completion, Invoice", rules: "Must be directly related to current role." },
    { name: "Other", limit: "$50", documentation: "Receipt", rules: "Miscellaneous minor expenses." }
  ]
};

export default function PolicyPage() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [publishedPolicy, setPublishedPolicy] = useState<PolicyData>(defaultPolicy);
  const [draftPolicy, setDraftPolicy] = useState<PolicyData>(defaultPolicy);

  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [localChanges, setLocalChanges] = useState<Partial<PolicyData>>({});

  // Load the published policy from the server so every user sees the same thing.
  const { data: policyResponse } = useQuery<{ policy: PolicyData | null }>({
    queryKey: ["/api/policy"],
  });

  useEffect(() => {
    if (policyResponse?.policy) {
      setPublishedPolicy(policyResponse.policy);
      setDraftPolicy(policyResponse.policy);
    }
  }, [policyResponse]);

  const startEditingSection = (section: string) => {
    setEditingSection(section);
    setLocalChanges({});
  };

  const handleSectionChange = (section: string, value: any) => {
    setLocalChanges({ ...localChanges, [section]: value });
  };

  const handleSaveSection = async () => {
    const updated = { ...draftPolicy, ...localChanges };
    setDraftPolicy(updated);
    toast({ title: "Changes saved locally" });
    setEditingSection(null);
    setLocalChanges({});
  };

  const handleDiscardSection = () => {
    setLocalChanges({});
    setEditingSection(null);
  };

  const handlePublish = async () => {
    try {
      // Persist any unsaved field edits before publishing
      const finalPolicy = { ...draftPolicy, ...localChanges };
      await apiRequest("POST", "/api/policy", { policy: finalPolicy });
      setPublishedPolicy(finalPolicy);
      setDraftPolicy(finalPolicy);
      queryClient.invalidateQueries({ queryKey: ["/api/policy"] });
      toast({ title: "Policy published. All users will see the update on next page load." });
      setEditingSection(null);
      setLocalChanges({});
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const displayPolicy = editingSection ? { ...draftPolicy, ...localChanges } : publishedPolicy;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-display font-bold">Company Expense Policy</h1>
        <p className="text-muted-foreground mt-1">Guidelines, limits, and documentation requirements for corporate expenses.</p>
      </div>

      {/* General Rules Section */}
      <Card className="bg-blue-50/50 border-blue-100">
        <CardHeader className="pb-3 flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-blue-800 text-lg flex items-center gap-2">
              <Info className="w-5 h-5" /> General Rules
            </CardTitle>
          </div>
          {currentUser?.role === "admin" && editingSection !== "generalRules" && (
            <Button size="sm" variant="outline" onClick={() => startEditingSection("generalRules")} data-testid="button-edit-general">
              <Edit3 className="w-4 h-4 mr-1" /> Edit
            </Button>
          )}
        </CardHeader>
        <CardContent className="text-sm text-blue-900/80 space-y-2">
          {editingSection === "generalRules" ? (
            <div className="space-y-3">
              {(localChanges.generalRules || draftPolicy.generalRules).map((rule, idx) => (
                <Input key={idx} value={rule} onChange={(e) => {
                  const updated = [...(localChanges.generalRules || draftPolicy.generalRules)];
                  updated[idx] = e.target.value;
                  handleSectionChange("generalRules", updated);
                }} data-testid={`input-general-rule-${idx}`} />
              ))}
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={handleSaveSection} data-testid="button-save-general">Save</Button>
                <Button size="sm" variant="outline" onClick={handleDiscardSection} data-testid="button-discard-general">Discard</Button>
                <Button size="sm" variant="default" onClick={handlePublish} data-testid="button-publish-general">Publish</Button>
              </div>
            </div>
          ) : (
            displayPolicy.generalRules.map((rule, idx) => <p key={idx}>• {rule}</p>)
          )}
        </CardContent>
      </Card>

      {/* Exceptions Section */}
      <Card className="bg-amber-50/50 border-amber-100">
        <CardHeader className="pb-3 flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-amber-800 text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Exceptions
            </CardTitle>
          </div>
          {currentUser?.role === "admin" && editingSection !== "exceptions" && (
            <Button size="sm" variant="outline" onClick={() => startEditingSection("exceptions")} data-testid="button-edit-exceptions">
              <Edit3 className="w-4 h-4 mr-1" /> Edit
            </Button>
          )}
        </CardHeader>
        <CardContent className="text-sm text-amber-900/80 space-y-2">
          {editingSection === "exceptions" ? (
            <div className="space-y-3">
              {(localChanges.exceptions || draftPolicy.exceptions).map((exc, idx) => (
                <Input key={idx} value={exc} onChange={(e) => {
                  const updated = [...(localChanges.exceptions || draftPolicy.exceptions)];
                  updated[idx] = e.target.value;
                  handleSectionChange("exceptions", updated);
                }} data-testid={`input-exception-${idx}`} />
              ))}
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={handleSaveSection} data-testid="button-save-exceptions">Save</Button>
                <Button size="sm" variant="outline" onClick={handleDiscardSection} data-testid="button-discard-exceptions">Discard</Button>
                <Button size="sm" variant="default" onClick={handlePublish} data-testid="button-publish-exceptions">Publish</Button>
              </div>
            </div>
          ) : (
            displayPolicy.exceptions.map((exc, idx) => <p key={idx}>• {exc}</p>)
          )}
        </CardContent>
      </Card>

      {/* Payout SLA Section */}
      <Card className="bg-emerald-50/50 border-emerald-100">
        <CardHeader className="pb-3 flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-emerald-800 text-lg flex items-center gap-2">
              <CheckCircle className="w-5 h-5" /> Payout SLA
            </CardTitle>
          </div>
          {currentUser?.role === "admin" && editingSection !== "payoutSLA" && (
            <Button size="sm" variant="outline" onClick={() => startEditingSection("payoutSLA")} data-testid="button-edit-sla">
              <Edit3 className="w-4 h-4 mr-1" /> Edit
            </Button>
          )}
        </CardHeader>
        <CardContent className="text-sm text-emerald-900/80 space-y-2">
          {editingSection === "payoutSLA" ? (
            <div className="space-y-3">
              {(localChanges.payoutSLA || draftPolicy.payoutSLA).map((sla, idx) => (
                <Input key={idx} value={sla} onChange={(e) => {
                  const updated = [...(localChanges.payoutSLA || draftPolicy.payoutSLA)];
                  updated[idx] = e.target.value;
                  handleSectionChange("payoutSLA", updated);
                }} data-testid={`input-sla-${idx}`} />
              ))}
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={handleSaveSection} data-testid="button-save-sla">Save</Button>
                <Button size="sm" variant="outline" onClick={handleDiscardSection} data-testid="button-discard-sla">Discard</Button>
                <Button size="sm" variant="default" onClick={handlePublish} data-testid="button-publish-sla">Publish</Button>
              </div>
            </div>
          ) : (
            displayPolicy.payoutSLA.map((sla, idx) => <p key={idx}>• {sla}</p>)
          )}
        </CardContent>
      </Card>

      {/* Category Limits & Requirements Section */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-start justify-between">
          <div>
            <CardTitle>Category Limits & Requirements</CardTitle>
            <CardDescription>Maximum allowed amounts and specific documentation needed per category.</CardDescription>
          </div>
          {currentUser?.role === "admin" && editingSection !== "categories" && (
            <Button size="sm" variant="outline" onClick={() => startEditingSection("categories")} data-testid="button-edit-categories">
              <Edit3 className="w-4 h-4 mr-1" /> Edit
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {editingSection === "categories" ? (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Limit</TableHead>
                    <TableHead>Documentation</TableHead>
                    <TableHead>Rules</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(localChanges.categories || draftPolicy.categories).map((cat, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Input value={cat.name} onChange={(e) => {
                          const updated = [...(localChanges.categories || draftPolicy.categories)];
                          updated[idx].name = e.target.value;
                          handleSectionChange("categories", updated);
                        }} data-testid={`input-cat-name-${idx}`} />
                      </TableCell>
                      <TableCell>
                        <Input value={cat.limit} onChange={(e) => {
                          const updated = [...(localChanges.categories || draftPolicy.categories)];
                          updated[idx].limit = e.target.value;
                          handleSectionChange("categories", updated);
                        }} data-testid={`input-cat-limit-${idx}`} />
                      </TableCell>
                      <TableCell>
                        <Input value={cat.documentation} onChange={(e) => {
                          const updated = [...(localChanges.categories || draftPolicy.categories)];
                          updated[idx].documentation = e.target.value;
                          handleSectionChange("categories", updated);
                        }} data-testid={`input-cat-doc-${idx}`} className="text-xs" />
                      </TableCell>
                      <TableCell>
                        <Input value={cat.rules} onChange={(e) => {
                          const updated = [...(localChanges.categories || draftPolicy.categories)];
                          updated[idx].rules = e.target.value;
                          handleSectionChange("categories", updated);
                        }} data-testid={`input-cat-rules-${idx}`} className="text-xs" />
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => {
                          const updated = (localChanges.categories || draftPolicy.categories).filter((_, i) => i !== idx);
                          handleSectionChange("categories", updated);
                        }} data-testid={`button-delete-cat-${idx}`}>
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button size="sm" variant="outline" onClick={() => {
                const updated = [...(localChanges.categories || draftPolicy.categories), { name: "", limit: "", documentation: "", rules: "" }];
                handleSectionChange("categories", updated);
              }} data-testid="button-add-category">
                <Plus className="w-4 h-4 mr-1" /> Add Category
              </Button>
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={handleSaveSection} data-testid="button-save-categories">Save</Button>
                <Button size="sm" variant="outline" onClick={handleDiscardSection} data-testid="button-discard-categories">Discard</Button>
                <Button size="sm" variant="default" onClick={handlePublish} data-testid="button-publish-categories">Publish</Button>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Limit (per instance)</TableHead>
                  <TableHead>Required Documentation</TableHead>
                  <TableHead>Additional Rules</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayPolicy.categories.map((cat, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{cat.name}</TableCell>
                    <TableCell>{cat.limit}</TableCell>
                    <TableCell>{cat.documentation}</TableCell>
                    <TableCell>{cat.rules}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Download Policy Card */}
      <Card className="bg-slate-50 border-slate-200 border-dashed">
        <CardContent className="py-6 flex flex-col items-center justify-center text-center">
          <FileText className="w-10 h-10 text-slate-400 mb-3" />
          <h3 className="font-semibold text-slate-800">Download Full Policy</h3>
          <p className="text-sm text-slate-500 max-w-md mt-1 mb-4">Get the complete employee expense handbook including all edge cases, foreign exchange guidelines, and vendor terms.</p>
          <button className="text-sm font-medium text-blue-600 hover:text-blue-800 underline underline-offset-4" data-testid="button-download-policy">Download PDF Handbook</button>
        </CardContent>
      </Card>
    </div>
  );
}
