import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";
import { ShieldCheck, Loader2, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/lib/store";
import { useState } from "react";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      if (import.meta.env.DEV) {
        const { devLoginAs } = await import("@/lib/store");
        const data = await devLoginAs("u-admin");
        localStorage.setItem("auth_token", data.token);
        window.location.href = "/";
        return;
      }
      await login(email, password);
      setLocation("/");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="mb-8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-2xl shadow-lg">
          A
        </div>
        <span className="text-3xl font-display font-bold text-slate-900 tracking-tight">Avi Tech</span>
      </div>

      <Card className="w-full max-w-md shadow-xl border-slate-200/60">
        <CardHeader className="space-y-1 pb-6 text-center">
          <CardTitle className="text-2xl font-bold" data-testid="text-login-title">Welcome back</CardTitle>
          <CardDescription>
            Sign in to access your enterprise expense portal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md" data-testid="text-login-error">
                {error}
              </div>
            )}
            {!import.meta.env.DEV && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Work Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@company.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    data-testid="input-email"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <a
                      href="#"
                      onClick={(e) => { e.preventDefault(); setLocation("/forgot-password"); }}
                      className="text-xs text-blue-600 hover:underline"
                      data-testid="link-forgot-password"
                    >
                      Forgot password?
                    </a>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10"
                      data-testid="input-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      data-testid="button-toggle-password"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}
            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-2"
              disabled={isLoading}
              data-testid="button-login"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {import.meta.env.DEV ? "Quick Access (Admin)" : "Sign In"}
            </Button>
          </form>

          <div className="mt-4 text-center space-y-2">
            <div>
              <span className="text-sm text-muted-foreground">Have an invitation? </span>
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); setLocation("/register"); }}
                className="text-sm text-blue-600 hover:underline"
                data-testid="link-register"
              >
                Create your account
              </a>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">New here? </span>
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); setLocation("/request-invite"); }}
                className="text-sm text-blue-600 hover:underline"
                data-testid="link-request-invite"
              >
                Request an invite
              </a>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-center space-x-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Secure Single Sign-On (SSO) Enabled</span>
          </div>
        </CardContent>
      </Card>
      
      <p className="mt-8 text-sm text-slate-400">
        &copy; {new Date().getFullYear()} Avi Tech Inc. All rights reserved.
      </p>
    </div>
  );
}
