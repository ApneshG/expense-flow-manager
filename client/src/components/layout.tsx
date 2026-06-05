import { 
  CreditCard, 
  LayoutDashboard, 
  PlusCircle, 
  FileText, 
  LogOut, 
  PieChart, 
  Users,
  Settings,
  Bell,
  History,
  ShieldCheck
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useApp, useAuth, devLoginAs } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReactNode, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow, parseISO } from "date-fns";

export function Sidebar() {
  const [location] = useLocation();
  const appContext = useApp();
  
  if (!appContext) return null;
  const { currentUser } = appContext;

  const navItems = [
    { label: "New Expense", href: "/new-expense", icon: PlusCircle, roles: ["employee"] },
    { label: "My Expenses", href: "/my-expenses", icon: CreditCard, roles: ["employee"] },
    { label: "Drafts", href: "/drafts", icon: FileText, roles: ["employee"] },
    { label: "Pending Approvals", href: "/approvals", icon: Users, roles: ["hod"] },
    { label: "Past Approvals", href: "/old-approvals", icon: History, roles: ["hod"] },
    { label: "Dashboard", href: "/", icon: PieChart, roles: ["finance_head"] },
    { label: "Finance Review", href: "/finance", icon: CreditCard, roles: ["finance_head"] },
    { label: "Old Expenses", href: "/all-expenses", icon: History, roles: ["finance_head"] },
    { label: "All Expenses", href: "/admin/expenses", icon: FileText, roles: ["admin"] },
    { label: "Data Management", href: "/admin/data", icon: Settings, roles: ["admin"] },
    { label: "User Management", href: "/admin", icon: ShieldCheck, roles: ["admin"] },
    { label: "Company Policy", href: "/policy", icon: FileText, roles: ["employee", "hod", "finance_head", "admin"] },
  ];

  const filteredNav = navItems.filter(item => item.roles.includes(currentUser?.role || "employee"));

  return (
    <div className="hidden md:flex flex-col w-64 bg-sidebar border-r border-sidebar-border h-screen sticky top-0">
      <div className="p-6">
        <Link href="/">
          <div className="flex items-center gap-3 mb-8 cursor-pointer hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl">
              A
            </div>
            <span className="text-xl font-display font-bold text-sidebar-foreground tracking-tight">Avi Tech</span>
          </div>
        </Link>
        
        <nav className="space-y-1">
          {filteredNav.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div 
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-200 group cursor-pointer",
                    isActive 
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md" 
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon className={cn("w-5 h-5", isActive ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground")} />
                  <span className="font-medium text-sm">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

const DEV_ROLES = [
  { label: "Employee", userId: "u-emp-1", role: "employee", defaultPage: "/" },
  { label: "HoD", userId: "u-hod-eng", role: "hod", defaultPage: "/approvals" },
  { label: "Finance", userId: "u-fin-1", role: "finance_head", defaultPage: "/" },
  { label: "Admin", userId: "u-admin", role: "admin", defaultPage: "/admin" },
] as const;

function DevRoleSwitcher({ currentRole, onSwitch }: { currentRole: string; onSwitch: (userId: string, defaultPage: string) => void }) {
  const [switching, setSwitching] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-amber-400/50 bg-amber-50 dark:bg-amber-950/30" data-testid="dev-role-switcher">
      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mr-1">DEV</span>
      {DEV_ROLES.map((r) => (
        <button
          key={r.role}
          disabled={switching !== null}
          onClick={() => {
            if (r.role === currentRole) return;
            setSwitching(r.role);
            onSwitch(r.userId, r.defaultPage);
          }}
          className={cn(
            "px-2.5 py-1 rounded-full text-[11px] font-medium transition-all",
            r.role === currentRole
              ? "bg-amber-500 text-white shadow-sm"
              : "text-amber-700 dark:text-amber-300 hover:bg-amber-200/60 dark:hover:bg-amber-800/40",
            switching === r.role && "opacity-50"
          )}
          data-testid={`dev-switch-${r.role}`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

export function Topbar() {
  const appContext = useApp();
  const { logout } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  if (!appContext) return null;
  const { currentUser, users, expenses } = appContext;

  const handleLogout = async () => {
    await logout();
    setLocation("/login");
  };

  const handleDevSwitch = async (userId: string, defaultPage: string) => {
    try {
      const data = await devLoginAs(userId);
      localStorage.setItem("auth_token", data.token);
      queryClient.setQueryData(["/api/auth/me"], data.user);
      queryClient.invalidateQueries();
      setLocation(defaultPage);
      window.location.reload();
    } catch {}
  };

  return (
    <header className="h-16 border-b bg-card flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center gap-4 flex-1">
      </div>

      <div className="flex items-center gap-4">
        {import.meta.env.DEV && currentUser && (
          <DevRoleSwitcher currentRole={currentUser.role} onSwitch={handleDevSwitch} />
        )}
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
                <Bell className="w-5 h-5 text-muted-foreground" />
                {(() => {
                    let notifCount = 0;
                    if (currentUser?.role === 'hod') {
                        notifCount = expenses.filter(e => e.hodId === currentUser.id && e.status === 'pending_hod').length;
                    } else if (currentUser?.role === 'finance_head') {
                        notifCount = expenses.filter(e => e.status === 'pending_finance').length;
                    } else if (currentUser?.role === 'employee') {
                        notifCount = expenses.filter(e => e.employeeId === currentUser.id && ['paid', 'rejected_hod', 'rejected_finance', 'needs_revision'].includes(e.status)).length;
                    }
                    
                    if (notifCount > 0) {
                        return (
                            <span className="absolute top-1 right-1 w-4 h-4 bg-destructive text-[9px] font-bold text-destructive-foreground rounded-full flex items-center justify-center border-2 border-card shadow-sm">
                                {notifCount}
                            </span>
                        );
                    }
                    return null;
                })()}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                    <span className="font-semibold text-sm">Notifications</span>
                    <Button variant="ghost" size="sm" className="h-auto px-2 py-1 text-xs text-muted-foreground">Mark all read</Button>
                </div>
                <div className="max-h-[300px] overflow-y-auto py-2">
                    {(() => {
                        let notifications: {id: string, title: string, desc: string, time: string}[] = [];
                        
                        if (currentUser?.role === 'employee') {
                            const relevantExpenses = expenses.filter(e => e.employeeId === currentUser.id && ['paid', 'rejected_hod', 'rejected_finance', 'needs_revision'].includes(e.status));
                            
                            notifications = relevantExpenses.map(e => {
                                let title = "";
                                if (e.status === 'paid') title = "Expense Paid";
                                else if (e.status === 'needs_revision') title = "Revision Requested";
                                else title = "Expense Rejected";
                                
                                return {
                                    id: e.id,
                                    title: title,
                                    desc: `${e.category} - $${e.amount}`,
                                    time: formatDistanceToNow(parseISO(e.hodActionDate || e.financeActionDate || e.createdAt), { addSuffix: true }),
                                };
                            });
                        } else if (currentUser?.role === 'hod') {
                            const pending = expenses.filter(e => e.hodId === currentUser.id && e.status === 'pending_hod');
                            notifications = pending.map(e => ({
                                id: e.id,
                                title: "Pending Approval",
                                desc: `New request from ${users.find(u => u.id === e.employeeId)?.name}: $${e.amount}`,
                                time: formatDistanceToNow(parseISO(e.createdAt), { addSuffix: true }),
                            }));
                        } else if (currentUser?.role === 'finance_head') {
                            const pending = expenses.filter(e => e.status === 'pending_finance');
                            notifications = pending.map(e => ({
                                id: e.id,
                                title: "Finance Review Needed",
                                desc: `Approved request ready for payment: $${e.amount}`,
                                time: formatDistanceToNow(parseISO(e.hodActionDate || e.createdAt), { addSuffix: true }),
                            }));
                        }
                        
                        if (notifications.length === 0) {
                            return <div className="px-4 py-8 text-center text-sm text-muted-foreground">No new notifications</div>;
                        }

                        return notifications.map(n => (
                            <div key={n.id} className="px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer border-l-2 border-primary">
                                <div className="flex justify-between items-start mb-1">
                                    <span className="text-sm font-medium">{n.title}</span>
                                    <span className="text-[10px] text-muted-foreground">{n.time}</span>
                                </div>
                                <p className="text-xs text-muted-foreground">{n.desc}</p>
                            </div>
                        ));
                    })()}
                </div>
            </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
             <Button variant="outline" className="gap-2 hidden sm:flex" data-testid="button-user-menu">
               <Avatar className="h-6 w-6">
                 <AvatarFallback className="text-xs">{currentUser?.name?.charAt(0) || "U"}</AvatarFallback>
               </Avatar>
               <span className="font-medium">{currentUser?.name}</span>
             </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span>{currentUser?.name}</span>
                <span className="text-xs text-muted-foreground font-normal">{currentUser?.email}</span>
                <span className="text-xs text-muted-foreground font-normal capitalize">{currentUser?.role?.replace('_', ' ')}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer" onClick={() => document.getElementById("trigger-settings")?.click()}>
                <Settings className="w-4 h-4 mr-2" />
                <span>Preferences & Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer text-destructive" onClick={handleLogout} data-testid="button-logout">
                <LogOut className="w-4 h-4 mr-2" />
                <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Dialog>
            <DialogTrigger asChild>
                <button id="trigger-settings" className="hidden" />
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>User Settings & Preferences</DialogTitle>
                    <DialogDescription>Manage your account settings, notifications, and workflow configurations.</DialogDescription>
                </DialogHeader>
                
                <div className="space-y-6 py-4">
                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold">General Preferences</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-medium">Default Currency</label>
                                <Select defaultValue="USD">
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="USD">USD ($)</SelectItem>
                                        <SelectItem value="EUR">EUR (€)</SelectItem>
                                        <SelectItem value="GBP">GBP (£)</SelectItem>
                                        <SelectItem value="INR">INR (₹)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {(currentUser?.role === 'hod' || currentUser?.role === 'finance_head') && (
                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold">Workflow Rules</h4>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <label className="text-sm font-medium">Approval Delegation</label>
                                    <p className="text-xs text-muted-foreground">Temporarily assign your approvals</p>
                                </div>
                                <Select defaultValue="none">
                                    <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">No Delegate</SelectItem>
                                        {users.filter(u => u.id !== currentUser?.id && ['hod', 'finance_head'].includes(u.role)).map(u => (
                                            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <label className="text-sm font-medium">Auto-Escalation</label>
                                    <p className="text-xs text-muted-foreground">Forward requests if untouched for:</p>
                                </div>
                                <Select defaultValue="3">
                                    <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Disabled</SelectItem>
                                        <SelectItem value="3">3 Days</SelectItem>
                                        <SelectItem value="5">5 Days</SelectItem>
                                        <SelectItem value="7">7 Days</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    )}

                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold">Notifications</h4>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="email-notif" defaultChecked className="rounded border-gray-300" />
                                <label htmlFor="email-notif" className="text-sm">Email notifications for status changes</label>
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="push-notif" defaultChecked className="rounded border-gray-300" />
                                <label htmlFor="push-notif" className="text-sm">In-app popups and alerts</label>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="flex justify-end pt-4 border-t">
                    <DialogTrigger asChild>
                        <Button>Save Settings</Button>
                    </DialogTrigger>
                </div>
            </DialogContent>
        </Dialog>
      </div>
    </header>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background font-sans text-foreground">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-auto p-6 md:p-8 space-y-8">
          {children}
        </main>
      </div>
    </div>
  );
}
