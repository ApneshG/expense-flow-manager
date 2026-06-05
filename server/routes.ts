import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { CATEGORY_LIMITS } from "@shared/schema";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import {
  sendInvitationEmail,
  sendPasswordResetEmail,
  sendInviteRequestNotification,
  sendExpenseCreatedEmail,
  sendHoDActionEmail,
  sendFinanceNotificationEmail,
  sendFinanceActionEmail
} from "./email";
import { askCopilot, isCopilotConfigured } from "./copilot";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; name: string; email: string; role: string; departmentId: string };
    }
  }
}

async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }
  const session = await storage.getSessionByToken(token);
  if (!session) {
    return res.status(401).json({ message: "Invalid or expired session" });
  }
  const user = await storage.getUser(session.userId);
  if (!user || user.status !== "active") {
    return res.status(401).json({ message: "Account not active" });
  }
  req.user = { id: user.id, name: user.name, email: user.email, role: user.role, departmentId: user.departmentId };
  next();
}

function adminOnly(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  await storage.seedData();

  if (process.env.NODE_ENV === "development") {
    app.post("/api/dev/login-as", async (req, res) => {
      try {
        const { userId } = req.body;
        if (!userId) {
          return res.status(400).json({ message: "userId is required" });
        }
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        const session = await storage.createSession(user.id);
        const { password: _, resetToken: __, resetTokenExpiry: ___, ...safeUser } = user;
        res.json({ user: safeUser, token: session.token });
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    });
  }

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      if (user.status !== "active") {
        return res.status(401).json({ message: "Your account is not active. Please contact the administrator." });
      }
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      const session = await storage.createSession(user.id);
      const { password: _, resetToken: __, resetTokenExpiry: ___, ...safeUser } = user;
      res.json({ user: safeUser, token: session.token });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (token) {
      await storage.deleteSession(token);
    }
    res.json({ success: true });
  });

  app.get("/api/auth/me", authMiddleware, async (req, res) => {
    const user = await storage.getUser(req.user!.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    const { password, resetToken, resetTokenExpiry, ...safeUser } = user;
    res.json(safeUser);
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: "Email is required" });
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.json({ message: "If an account with that email exists, a reset link has been generated." });
      }
      const resetToken = crypto.randomBytes(24).toString("hex");
      const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await storage.updateUser(user.id, { resetToken, resetTokenExpiry });
      await sendPasswordResetEmail(user.email, user.name, resetToken);
      res.json({
        message: "If an account with that email exists, a password reset email has been sent.",
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) {
        return res.status(400).json({ message: "Token and new password are required" });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }
      const allUsers = await storage.getUsers();
      const user = allUsers.find(u => u.resetToken === token);
      if (!user || !user.resetTokenExpiry || new Date(user.resetTokenExpiry) < new Date()) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }
      await storage.updateUser(user.id, { password: newPassword, resetToken: null, resetTokenExpiry: null });
      await storage.deleteUserSessions(user.id);
      res.json({ message: "Password reset successfully. You can now log in with your new password." });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { token, name, password } = req.body;
      if (!token || !name || !password) {
        return res.status(400).json({ message: "Invitation token, name, and password are required" });
      }
      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }
      const invitation = await storage.getInvitationByToken(token);
      if (!invitation || invitation.status !== "pending") {
        return res.status(400).json({ message: "Invalid or already used invitation" });
      }
      const existingUser = await storage.getUserByEmail(invitation.email);
      if (existingUser) {
        return res.status(400).json({ message: "An account with this email already exists" });
      }
      const allUsers = await storage.getUsers();
      if (allUsers.some(u => u.email.toLowerCase() === invitation.email.toLowerCase())) {
        return res.status(400).json({ message: "Email address is already in use" });
      }
      const user = await storage.createUser({
        name,
        email: invitation.email,
        role: invitation.role,
        departmentId: invitation.departmentId,
        password,
        status: "active",
      });
      await storage.updateInvitation(invitation.id, { status: "accepted" });
      const session = await storage.createSession(user.id);
      const { password: _, resetToken: __, resetTokenExpiry: ___, ...safeUser } = user;
      res.status(201).json({ user: safeUser, token: session.token });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/users", authMiddleware, async (_req, res) => {
    const users = await storage.getUsers();
    res.json(users.map(u => {
      const { password, resetToken, resetTokenExpiry, ...rest } = u;
      return rest;
    }));
  });

  app.get("/api/users/:id", authMiddleware, async (req, res) => {
    const user = await storage.getUser(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    const { password, resetToken, resetTokenExpiry, ...rest } = user;
    res.json(rest);
  });

  app.get("/api/departments", authMiddleware, async (_req, res) => {
    const depts = await storage.getDepartments();
    res.json(depts);
  });

  app.get("/api/departments/:id/budget", authMiddleware, async (req, res) => {
    const dept = await storage.getDepartment(req.params.id);
    if (!dept) return res.status(404).json({ message: "Department not found" });
    res.json({
      allocated: dept.annualBudget,
      spent: dept.spent,
      remaining: dept.annualBudget - dept.spent,
    });
  });

  app.get("/api/expenses", authMiddleware, async (_req, res) => {
    const allExpenses = await storage.getExpenses();
    const expensesWithLogs = await Promise.all(
      allExpenses.map(async (exp) => {
        const logs = await storage.getAuditLogs(exp.id);
        return { ...exp, auditLog: logs };
      })
    );
    res.json(expensesWithLogs);
  });

  app.get("/api/expenses/:id", authMiddleware, async (req, res) => {
    const expense = await storage.getExpense(req.params.id);
    if (!expense) return res.status(404).json({ message: "Expense not found" });
    const logs = await storage.getAuditLogs(expense.id);
    res.json({ ...expense, auditLog: logs });
  });

  app.post("/api/expenses", authMiddleware, async (req, res) => {
    try {
      const { actorId, actorName, ...expenseData } = req.body;

      const expense = await storage.createExpense(expenseData);

      const actionLabel = expense.status === "draft" ? "Draft Created" : "Submitted";
      const detailText = expense.status === "draft" ? "Saved as draft" : "Submitted for approval";

      await storage.createAuditLog({
        expenseId: expense.id,
        action: actionLabel,
        actorId: actorId || expense.employeeId,
        actorName: actorName || "Employee",
        timestamp: new Date().toISOString(),
        details: detailText,
      });

      // Send email notifications when expense is submitted (not draft)
      if (expense.status !== "draft") {
        const employee = await storage.getUser(expense.employeeId);
        const hod = await storage.getUser(expense.hodId);
        if (employee?.email && hod?.email) {
          await sendExpenseCreatedEmail(
            employee.email,
            employee.name,
            hod.email,
            hod.name,
            expense.id,
            expense.amount,
            expense.category,
            expense.description,
            expense.billDate
          );
        }
      }

      const logs = await storage.getAuditLogs(expense.id);
      res.status(201).json({ ...expense, auditLog: logs });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/expenses/:id", authMiddleware, async (req, res) => {
    try {
      const expense = await storage.getExpense(req.params.id);
      if (!expense) return res.status(404).json({ message: "Expense not found" });

      const { auditAction, auditActorId, auditActorName, auditDetails, ...updates } = req.body;

      const previousStatus = expense.status;

      const updated = await storage.updateExpense(req.params.id, updates);

      if (auditAction) {
        await storage.createAuditLog({
          expenseId: req.params.id,
          action: auditAction,
          actorId: auditActorId || "system",
          actorName: auditActorName || "System",
          timestamp: new Date().toISOString(),
          details: auditDetails || `Status changed to ${updates.status}`,
        });
      }

      // Note: department.spent is computed dynamically from expense statuses
      // in storage.getDepartments() — no manual increment needed here.

      // Send email notifications based on status change
      const employee = await storage.getUser(expense.employeeId);
      const hod = await storage.getUser(expense.hodId);
      const financeHeads = await storage.getUsers();
      const financeHead = financeHeads.find(u => u.role === "finance_head");

      // HoD action: notify employee
      if (previousStatus === "pending_hod" && updates.status && employee?.email && hod?.email) {
        if (updates.status === "pending_finance" || updates.status === "rejected_hod") {
          await sendHoDActionEmail(
            employee.email,
            employee.name,
            expense.id,
            expense.amount,
            expense.category,
            updates.status,
            hod.name,
            updated.hodComment
          );
        }
      }

      // HoD approved: notify Finance Head
      if (previousStatus === "pending_hod" && updates.status === "pending_finance" && financeHead?.email) {
        await sendFinanceNotificationEmail(
          financeHead.email,
          financeHead.name,
          expense.id,
          expense.amount,
          expense.category,
          employee?.name || "Employee",
          hod?.name || "HoD",
          updated.hodComment
        );
      }

      // Finance action: notify employee
      if (previousStatus === "pending_finance" && updates.status && employee?.email && financeHead?.email) {
        if (updates.status === "paid" || updates.status === "rejected_finance" || updates.status === "needs_revision" || updates.status === "on_hold") {
          await sendFinanceActionEmail(
            employee.email,
            employee.name,
            expense.id,
            expense.amount,
            expense.category,
            updates.status,
            financeHead.name,
            updated.financeComment,
            updated.paymentMode,
            updated.paymentDate
          );
        }
      }

      const logs = await storage.getAuditLogs(req.params.id);
      res.json({ ...updated, auditLog: logs });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/expenses/:id", authMiddleware, async (req, res) => {
    await storage.deleteExpense(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/exceptions/:employeeId/:year", authMiddleware, async (req, res) => {
    const count = await storage.getExceptionCount(
      req.params.employeeId,
      parseInt(req.params.year)
    );
    res.json({ count });
  });

  app.post("/api/admin/invite", authMiddleware, adminOnly, async (req, res) => {
    try {
      const { email, role, name } = req.body;
      if (!email || !role) {
        return res.status(400).json({ message: "Email and role are required" });
      }
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "A user with this email already exists" });
      }
      const invitation = await storage.createInvitation({
        email: email.toLowerCase(),
        role,
        departmentId: "dept-eng",
        name: name || null,
        invitedBy: req.user!.id,
        status: "pending",
      });
      await sendInvitationEmail(email, name || null, role, invitation.token);
      res.status(201).json(invitation);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/admin/bulk-invite", authMiddleware, adminOnly, async (req, res) => {
    try {
      const { users: userList } = req.body;
      if (!Array.isArray(userList) || userList.length === 0) {
        return res.status(400).json({ message: "A list of users is required" });
      }
      const results: { email: string; status: string; error?: string }[] = [];
      for (const u of userList) {
        try {
          if (!u.email || !u.role || !u.name) {
            results.push({ email: u.email || "unknown", status: "failed", error: "Missing required fields (email, name, role)" });
            continue;
          }
          const existing = await storage.getUserByEmail(u.email);
          if (existing) {
            results.push({ email: u.email, status: "failed", error: "User already exists" });
            continue;
          }
          if (u.password) {
            await storage.createUser({
              name: u.name,
              email: u.email,
              role: u.role,
              departmentId: "dept-eng",
              password: u.password,
              status: "active",
            });
            results.push({ email: u.email, status: "created" });
          } else {
            await storage.createInvitation({
              email: u.email.toLowerCase(),
              role: u.role,
              departmentId: "dept-eng",
              name: u.name,
              invitedBy: req.user!.id,
              status: "pending",
            });
            results.push({ email: u.email, status: "invited" });
          }
        } catch (err: any) {
          results.push({ email: u.email || "unknown", status: "failed", error: err.message });
        }
      }
      res.json({ results });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Any authenticated user can read the current company policy
  app.get("/api/policy", authMiddleware, async (_req, res) => {
    try {
      const raw = await storage.getSetting("company_policy");
      res.json({ policy: raw ? JSON.parse(raw) : null });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Only admins can publish a new policy; persists to DB so all users see it
  app.post("/api/policy", authMiddleware, adminOnly, async (req, res) => {
    try {
      const { policy } = req.body;
      if (!policy || typeof policy !== "object") {
        return res.status(400).json({ message: "policy payload is required" });
      }
      await storage.setSetting("company_policy", JSON.stringify(policy));
      res.json({ success: true, message: "Policy published. All users will see the update on next page load." });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ---- Copilot (LLM Q&A over expense data) ----
  app.get("/api/copilot/status", authMiddleware, (_req, res) => {
    res.json({ configured: isCopilotConfigured() });
  });

  app.post("/api/copilot", authMiddleware, async (req, res) => {
    try {
      const { scope, question, history } = req.body || {};
      if (!scope || (scope !== "cfo" && scope !== "hod")) {
        return res.status(400).json({ message: "scope must be 'cfo' or 'hod'" });
      }
      if (!question || typeof question !== "string" || !question.trim()) {
        return res.status(400).json({ message: "question is required" });
      }
      if (question.length > 1000) {
        return res.status(400).json({ message: "question is too long (max 1000 chars)" });
      }
      // Role-scope check: CFO scope -> finance_head or admin; HoD scope -> hod or admin
      const role = req.user!.role;
      if (scope === "cfo" && role !== "finance_head" && role !== "admin") {
        return res.status(403).json({ message: "Only Finance Head or Admin can use the CFO copilot" });
      }
      if (scope === "hod" && role !== "hod" && role !== "admin") {
        return res.status(403).json({ message: "Only an HoD or Admin can use the HoD copilot" });
      }
      const result = await askCopilot({
        scope,
        question: question.trim(),
        history: Array.isArray(history) ? history : [],
        userId: req.user!.id,
      });
      res.json(result);
    } catch (error: any) {
      console.error("[Copilot] route error:", error);
      res.status(500).json({ message: error.message || "Copilot error" });
    }
  });

  app.get("/api/admin/users", authMiddleware, adminOnly, async (_req, res) => {
    const allUsers = await storage.getUsers();
    const allInvitations = await storage.getInvitations();
    res.json({
      users: allUsers.map(u => {
        const { password, resetToken, resetTokenExpiry, ...rest } = u;
        return rest;
      }),
      invitations: allInvitations,
    });
  });

  app.patch("/api/admin/users/:id/role", authMiddleware, adminOnly, async (req, res) => {
    try {
      const { role } = req.body;
      if (!role || !["employee", "hod", "finance_head", "admin"].includes(role)) {
        return res.status(400).json({ message: "Valid role is required" });
      }

      const userToUpdate = await storage.getUser(req.params.id);
      if (!userToUpdate) return res.status(404).json({ message: "User not found" });

      // Note: HoD promotion (demote other HoDs, update dept.hodId, re-route
      // pending approvals) is now centralized in storage.handleRoleSideEffects.

      const oldRole = userToUpdate.role;
      const updated = await storage.updateUser(req.params.id, { role });
      // Sync employees membership and reassign in-flight HoD approvals.
      await storage.handleRoleSideEffects(req.params.id, oldRole, role);
      const { password, resetToken, resetTokenExpiry, ...rest } = updated!;
      res.json(rest);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/admin/users/:id/status", authMiddleware, adminOnly, async (req, res) => {
    try {
      const { status } = req.body;
      if (!status || !["active", "inactive"].includes(status)) {
        return res.status(400).json({ message: "Valid status is required (active or inactive)" });
      }
      const updated = await storage.updateUser(req.params.id, { status });
      if (!updated) return res.status(404).json({ message: "User not found" });
      const { password, resetToken, resetTokenExpiry, ...rest } = updated;
      res.json(rest);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/admin/users/:id", authMiddleware, adminOnly, async (req, res) => {
    try {
      const { name, role, status } = req.body;
      if (!name && !role && !status) {
        return res.status(400).json({ message: "At least one field to update is required" });
      }
      const updates: Partial<any> = {};
      if (name) updates.name = name;
      if (role) {
        if (!["employee", "hod", "finance_head", "admin"].includes(role)) {
          return res.status(400).json({ message: "Invalid role" });
        }
        updates.role = role;
        // HoD-promotion side effects (demote other HoDs, update dept.hodId,
        // re-route pending approvals) are handled in storage.handleRoleSideEffects
        // below.
      }
      if (status) {
        if (!["active", "inactive"].includes(status)) {
          return res.status(400).json({ message: "Invalid status" });
        }
        updates.status = status;
      }
      // Capture old role before update so we can sync side effects after.
      const existing = role ? await storage.getUser(req.params.id) : null;
      const oldRole = existing?.role;
      const updated = await storage.updateUser(req.params.id, updates);
      if (!updated) return res.status(404).json({ message: "User not found" });
      if (role && oldRole) {
        await storage.handleRoleSideEffects(req.params.id, oldRole, role);
      }
      const { password, resetToken, resetTokenExpiry, ...rest } = updated;
      res.json(rest);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/admin/users/:id/department", authMiddleware, adminOnly, async (req, res) => {
    try {
      const { departmentId } = req.body;
      if (!departmentId) {
        return res.status(400).json({ message: "Department ID is required" });
      }
      const updated = await storage.updateUser(req.params.id, { departmentId });
      if (!updated) return res.status(404).json({ message: "User not found" });
      // Keep the employees table row's department in sync so the Employees tab
      // reflects the change immediately.
      const allEmployees = await storage.getEmployees();
      const empRow = allEmployees.find(e => e.userId === req.params.id);
      if (empRow) {
        await storage.updateEmployee(empRow.id, { departmentId });
      }
      const { password, resetToken, resetTokenExpiry, ...rest } = updated;
      res.json(rest);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/admin/users/:id/reset-password", authMiddleware, adminOnly, async (req, res) => {
    try {
      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }
      const updated = await storage.updateUser(req.params.id, { password: newPassword });
      if (!updated) return res.status(404).json({ message: "User not found" });
      await storage.deleteUserSessions(req.params.id);
      res.json({ message: "Password reset successfully" });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/admin/users/:id/email", authMiddleware, adminOnly, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: "Email is required" });
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) return res.status(400).json({ message: "Invalid email format" });
      const normalizedEmail = email.toLowerCase().trim();
      const existingUser = await storage.getUserByEmail(normalizedEmail);
      if (existingUser && existingUser.id !== req.params.id) {
        return res.status(409).json({ message: "Email already in use by another user" });
      }
      const updated = await storage.updateUser(req.params.id, { email: normalizedEmail });
      if (!updated) return res.status(404).json({ message: "User not found" });
      const { password, resetToken, resetTokenExpiry, ...rest } = updated;
      res.json(rest);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/auth/request-invite", async (req, res) => {
    try {
      const { name, email, department, message } = req.body;
      if (!name || !email) {
        return res.status(400).json({ message: "Name and email are required" });
      }
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          message: `Duplicate email id detected. The email id ${email} is already existing. Pls use a different email id`,
        });
      }
      const request = await storage.createInviteRequest({
        name,
        email: email.toLowerCase(),
        department: department || null,
        message: message || null,
        status: "pending",
      });
      const admins = await storage.getAdminUsers();
      for (const admin of admins) {
        await sendInviteRequestNotification(admin.email, name, email, department, message);
      }
      res.status(201).json({ message: "Your request has been submitted. An admin will review it shortly." });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/invite-requests", authMiddleware, adminOnly, async (_req, res) => {
    const requests = await storage.getInviteRequests();
    res.json(requests);
  });

  app.post("/api/admin/invite-requests/:id/approve", authMiddleware, adminOnly, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { role, departmentId } = req.body;
      if (!role || !departmentId) {
        return res.status(400).json({ message: "Role and department are required" });
      }
      const requests = await storage.getInviteRequests();
      const request = requests.find(r => r.id === id);
      if (!request) return res.status(404).json({ message: "Request not found" });
      if (request.status !== "pending") {
        return res.status(400).json({ message: "This request has already been processed" });
      }
      
      // Create the user in Users table
      const newUser = await storage.createUser({
        email: request.email,
        name: request.name || request.email.split("@")[0],
        role,
        departmentId,
        password: "password",
        status: "active",
      });
      
      // Create invitation with password reset link
      const invitation = await storage.createInvitation({
        email: request.email,
        role,
        departmentId,
        name: request.name,
        invitedBy: req.user!.id,
        status: "pending",
      });
      await sendInvitationEmail(request.email, request.name, role, invitation.token);
      
      // Mark request as approved
      await storage.updateInviteRequest(id, { status: "approved" });
      res.json({ message: "Request approved. User created and invitation sent" });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/admin/invite-requests/:id/reject", authMiddleware, adminOnly, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.updateInviteRequest(id, { status: "rejected" });
      res.json({ message: "Request rejected" });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/admin/expenses", authMiddleware, adminOnly, async (_req, res) => {
    const allExpenses = await storage.getExpenses();
    const expensesWithLogs = await Promise.all(
      allExpenses.map(async (exp) => {
        const logs = await storage.getAuditLogs(exp.id);
        return { ...exp, auditLog: logs };
      })
    );
    res.json(expensesWithLogs);
  });

  app.get("/api/categories", authMiddleware, async (_req, res) => {
    const categories = await storage.getCategories();
    res.json(categories);
  });

  app.get("/api/admin/categories", authMiddleware, adminOnly, async (_req, res) => {
    const categories = await storage.getCategories();
    res.json(categories);
  });

  app.post("/api/admin/categories", authMiddleware, adminOnly, async (req, res) => {
    try {
      const category = await storage.createCategory(req.body);
      res.status(201).json(category);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/admin/categories/:id", authMiddleware, adminOnly, async (req, res) => {
    try {
      const category = await storage.updateCategory(parseInt(req.params.id), req.body);
      if (!category) return res.status(404).json({ message: "Category not found" });
      res.json(category);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/admin/categories/:id", authMiddleware, adminOnly, async (req, res) => {
    await storage.deleteCategory(parseInt(req.params.id));
    res.json({ success: true });
  });

  app.post("/api/admin/departments", authMiddleware, adminOnly, async (req, res) => {
    try {
      const dept = await storage.createDepartment(req.body);
      res.status(201).json(dept);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/admin/departments/:id", authMiddleware, adminOnly, async (req, res) => {
    try {
      const dept = await storage.updateDepartment(req.params.id, req.body);
      if (!dept) return res.status(404).json({ message: "Department not found" });
      res.json(dept);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/admin/departments/:id", authMiddleware, adminOnly, async (req, res) => {
    await storage.deleteDepartment(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/admin/employees", authMiddleware, adminOnly, async (_req, res) => {
    const employees = await storage.getEmployees();
    res.json(employees);
  });

  app.post("/api/admin/employees", authMiddleware, adminOnly, async (req, res) => {
    try {
      const user = await storage.createUser(req.body);
      const { password, ...safeUser } = user;
      res.status(201).json(safeUser);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/admin/users/:id", authMiddleware, adminOnly, async (req, res) => {
    if (req.params.id === req.user?.id) {
      return res.status(400).json({ message: "You cannot delete your own admin account" });
    }
    await storage.deleteUser(req.params.id);
    res.json({ success: true });
  });

  return httpServer;
}
