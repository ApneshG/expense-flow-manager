import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "./queryClient";

export type UserRole = "employee" | "hod" | "finance_head" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  departmentId: string;
  status?: string;
  avatar?: string;
}

export interface Department {
  id: string;
  name: string;
  hodId: string;
  annualBudget: number;
  spent: number;
}

export type ExpenseStatus = "draft" | "pending_hod" | "rejected_hod" | "pending_finance" | "on_hold" | "paid" | "rejected_finance" | "needs_revision";

export const CATEGORY_LIMITS: Record<string, number> = {
  "Air Tickets": 2000,
  "Cab/Taxi": 500,
  "Meals": 100,
  "Software": 500,
  "Office": 200,
  "Advertising": 5000,
  "Others": 1000,
};

export interface ExpenseRequest {
  id: string;
  employeeId: string;
  departmentId: string;
  hodId: string;
  billDate: string;
  amount: number;
  description: string;
  category: string;
  attachmentUrl?: string;
  status: ExpenseStatus;
  isException?: boolean;
  hodComment?: string;
  hodActionDate?: string;
  financeComment?: string;
  paymentMode?: string;
  paymentDate?: string;
  financeActionDate?: string;
  auditLog: AuditLogEntry[];
  createdAt: string;
}

export interface AuditLogEntry {
  action: string;
  actorId: string;
  actorName: string;
  timestamp: string;
  details?: string;
}

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export async function devLoginAs(userId: string): Promise<{ user: User; token: string }> {
  const res = await fetch("/api/dev/login-as", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) throw new Error("Dev login failed");
  return res.json();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("auth_token"));
  const [devAutoLoginDone, setDevAutoLoginDone] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (import.meta.env.DEV && !localStorage.getItem("auth_token") && !devAutoLoginDone) {
      setDevAutoLoginDone(true);
      devLoginAs("u-admin").then(data => {
        localStorage.setItem("auth_token", data.token);
        setToken(data.token);
        queryClient.setQueryData(["/api/auth/me"], data.user);
      }).catch(() => {});
    }
  }, [devAutoLoginDone, queryClient]);

  const { data: currentUser, isLoading: isAuthLoading, error: authError } = useQuery<User | null>({
    queryKey: ["/api/auth/me"],
    enabled: !!token,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (authError && token) {
      localStorage.removeItem("auth_token");
      setToken(null);
      queryClient.clear();
    }
  }, [authError, token, queryClient]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || "Login failed");
    }
    const data = await res.json();
    localStorage.setItem("auth_token", data.token);
    setToken(data.token);
    queryClient.setQueryData(["/api/auth/me"], data.user);
    queryClient.invalidateQueries();
  }, [queryClient]);

  const logout = useCallback(async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
    } catch {}
    localStorage.removeItem("auth_token");
    setToken(null);
    queryClient.clear();
  }, [queryClient]);

  return (
    <AuthContext.Provider value={{
      currentUser: currentUser || null,
      isAuthenticated: !!token && !!currentUser,
      isAuthLoading: !!token && isAuthLoading,
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export interface ExpenseCategory {
  id: number;
  name: string;
  description?: string;
  budgetLimit: number;
  status: string;
}

interface AppContextType {
  currentUser: User | null;
  setCurrentUser: (user: User) => void;
  users: User[];
  departments: Department[];
  expenses: ExpenseRequest[];
  addExpense: (expense: Omit<ExpenseRequest, "id" | "createdAt" | "auditLog">) => void;
  updateExpenseStatus: (id: string, updates: Partial<ExpenseRequest>) => void;
  deleteExpense: (id: string) => void;
  getDepartmentBudget: (deptId: string) => { allocated: number; spent: number; remaining: number };
  getEmployeeExceptionCount: (employeeId: string, year: number) => number;
  isLoading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: !!currentUser,
  });

  const { data: departments = [], isLoading: deptsLoading } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
    enabled: !!currentUser,
  });

  const { data: expenses = [], isLoading: expensesLoading } = useQuery<ExpenseRequest[]>({
    queryKey: ["/api/expenses"],
    enabled: !!currentUser,
  });

  const isLoading = usersLoading || deptsLoading || expensesLoading;

  const setCurrentUser = useCallback((_user: User) => {}, []);

  const addExpenseMutation = useMutation({
    mutationFn: async (data: Omit<ExpenseRequest, "id" | "createdAt" | "auditLog">) => {
      const user = users.find(u => u.id === data.employeeId);
      const res = await apiRequest("POST", "/api/expenses", {
        ...data,
        actorId: data.employeeId,
        actorName: user?.name || "Employee",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      // A newly raised expense bumps Budget Utilized — refresh dept totals.
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
    },
  });

  const updateExpenseMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ExpenseRequest> & { auditAction?: string; auditActorId?: string; auditActorName?: string; auditDetails?: string } }) => {
      const res = await apiRequest("PATCH", `/api/expenses/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/expenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      // Deleting a counted expense frees up budget — refresh dept totals.
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
    },
  });

  const addExpense = useCallback((newExpenseData: Omit<ExpenseRequest, "id" | "createdAt" | "auditLog">) => {
    addExpenseMutation.mutate(newExpenseData);
  }, [addExpenseMutation]);

  const deleteExpense = useCallback((id: string) => {
    deleteExpenseMutation.mutate(id);
  }, [deleteExpenseMutation]);

  const updateExpenseStatus = useCallback((id: string, updates: Partial<ExpenseRequest>) => {
    const expense = expenses.find(e => e.id === id);
    if (!expense) return;

    let auditAction = "Updated";
    let auditActorId = "system";
    let auditActorName = "System";
    let auditDetails = `Status changed to ${updates.status}`;

    if (updates.status && updates.status !== expense.status) {
      if (updates.status === "pending_finance" || updates.status === "rejected_hod") {
        auditAction = updates.status === "pending_finance" ? "Approved (HoD)" : "Rejected (HoD)";
        auditActorId = expense.hodId;
        auditActorName = users.find(u => u.id === expense.hodId)?.name || "HoD";
        auditDetails = updates.hodComment || auditDetails;
      } else if (["paid", "on_hold", "needs_revision", "rejected_finance"].includes(updates.status)) {
        auditAction = updates.status === "paid" ? "Paid" : (updates.status === "on_hold" ? "Put On Hold" : "Sent Back");
        const financeUser = users.find(u => u.role === "finance_head");
        auditActorId = financeUser?.id || "finance";
        auditActorName = financeUser?.name || "Finance Team";
        auditDetails = updates.financeComment || auditDetails;
      } else if (updates.status === "pending_hod" && expense.status === "draft") {
        auditAction = "Submitted";
        auditActorId = expense.employeeId;
        auditActorName = users.find(u => u.id === expense.employeeId)?.name || "Employee";
        auditDetails = "Draft submitted for approval";
      } else if (updates.status === "draft") {
        auditAction = "Withdrawn";
        auditActorId = expense.employeeId;
        auditActorName = users.find(u => u.id === expense.employeeId)?.name || "Employee";
        auditDetails = "Request withdrawn to drafts";
      }
    }

    const { auditLog, ...cleanUpdates } = updates as any;

    updateExpenseMutation.mutate({
      id,
      updates: {
        ...cleanUpdates,
        auditAction,
        auditActorId,
        auditActorName,
        auditDetails,
      },
    });
  }, [expenses, users, updateExpenseMutation]);

  const getDepartmentBudget = useCallback((deptId: string) => {
    const dept = departments.find((d) => d.id === deptId);
    if (!dept) return { allocated: 0, spent: 0, remaining: 0 };
    return {
      allocated: dept.annualBudget,
      spent: dept.spent,
      remaining: dept.annualBudget - dept.spent,
    };
  }, [departments]);

  const getEmployeeExceptionCount = useCallback((employeeId: string, year: number) => {
    return expenses.filter(
      (e) => e.employeeId === employeeId &&
             e.isException &&
             e.createdAt.startsWith(year.toString()) &&
             e.status !== "rejected_hod" &&
             e.status !== "rejected_finance"
    ).length;
  }, [expenses]);

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        users,
        departments,
        expenses,
        addExpense,
        updateExpenseStatus,
        deleteExpense,
        getDepartmentBudget,
        getEmployeeExceptionCount,
        isLoading,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
