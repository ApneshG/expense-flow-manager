import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/store";
import {
  UserPlus,
  Users,
  Upload,
  Mail,
  Copy,
  CheckCircle,
  XCircle,
  Loader2,
  Trash2,
  Inbox,
  ThumbsUp,
  ThumbsDown,
  Pencil,
} from "lucide-react";
import type { Department } from "@/lib/store";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  departmentId: string;
  status: string;
}

interface Invitation {
  id: number;
  email: string;
  role: string;
  departmentId: string;
  token: string;
  status: string;
  name: string | null;
  createdAt: string;
}

interface InviteRequestItem {
  id: number;
  name: string;
  email: string;
  department: string | null;
  message: string | null;
  status: string;
  createdAt: string;
}

export default function AdminPage() {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();

  const { data: adminData, isLoading } = useQuery<{
    users: AdminUser[];
    invitations: Invitation[];
  }>({
    queryKey: ["/api/admin/users"],
  });

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const { data: inviteRequests = [] } = useQuery<InviteRequestItem[]>({
    queryKey: ["/api/admin/invite-requests"],
  });

  const users = adminData?.users || [];
  const allInvitations = adminData?.invitations || [];
  const pendingRequests = inviteRequests.filter((r) => r.status === "pending");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-admin-title">
          User Management
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage users, roles, and invitations
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p
                  className="text-2xl font-bold"
                  data-testid="text-total-users"
                >
                  {users.length}
                </p>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p
                  className="text-2xl font-bold"
                  data-testid="text-active-users"
                >
                  {users.filter((u) => u.status === "active").length}
                </p>
                <p className="text-sm text-muted-foreground">Active Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <Inbox className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p
                  className="text-2xl font-bold"
                  data-testid="text-pending-requests"
                >
                  {pendingRequests.length}
                </p>
                <p className="text-sm text-muted-foreground">Access Requests</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="flex-wrap">
          <TabsTrigger value="users" data-testid="tab-users">
            Users
          </TabsTrigger>
          <TabsTrigger
            value="requests"
            data-testid="tab-requests"
            className="relative"
          >
            Access Requests
            {pendingRequests.length > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {pendingRequests.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="invite" data-testid="tab-invite">
            Invite User
          </TabsTrigger>
          <TabsTrigger value="bulk" data-testid="tab-bulk">
            Bulk Add
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <UsersTable users={users} departments={departments} />
        </TabsContent>
        <TabsContent value="requests">
          <InviteRequestsTable
            requests={pendingRequests}
            departments={departments}
          />
        </TabsContent>
        <TabsContent value="invite">
          <InviteForm />
        </TabsContent>
        <TabsContent value="bulk">
          <BulkAddForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UsersTable({
  users,
  departments,
}: {
  users: AdminUser[];
  departments: Department[];
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [resetPasswordUser, setResetPasswordUser] = useState<string | null>(
    null,
  );
  const [newPassword, setNewPassword] = useState("");

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<AdminUser>;
    }) => {
      await apiRequest("PATCH", `/api/admin/users/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setEditingUser(null);
      toast({ title: "User updated successfully" });
    },
    onError: (err: any) =>
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      }),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({
      id,
      newPassword,
    }: {
      id: string;
      newPassword: string;
    }) => {
      await apiRequest("POST", `/api/admin/users/${id}/reset-password`, {
        newPassword,
      });
    },
    onSuccess: () => {
      setResetPasswordUser(null);
      setNewPassword("");
      toast({ title: "Password reset successfully" });
    },
    onError: (err: any) =>
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>All Users</CardTitle>
        <CardDescription>
          Manage user name, roles, and account status. Departments are assigned
          in Data Management.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                <TableCell className="font-medium">
                  {editingUser === user.id ? (
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-32"
                      data-testid={`input-name-${user.id}`}
                    />
                  ) : (
                    user.name
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {user.email}
                </TableCell>
                <TableCell>
                  {editingUser === user.id ? (
                    <Select value={editRole} onValueChange={setEditRole}>
                      <SelectTrigger
                        className="w-36"
                        data-testid={`select-role-${user.id}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employee">Employee</SelectItem>
                        <SelectItem value="hod">HoD</SelectItem>
                        <SelectItem value="finance_head">
                          Finance Head
                        </SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline" className="capitalize">
                      {user.role.replace("_", " ")}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {editingUser === user.id ? (
                    <Select value={editStatus} onValueChange={setEditStatus}>
                      <SelectTrigger
                        className="w-28"
                        data-testid={`select-status-${user.id}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge
                      variant={
                        user.status === "active" ? "default" : "secondary"
                      }
                      className="capitalize"
                      data-testid={`badge-status-${user.id}`}
                    >
                      {user.status}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {editingUser === user.id ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() =>
                            updateMutation.mutate({
                              id: user.id,
                              updates: {
                                name: editName,
                                role: editRole,
                                status: editStatus,
                              },
                            })
                          }
                          disabled={updateMutation.isPending}
                          data-testid={`button-save-${user.id}`}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingUser(null)}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingUser(user.id);
                            setEditName(user.name);
                            setEditRole(user.role);
                            setEditStatus(user.status);
                          }}
                          data-testid={`button-edit-${user.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => {
                            if (confirm(`Delete user ${user.name}? This action cannot be undone.`)) {
                              apiRequest("DELETE", `/api/admin/users/${user.id}`).then(() => {
                                queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
                                toast({ title: "User deleted successfully" });
                              }).catch((err) => toast({ title: "Error", description: err.message, variant: "destructive" }));
                            }
                          }}
                          data-testid={`button-delete-${user.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function InviteForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("employee");
  const [departmentId, setDepartmentId] = useState("");
  const [inviteResult, setInviteResult] = useState<{
    token: string;
    email: string;
  } | null>(null);
  const [validationError, setValidationError] = useState("");
  const { data: adminData } = useQuery<{ users: any[] }>({
    queryKey: ["/api/admin/users"],
  });
  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });
  const existingUsers = adminData?.users || [];

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/invite", {
        email,
        role,
        name: name || undefined,
        departmentId: ["employee", "hod"].includes(role) ? departmentId : undefined,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setInviteResult({ token: data.token, email: data.email });
      setEmail("");
      setName("");
      setRole("employee");
      setDepartmentId("");
      toast({ title: "Invitation sent successfully" });
    },
    onError: (err: any) =>
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      }),
  });

  const copyLink = () => {
    if (inviteResult) {
      navigator.clipboard.writeText(
        `${window.location.origin}/register?token=${inviteResult.token}`,
      );
      toast({ title: "Invite link copied to clipboard" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="w-5 h-5" /> Invite New User
        </CardTitle>
        <CardDescription>
          Send an invitation to a new user. They can select their department
          after joining.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setValidationError("");
              if (existingUsers.some(u => u.email.toLowerCase() === email.toLowerCase())) {
                setValidationError(`This user email id already exists: ${email}`);
                return;
              }
              if (["employee", "hod"].includes(role) && !departmentId) {
                setValidationError("Department is required for this role");
                return;
              }
              inviteMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email Address *</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="user@company.com"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setValidationError("");
                }}
                data-testid="input-invite-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-name">Name *</Label>
              <Input
                id="invite-name"
                type="text"
                placeholder="John Doe"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                data-testid="input-invite-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={role} onValueChange={(val) => { setRole(val); setValidationError(""); }}>
                <SelectTrigger data-testid="select-invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="hod">Head of Department</SelectItem>
                  <SelectItem value="finance_head">Finance Head</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {["employee", "hod"].includes(role) && (
              <div className="space-y-2">
                <Label>Department *</Label>
                <Select value={departmentId} onValueChange={setDepartmentId}>
                  <SelectTrigger data-testid="select-invite-dept">
                    <SelectValue placeholder="Select Department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {validationError && <p className="text-sm text-destructive">{validationError}</p>}
            <Button
              type="submit"
              className="w-full"
              disabled={inviteMutation.isPending || !email || !name || !role || (["employee", "hod"].includes(role) && !departmentId) || existingUsers.some(u => u.email.toLowerCase() === email.toLowerCase())}
              data-testid="button-send-invite"
            >
              {inviteMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Mail className="w-4 h-4 mr-2" />
              )}
              Send Invitation
            </Button>
          </form>

          {inviteResult && (
            <div className="p-4 bg-emerald-50 rounded-lg space-y-3 h-fit">
              <div className="flex items-center gap-2 text-emerald-800">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Invitation Created!</span>
              </div>
              <p className="text-sm text-emerald-700">
                Invitation for <strong>{inviteResult.email}</strong>
              </p>
              <div className="space-y-2">
                <p className="text-xs font-medium text-emerald-800">
                  Registration Link:
                </p>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={`${window.location.origin}/register?token=${inviteResult.token}`}
                    className="text-xs bg-white"
                    data-testid="input-invite-link"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={copyLink}
                    data-testid="button-copy-invite-link"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-emerald-600">
                  Share this link with the user to complete their registration.
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function InviteRequestsTable({
  requests,
  departments,
}: {
  requests: InviteRequestItem[];
  departments: Department[];
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [approveRole, setApproveRole] = useState("employee");
  const [approveDept, setApproveDept] = useState("");

  const approveMutation = useMutation({
    mutationFn: async ({
      id,
      role,
      departmentId,
    }: {
      id: number;
      role: string;
      departmentId: string;
    }) => {
      await apiRequest("POST", `/api/admin/invite-requests/${id}/approve`, {
        role,
        departmentId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/invite-requests"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setApprovingId(null);
      toast({ title: "Request approved and invitation sent via email" });
    },
    onError: (err: any) =>
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      }),
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/admin/invite-requests/${id}/reject`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/invite-requests"],
      });
      toast({ title: "Request rejected" });
    },
    onError: (err: any) =>
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Inbox className="w-5 h-5" /> Access Requests
        </CardTitle>
        <CardDescription>
          Review and approve access requests from new users
        </CardDescription>
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No access requests yet
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Department Pref.</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((req) => (
                <TableRow key={req.id} data-testid={`row-request-${req.id}`}>
                  <TableCell className="font-medium">{req.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {req.email}
                  </TableCell>
                  <TableCell>{req.department || "-"}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm">
                    {req.message || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        req.status === "approved"
                          ? "default"
                          : req.status === "rejected"
                            ? "destructive"
                            : "secondary"
                      }
                      className="capitalize"
                      data-testid={`badge-request-status-${req.id}`}
                    >
                      {req.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {req.status === "pending" && (
                      <div className="flex items-center gap-1">
                        <Dialog
                          open={approvingId === req.id}
                          onOpenChange={(open) => {
                            if (!open) setApprovingId(null);
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600"
                              onClick={() => {
                                setApprovingId(req.id);
                                setApproveRole("employee");
                                setApproveDept("");
                              }}
                              data-testid={`button-approve-${req.id}`}
                            >
                              <ThumbsUp className="w-4 h-4 mr-1" /> Approve
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>
                                Approve {req.name}'s Request
                              </DialogTitle>
                              <DialogDescription>
                                Assign a role and department, then an invitation
                                email will be sent to {req.email}.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 pt-4">
                              <div className="space-y-2">
                                <Label>Role</Label>
                                <Select
                                  value={approveRole}
                                  onValueChange={setApproveRole}
                                >
                                  <SelectTrigger data-testid="select-approve-role">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="employee">
                                      Employee
                                    </SelectItem>
                                    <SelectItem value="hod">
                                      Head of Department
                                    </SelectItem>
                                    <SelectItem value="finance_head">
                                      Finance Head
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Department</Label>
                                <Select
                                  value={approveDept}
                                  onValueChange={setApproveDept}
                                >
                                  <SelectTrigger data-testid="select-approve-dept">
                                    <SelectValue placeholder="Select department" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {departments.map((d) => (
                                      <SelectItem key={d.id} value={d.id}>
                                        {d.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <Button
                                className="w-full"
                                onClick={() =>
                                  approveMutation.mutate({
                                    id: req.id,
                                    role: approveRole,
                                    departmentId: approveDept,
                                  })
                                }
                                disabled={
                                  !approveDept || approveMutation.isPending
                                }
                                data-testid="button-confirm-approve"
                              >
                                {approveMutation.isPending ? (
                                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                ) : null}
                                Approve & Send Invitation
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600"
                          onClick={() => rejectMutation.mutate(req.id)}
                          disabled={rejectMutation.isPending}
                          data-testid={`button-reject-${req.id}`}
                        >
                          <ThumbsDown className="w-4 h-4 mr-1" /> Reject
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function BulkAddForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [csvText, setCsvText] = useState("");
  const [mode, setMode] = useState<"invite" | "create">("invite");
  const [defaultRole, setDefaultRole] = useState("employee");
  const [defaultDept, setDefaultDept] = useState("");
  const [results, setResults] = useState<
    { email: string; status: string; error?: string }[] | null
  >(null);
  const [validationError, setValidationError] = useState("");
  const { data: adminData } = useQuery<{ users: any[] }>({
    queryKey: ["/api/admin/users"],
  });
  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });
  const existingUsers = adminData?.users || [];

  const bulkMutation = useMutation({
    mutationFn: async (userList: any[]) => {
      const res = await apiRequest("POST", "/api/admin/bulk-invite", {
        users: userList,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setResults(data.results);
      setCsvText("");
      const success = data.results.filter(
        (r: any) => r.status !== "failed",
      ).length;
      toast({
        title: `Bulk operation completed: ${success}/${data.results.length} successful`,
      });
    },
    onError: (err: any) =>
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      }),
  });

  const handleBulk = () => {
    setValidationError("");
    if (!csvText.trim()) {
      setValidationError("CSV content is required");
      return;
    }
    const lines = csvText
      .trim()
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    
    // Validate each line has at least email and name
    for (const line of lines) {
      const parts = line.split(",").map((p) => p.trim());
      if (!parts[0] || !parts[1]) {
        setValidationError("Each row must have at least email and name");
        return;
      }
    }

    const userList = lines.map((line) => {
      const parts = line.split(",").map((p) => p.trim());
      const email = parts[0];
      const name = parts[1];
      const role = parts[2] || defaultRole;
      const deptId = parts[3] || defaultDept;
      
      const user: any = mode === "create"
        ? { email, name, role, password: "password123" }
        : { email, name, role };
      
      // Add department if role is employee or hod
      if (["employee", "hod"].includes(role) && deptId) {
        user.departmentId = deptId;
      }
      return user;
    });

    // Check for duplicate emails
    const emailsInCsv = new Set(userList.map(u => u.email.toLowerCase()));
    if (emailsInCsv.size !== userList.length) {
      setValidationError("Duplicate emails in CSV");
      return;
    }

    // Check if any email already exists in system
    const duplicateEmail = userList.find(u => existingUsers.some(eu => eu.email.toLowerCase() === u.email.toLowerCase()));
    if (duplicateEmail) {
      setValidationError(`This user email id already exists: ${duplicateEmail.email}`);
      return;
    }

    bulkMutation.mutate(userList);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5" /> Bulk Add Users
        </CardTitle>
        <CardDescription>
          Add multiple users at once via CSV format. Users can select
          departments after joining.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Mode</Label>
            <Select value={mode} onValueChange={(v: any) => setMode(v)}>
              <SelectTrigger data-testid="select-bulk-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="invite">Send Invitations</SelectItem>
                <SelectItem value="create">Create Accounts Directly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Default Role</Label>
            <Select value={defaultRole} onValueChange={(v) => { setDefaultRole(v); setValidationError(""); }}>
              <SelectTrigger data-testid="select-bulk-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="employee">Employee</SelectItem>
                <SelectItem value="hod">HoD</SelectItem>
                <SelectItem value="finance_head">Finance Head</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {["employee", "hod"].includes(defaultRole) && (
          <div className="space-y-2">
            <Label>Default Department</Label>
            <Select value={defaultDept} onValueChange={setDefaultDept}>
              <SelectTrigger data-testid="select-bulk-default-dept">
                <SelectValue placeholder="Select Department (optional)" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Or specify in 4th column per row</p>
          </div>
        )}

        <div className="space-y-2">
          <Label>User List (CSV format)</Label>
          <Textarea
            placeholder={
              ["employee", "hod"].includes(defaultRole)
                ? "email, name, role, department\njohn@company.com, John Smith\njane@company.com, Jane Doe, hod, dept-eng\ntom@company.com, Tom Wilson"
                : "email, name, role\njohn@company.com, John Smith\njane@company.com, Jane Doe, hod\ntom@company.com, Tom Wilson"
            }
            rows={8}
            value={csvText}
            onChange={(e) => { setCsvText(e.target.value); setValidationError(""); }}
            className="font-mono text-sm"
            data-testid="textarea-bulk-csv"
          />
          <p className="text-xs text-muted-foreground">
            One user per line. Format: email, name, role (optional){["employee", "hod"].includes(defaultRole) && ", department (optional)"}. Email and name are required.
            {mode === "create" &&
              " Accounts will be created with default password 'password123'."}
          </p>
          {validationError && <p className="text-sm text-destructive">{validationError}</p>}
        </div>

        <Button
          onClick={handleBulk}
          disabled={bulkMutation.isPending || !csvText.trim()}
          data-testid="button-bulk-submit"
        >
          {bulkMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Upload className="w-4 h-4 mr-2" />
          )}
          {mode === "invite" ? "Send All Invitations" : "Create All Accounts"}
        </Button>

        {results && (
          <div className="mt-4 space-y-2">
            <h4 className="font-medium text-sm">Results:</h4>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {results.map((r, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 text-sm p-2 rounded ${r.status === "failed" ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"}`}
                  data-testid={`result-bulk-${i}`}
                >
                  {r.status === "failed" ? (
                    <XCircle className="w-4 h-4" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  <span className="font-medium">{r.email}</span>
                  <span>
                    - {r.status}
                    {r.error ? `: ${r.error}` : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
