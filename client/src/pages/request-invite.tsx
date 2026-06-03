import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLocation } from "wouter";
import { ArrowLeft, Loader2, CheckCircle, Send } from "lucide-react";
import { useState } from "react";

export default function RequestInvitePage() {
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Live email validation — shown directly below the email field.
  const trimmedEmail = email.trim();
  let emailError = "";
  if (trimmedEmail.length > 0) {
    const hasAt = trimmedEmail.includes("@");
    const hasDot = trimmedEmail.includes(".");
    if (!hasAt && !hasDot) {
      emailError = "Email must contain '@' and '.' (e.g. user@example.com)";
    } else if (!hasAt) {
      emailError = "Email must contain '@' (e.g. user@example.com)";
    } else if (!hasDot) {
      emailError = "Email must contain '.' (e.g. user@example.com)";
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (emailError) return;

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/request-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, department: department || undefined, message: message || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setSuccess(true);
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
          <CardTitle className="text-2xl font-bold" data-testid="text-request-invite-title">Request Access</CardTitle>
          <CardDescription>
            Fill out this form and an admin will review your request
          </CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-emerald-50 text-emerald-800 rounded-lg" data-testid="text-request-success">
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Request submitted!</p>
                  <p className="text-xs mt-1">An admin will review your request and send you an invitation email if approved.</p>
                </div>
              </div>
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => setLocation("/login")}
                data-testid="button-back-to-login"
              >
                Back to Login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md" data-testid="text-request-error">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  data-testid="input-request-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={!!emailError}
                  data-testid="input-request-email"
                />
                {emailError && (
                  <p className="text-sm text-destructive" data-testid="error-request-email">
                    {emailError}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Preferred Department</Label>
                <Input
                  id="department"
                  type="text"
                  placeholder="e.g. Engineering, Marketing, Sales"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  data-testid="input-request-department"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Why do you need access?</Label>
                <Textarea
                  id="message"
                  placeholder="Brief reason for requesting access..."
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  data-testid="input-request-message"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-2"
                disabled={isLoading || !!emailError || !email || !name}
                data-testid="button-submit-request"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                Submit Request
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <p className="mt-8 text-sm text-slate-400">
        &copy; {new Date().getFullYear()} Avi Tech Inc. All rights reserved.
      </p>
    </div>
  );
}
