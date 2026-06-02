import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, AppProvider, useAuth } from "@/lib/store";
import { AppLayout } from "@/components/layout";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import NewExpensePage from "@/pages/new-expense";
import MyExpensesPage from "@/pages/my-expenses";
import ApprovalsPage from "@/pages/approvals";
import OldApprovalsPage from "@/pages/old-approvals";
import FinancePage from "@/pages/finance";
import DraftsPage from "@/pages/drafts";
import AllExpensesPage from "@/pages/all-expenses";
import PolicyPage from "@/pages/policy";
import AdminPage from "@/pages/admin";
import AdminExpensesPage from "@/pages/admin-expenses";
import AdminDataPage from "@/pages/admin-data";
import LoginPage from "@/pages/login";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import RegisterPage from "@/pages/register";
import RequestInvitePage from "@/pages/request-invite";
import { Loader2 } from "lucide-react";

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

function Router() {
  const [location] = useLocation();
  const { isAuthenticated, isAuthLoading, currentUser } = useAuth();

  const publicRoutes = ["/login", "/forgot-password", "/reset-password", "/register", "/request-invite"];
  const isPublicRoute = publicRoutes.some(r => location.startsWith(r));

  if (isPublicRoute) {
    return (
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />
        <Route path="/register" component={RegisterPage} />
        <Route path="/request-invite" component={RequestInvitePage} />
      </Switch>
    );
  }

  if (isAuthLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return (
    <AppProvider>
      <AppLayout>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/new-expense" component={NewExpensePage} />
          <Route path="/drafts" component={DraftsPage} />
          <Route path="/my-expenses" component={MyExpensesPage} />
          <Route path="/approvals" component={ApprovalsPage} />
          <Route path="/old-approvals" component={OldApprovalsPage} />
          <Route path="/finance" component={FinancePage} />
          <Route path="/all-expenses" component={AllExpensesPage} />
          <Route path="/policy" component={PolicyPage} />
          {currentUser?.role === "admin" && (
            <>
              <Route path="/admin" component={AdminPage} />
              <Route path="/admin/expenses" component={AdminExpensesPage} />
              <Route path="/admin/data" component={AdminDataPage} />
            </>
          )}
          <Route component={NotFound} />
        </Switch>
      </AppLayout>
    </AppProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Router />
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
