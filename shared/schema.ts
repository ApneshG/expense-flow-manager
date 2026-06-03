import { pgTable, text, real, boolean, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull(),
  departmentId: text("department_id").notNull(),
  password: text("password").notNull().default("password"),
  status: text("status").notNull().default("active"),
  resetToken: text("reset_token"),
  resetTokenExpiry: text("reset_token_expiry"),
});

export const departments = pgTable("departments", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  hodId: text("hod_id").notNull(),
  annualBudget: real("annual_budget").notNull().default(0),
  spent: real("spent").notNull().default(0),
});

export const expenseCategories = pgTable("expense_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  budgetLimit: real("budget_limit"),
  status: text("status").notNull().default("active"),
});

export const expenses = pgTable("expenses", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id").notNull(),
  departmentId: text("department_id").notNull(),
  hodId: text("hod_id").notNull(),
  billDate: text("bill_date").notNull(),
  amount: real("amount").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  attachmentUrl: text("attachment_url"),
  status: text("status").notNull().default("draft"),
  isException: boolean("is_exception").default(false),
  hodComment: text("hod_comment"),
  hodActionDate: text("hod_action_date"),
  financeComment: text("finance_comment"),
  paymentMode: text("payment_mode"),
  paymentDate: text("payment_date"),
  financeActionDate: text("finance_action_date"),
  createdAt: text("created_at").notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  expenseId: text("expense_id").notNull(),
  action: text("action").notNull(),
  actorId: text("actor_id").notNull(),
  actorName: text("actor_name").notNull(),
  timestamp: text("timestamp").notNull(),
  details: text("details"),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const invitations = pgTable("invitations", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  role: text("role").notNull(),
  departmentId: text("department_id").notNull(),
  token: text("token").notNull().unique(),
  status: text("status").notNull().default("pending"),
  invitedBy: text("invited_by").notNull(),
  name: text("name"),
  createdAt: text("created_at").notNull(),
});

export const inviteRequests = pgTable("invite_requests", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  department: text("department"),
  message: text("message"),
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at").notNull(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const employees = pgTable("employees", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  departmentId: text("department_id").notNull(),
  status: text("status").notNull().default("active"),
});

export const insertInviteRequestSchema = createInsertSchema(inviteRequests).omit({ id: true });
export type InviteRequest = typeof inviteRequests.$inferSelect;
export type InsertInviteRequest = z.infer<typeof insertInviteRequestSchema>;

export const insertEmployeeSchema = createInsertSchema(employees);
export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;

export const insertUserSchema = createInsertSchema(users).omit({ resetToken: true, resetTokenExpiry: true });
export const insertDepartmentSchema = createInsertSchema(departments);
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true, createdAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true });
export const insertSessionSchema = createInsertSchema(sessions);
export const insertInvitationSchema = createInsertSchema(invitations).omit({ id: true });
export const insertCategorySchema = createInsertSchema(expenseCategories).omit({ id: true });

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Department = typeof departments.$inferSelect;
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Invitation = typeof invitations.$inferSelect;
export type InsertInvitation = z.infer<typeof insertInvitationSchema>;
export type ExpenseCategory = typeof expenseCategories.$inferSelect;
export type InsertExpenseCategory = z.infer<typeof insertCategorySchema>;
export type Setting = typeof settings.$inferSelect;

export const CATEGORY_LIMITS: Record<string, number> = {
  "Air Tickets": 2000,
  "Cab/Taxi": 500,
  "Meals": 100,
  "Software": 500,
  "Office": 200,
  "Advertising": 5000,
  "Others": 1000,
};
