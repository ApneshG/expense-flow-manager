import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Pencil, Trash2, Search } from "lucide-react";
import { User, Department, ExpenseCategory } from "@/lib/store";

export default function AdminDataPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Data Management</h1>
        <p className="text-muted-foreground mt-1">Configure company structure, employees and expense rules.</p>
      </div>

      <Tabs defaultValue="employees">
        <TabsList>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>
        <TabsContent value="employees"><EmployeesManager /></TabsContent>
        <TabsContent value="departments"><DepartmentsManager /></TabsContent>
        <TabsContent value="categories"><CategoriesManager /></TabsContent>
      </Tabs>
    </div>
  );
}

function EmployeesManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<User | null>(null);

  const { data: users = [], isLoading } = useQuery<User[]>({ queryKey: ["/api/users"] });
  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ["/api/departments"] });
  const { data: employees = [] } = useQuery<{ userId: string }[]>({ queryKey: ["/api/admin/employees"] });

  // For the Add Employee dropdown: candidates are non-admin users
  // who are NOT already in the employees table.
  const existingEmployeeUserIds = new Set(employees.map(e => e.userId));
  const employeeAndHoDUsers = users.filter(
    u => u.role !== "admin" && !existingEmployeeUserIds.has(u.id),
  );

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingItem) {
        // Only Department is editable from the Edit Employee dialog now.
        return apiRequest("PATCH", `/api/admin/users/${editingItem.id}/department`, {
          departmentId: data.departmentId,
        });
      }
      return apiRequest("POST", "/api/admin/employees", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      setIsModalOpen(false);
      setEditingItem(null);
      toast({ title: `Employee ${editingItem ? "updated" : "added"} successfully` });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" })
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employees"] });
      toast({ title: "Employee deleted" });
    }
  });

  const filtered = users.filter(u => u.role !== "admin" && (u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())));

  const formatRole = (role: string) =>
    role.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search employees..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {/* "Add Employee" hidden — every non-admin user is auto-added to Employees on creation via Invite User. */}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Dept</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.map(u => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>{formatRole(u.role)}</TableCell>
                <TableCell>{departments.find(d => d.id === u.departmentId)?.name}</TableCell>
                <TableCell className="capitalize">{u.status}</TableCell>
                <TableCell className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => { setEditingItem(u); setIsModalOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => confirm("Delete this employee?") && deleteMutation.mutate(u.id)}><Trash2 className="w-4 h-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingItem ? "Edit" : "Add"} Employee</DialogTitle></DialogHeader>
          <EmployeeForm departments={departments} users={employeeAndHoDUsers} initialData={editingItem} onSubmit={d => mutation.mutate(d)} isPending={mutation.isPending} />
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function EmployeeForm({ departments, users, initialData, onSubmit, isPending }: any) {
  const isEditing = !!initialData;
  const [formData, setFormData] = useState(
    initialData || { name: "", email: "", role: "employee", departmentId: "", status: "active" },
  );

  const handleEmailChange = (selectedEmail: string) => {
    const selectedUser = users.find((u: any) => u.email === selectedEmail);
    if (selectedUser) {
      setFormData({
        name: selectedUser.name,
        email: selectedUser.email,
        role: selectedUser.role,
        departmentId: selectedUser.departmentId,
        status: "active",
      });
    }
  };

  const formatRole = (role: string) =>
    role.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(formData); }} className="space-y-4 pt-4">
      <div className="space-y-2">
        <Label>Email{isEditing ? "" : " (from Users) *"}</Label>
        {isEditing ? (
          <Input disabled value={formData.email} />
        ) : (
          <Select value={formData.email} onValueChange={handleEmailChange}>
            <SelectTrigger><SelectValue placeholder="Select Employee Email" /></SelectTrigger>
            <SelectContent>
              {users.map((u: any) => (
                <SelectItem key={u.id} value={u.email}>{u.email} ({u.name})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="space-y-2">
        <Label>Name</Label>
        <Input disabled value={formData.name} />
      </div>
      <div className="space-y-2">
        <Label>Department{isEditing ? " *" : ""}</Label>
        {isEditing ? (
          <Select
            value={formData.departmentId}
            onValueChange={(v) => setFormData({ ...formData, departmentId: v })}
          >
            <SelectTrigger><SelectValue placeholder="Select Department" /></SelectTrigger>
            <SelectContent>
              {departments.map((d: any) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input disabled value={departments.find((d: any) => d.id === formData.departmentId)?.name || "-"} />
        )}
      </div>
      <div className="space-y-2">
        <Label>Role</Label>
        <Input disabled value={formatRole(formData.role)} />
      </div>
      <Button
        type="submit"
        className="w-full"
        disabled={isPending || (isEditing ? !formData.departmentId : !formData.email)}
      >
        {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Save Employee
      </Button>
    </form>
  );
}

function DepartmentsManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Department | null>(null);

  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ["/api/departments"] });
  const { data: users = [] } = useQuery<User[]>({ queryKey: ["/api/users"] });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingItem) return apiRequest("PATCH", `/api/admin/departments/${editingItem.id}`, data);
      return apiRequest("POST", "/api/admin/departments", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setIsModalOpen(false);
      setEditingItem(null);
      toast({ title: "Department saved successfully" });
    }
  });

  const filtered = departments.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <Input placeholder="Search departments..." className="w-72" value={search} onChange={e => setSearch(e.target.value)} />
        <Button onClick={() => { setEditingItem(null); setIsModalOpen(true); }}><Plus className="w-4 h-4 mr-2" /> Add Department</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Name</TableHead><TableHead>HoD</TableHead><TableHead>Budget</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.map(d => (
              <TableRow key={d.id}>
                <TableCell className="text-xs font-mono">{d.id}</TableCell>
                <TableCell className="font-medium">{d.name}</TableCell>
                <TableCell>{users.find(u => u.id === d.hodId)?.name || d.hodId}</TableCell>
                <TableCell>${d.annualBudget.toLocaleString()}</TableCell>
                <TableCell className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => { setEditingItem(d); setIsModalOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => confirm("Delete department?") && apiRequest("DELETE", `/api/admin/departments/${d.id}`).then(() => queryClient.invalidateQueries({ queryKey: ["/api/departments"] }))}><Trash2 className="w-4 h-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingItem ? "Edit" : "Add"} Department</DialogTitle></DialogHeader>
          <DeptForm users={users} initialData={editingItem} onSubmit={(d: any) => mutation.mutate(d)} isPending={mutation.isPending} />
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function DeptForm({ users, initialData, onSubmit, isPending }: any) {
  const [formData, setFormData] = useState(initialData || { id: `dept-${Date.now()}`, name: "", hodId: "", annualBudget: 0 });
  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(formData); }} className="space-y-4 pt-4">
      <div className="space-y-2"><Label>ID (auto-generated)</Label><Input disabled required value={formData.id} /></div>
      <div className="space-y-2"><Label>Name *</Label><Input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
      <div className="space-y-2">
        <Label>Head of Department *</Label>
        <Select value={formData.hodId} onValueChange={v => setFormData({ ...formData, hodId: v })}>
          <SelectTrigger><SelectValue placeholder="Select HoD" /></SelectTrigger>
          <SelectContent>{users.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2"><Label>Annual Budget ($) *</Label><Input type="number" required value={formData.annualBudget} onChange={e => setFormData({ ...formData, annualBudget: parseFloat(e.target.value) })} /></div>
      <Button type="submit" className="w-full" disabled={isPending}>{isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Save Department</Button>
    </form>
  );
}

function CategoriesManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ExpenseCategory | null>(null);

  const { data: categories = [] } = useQuery<ExpenseCategory[]>({ queryKey: ["/api/admin/categories"] });
  const sortedCategories = [...categories].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingItem) return apiRequest("PATCH", `/api/admin/categories/${editingItem.id}`, data);
      return apiRequest("POST", "/api/admin/categories", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/categories"] });
      setIsModalOpen(false);
      toast({ title: "Category saved" });
    }
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm">Expense Categories</CardTitle>
        <Button size="sm" onClick={() => { setEditingItem(null); setIsModalOpen(true); }}><Plus className="w-4 h-4 mr-2" /> Add Category</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Limit</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead><TableHead>Description</TableHead></TableRow></TableHeader>
          <TableBody>
            {sortedCategories.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>${c.budgetLimit?.toLocaleString() || "-"}</TableCell>
                <TableCell className="capitalize">{c.status}</TableCell>
                <TableCell className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => { setEditingItem(c); setIsModalOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => confirm("Delete category?") && apiRequest("DELETE", `/api/admin/categories/${c.id}`).then(() => queryClient.invalidateQueries({ queryKey: ["/api/admin/categories"] }))}><Trash2 className="w-4 h-4" /></Button>
                </TableCell>
                <TableCell className="max-w-xs truncate text-muted-foreground" title={c.description || ""}>{c.description || "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Category</DialogTitle></DialogHeader>
          <CategoryForm initialData={editingItem} onSubmit={(d: any) => mutation.mutate(d)} />
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function CategoryForm({ initialData, onSubmit }: any) {
  const [formData, setFormData] = useState(initialData || { name: "", description: "", budgetLimit: 0, status: "active" });
  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(formData); }} className="space-y-4">
      <div className="space-y-2"><Label>Name *</Label><Input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
      <div className="space-y-2"><Label>Limit ($) *</Label><Input type="number" required value={formData.budgetLimit} onChange={e => setFormData({ ...formData, budgetLimit: parseFloat(e.target.value) })} /></div>
      <div className="space-y-2">
        <Label>Category Description</Label>
        <Textarea
          rows={4}
          placeholder="Describe what this category covers — e.g. allowed expense types, examples, policy notes…"
          value={formData.description || ""}
          onChange={e => setFormData({ ...formData, description: e.target.value })}
        />
      </div>
      <Button type="submit" className="w-full">Save</Button>
    </form>
  );
}
