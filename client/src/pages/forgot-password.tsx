import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";
import { ArrowLeft, Loader2, CheckCircle, Mail } from "lucide-react";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message);
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
        <CardHeader className="space-y-1 pb-6">
          <Button
            variant="ghost"
            size="sm"
            className="w-fit -ml-2 mb-2"
            onClick={() => setLocation("/login")}
            data-testid="button-back-login"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to login
          </Button>
          <CardTitle className="text-2xl font-bold" data-testid="text-forgot-title">Forgot Password</CardTitle>
          <CardDescription>
            Enter your work email and we'll send you a reset link
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-emerald-50 text-emerald-800 rounded-lg" data-testid="text-forgot-success">
                <Mail className="w-5 h-5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Check your email</p>
                  <p className="text-xs mt-1">If an account with that email exists, we've sent a password reset link to your inbox.</p>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setLocation("/login")}
                data-testid="button-return-login"
              >
                Return to Login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md" data-testid="text-forgot-error">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Work Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="input-forgot-email"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                disabled={isLoading}
                data-testid="button-forgot-submit"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Send Reset Link
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
