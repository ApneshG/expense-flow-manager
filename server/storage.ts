import { eq, and, sql, desc } from "drizzle-orm";
import { db } from "./db";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import {
  users, departments, expenses, auditLogs, sessions, invitations, inviteRequests, expenseCategories, employees,
  type User, type InsertUser,
  type Department, type InsertDepartment,
  type Expense, type InsertExpense,
  type AuditLog, type InsertAuditLog,
  type Session, type InsertSession,
  type Invitation, type InsertInvitation,
  type InviteRequest, type InsertInviteRequest,
  type ExpenseCategory, type InsertExpenseCategory,
  type Employee, type InsertEmployee,
} from "@shared/schema";

export interface IStorage {
  getUsers(): Promise<User[]>;
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: Omit<InsertUser, "id"> & { id?: string }): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;
  
  getDepartments(): Promise<Department[]>;
  getDepartment(id: string): Promise<Department | undefined>;
  createDepartment(data: InsertDepartment): Promise<Department>;
  updateDepartment(id: string, updates: Partial<Department>): Promise<Department | undefined>;
  deleteDepartment(id: string): Promise<void>;
  updateDepartmentSpent(id: string, amount: number): Promise<void>;
  
  getExpenses(): Promise<Expense[]>;
  getExpense(id: string): Promise<Expense | undefined>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  updateExpense(id: string, updates: Partial<Expense>): Promise<Expense | undefined>;
  deleteExpense(id: string): Promise<void>;
  
  getCategories(): Promise<ExpenseCategory[]>;
  getCategory(id: number): Promise<ExpenseCategory | undefined>;
  createCategory(data: InsertExpenseCategory): Promise<ExpenseCategory>;
  updateCategory(id: number, updates: Partial<ExpenseCategory>): Promise<ExpenseCategory | undefined>;
  deleteCategory(id: number): Promise<void>;

  getAuditLogs(expenseId: string): Promise<AuditLog[]>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getExceptionCount(employeeId: string, year: number): Promise<number>;
  createSession(userId: string): Promise<Session>;
  getSessionByToken(token: string): Promise<Session | undefined>;
  deleteSession(token: string): Promise<void>;
  deleteUserSessions(userId: string): Promise<void>;
  createInvitation(data: Omit<InsertInvitation, "token" | "createdAt">): Promise<Invitation>;
  getInvitations(): Promise<Invitation[]>;
  getInvitationByToken(token: string): Promise<Invitation | undefined>;
  updateInvitation(id: number, updates: Partial<Invitation>): Promise<void>;
  createInviteRequest(data: Omit<InsertInviteRequest, "createdAt">): Promise<InviteRequest>;
  getInviteRequests(): Promise<InviteRequest[]>;
  updateInviteRequest(id: number, updates: Partial<InviteRequest>): Promise<InviteRequest | undefined>;
  getAdminUsers(): Promise<User[]>;
  getEmployees(): Promise<Employee[]>;
  getEmployee(id: string): Promise<Employee | undefined>;
  createEmployee(data: InsertEmployee): Promise<Employee>;
  updateEmployee(id: string, updates: Partial<Employee>): Promise<Employee | undefined>;
  deleteEmployee(id: string): Promise<void>;
  seedData(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return user;
  }

  async createUser(data: Omit<InsertUser, "id"> & { id?: string }): Promise<User> {
    const id = data.id || `u-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const hashedPassword = await bcrypt.hash(data.password || "password", 10);
    const [user] = await db.insert(users).values({
      ...data,
      id,
      email: data.email.toLowerCase(),
      password: hashedPassword,
      status: data.status || "active",
    }).returning();
    
    // Auto-add to employees table if role is employee or hod
    if (["employee", "hod"].includes(user.role)) {
      try {
        await db.insert(employees).values({
          id: `emp-${user.id}`,
          userId: user.id,
          name: user.name,
          email: user.email,
          departmentId: user.departmentId,
          status: "active",
        }).onConflictDoNothing();
      } catch (err) {
        console.error("Error adding employee:", err);
      }
    }
    
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10);
    }
    if (updates.email) {
      updates.email = updates.email.toLowerCase();
    }
    const [user] = await db.update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    await this.deleteUserSessions(id);
    await db.delete(users).where(eq(users.id, id));
  }

  async getDepartments(): Promise<Department[]> {
    return await db.select().from(departments);
  }

  async getDepartment(id: string): Promise<Department | undefined> {
    const [dept] = await db.select().from(departments).where(eq(departments.id, id));
    return dept;
  }

  async createDepartment(data: InsertDepartment): Promise<Department> {
    const [dept] = await db.insert(departments).values(data).returning();
    return dept;
  }

  async updateDepartment(id: string, updates: Partial<Department>): Promise<Department | undefined> {
    const [dept] = await db.update(departments).set(updates).where(eq(departments.id, id)).returning();
    return dept;
  }

  async deleteDepartment(id: string): Promise<void> {
    await db.delete(departments).where(eq(departments.id, id));
  }

  async getEmployees(): Promise<Employee[]> {
    return await db.select().from(employees);
  }

  async getEmployee(id: string): Promise<Employee | undefined> {
    const [emp] = await db.select().from(employees).where(eq(employees.id, id));
    return emp;
  }

  async createEmployee(data: InsertEmployee): Promise<Employee> {
    const [emp] = await db.insert(employees).values(data).returning();
    return emp;
  }

  async updateEmployee(id: string, updates: Partial<Employee>): Promise<Employee | undefined> {
    const [emp] = await db.update(employees).set(updates).where(eq(employees.id, id)).returning();
    return emp;
  }

  async deleteEmployee(id: string): Promise<void> {
    await db.delete(employees).where(eq(employees.id, id));
  }

  async updateDepartmentSpent(id: string, amount: number): Promise<void> {
    await db.update(departments)
      .set({ spent: sql`${departments.spent} + ${amount}` })
      .where(eq(departments.id, id));
  }

  async getExpenses(): Promise<Expense[]> {
    return await db.select().from(expenses).orderBy(desc(expenses.createdAt));
  }

  async getExpense(id: string): Promise<Expense | undefined> {
    const [expense] = await db.select().from(expenses).where(eq(expenses.id, id));
    return expense;
  }

  async createExpense(data: InsertExpense): Promise<Expense> {
    const id = `exp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const [expense] = await db.insert(expenses).values({
      ...data,
      id,
      createdAt: new Date().toISOString(),
    }).returning();
    return expense;
  }

  async updateExpense(id: string, updates: Partial<Expense>): Promise<Expense | undefined> {
    const { id: _, ...updateData } = updates;
    const [expense] = await db.update(expenses)
      .set(updateData)
      .where(eq(expenses.id, id))
      .returning();
    return expense;
  }

  async deleteExpense(id: string): Promise<void> {
    await db.delete(auditLogs).where(eq(auditLogs.expenseId, id));
    await db.delete(expenses).where(eq(expenses.id, id));
  }

  async getCategories(): Promise<ExpenseCategory[]> {
    return await db.select().from(expenseCategories);
  }

  async getCategory(id: number): Promise<ExpenseCategory | undefined> {
    const [cat] = await db.select().from(expenseCategories).where(eq(expenseCategories.id, id));
    return cat;
  }

  async createCategory(data: InsertExpenseCategory): Promise<ExpenseCategory> {
    const [cat] = await db.insert(expenseCategories).values(data).returning();
    return cat;
  }

  async updateCategory(id: number, updates: Partial<ExpenseCategory>): Promise<ExpenseCategory | undefined> {
    const [cat] = await db.update(expenseCategories).set(updates).where(eq(expenseCategories.id, id)).returning();
    return cat;
  }

  async deleteCategory(id: number): Promise<void> {
    await db.delete(expenseCategories).where(eq(expenseCategories.id, id));
  }

  async getAuditLogs(expenseId: string): Promise<AuditLog[]> {
    return await db.select().from(auditLogs)
      .where(eq(auditLogs.expenseId, expenseId));
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [entry] = await db.insert(auditLogs).values(log).returning();
    return entry;
  }

  async getExceptionCount(employeeId: string, year: number): Promise<number> {
    const allExpenses = await db.select().from(expenses)
      .where(eq(expenses.employeeId, employeeId));

    return allExpenses.filter(e =>
      e.isException &&
      e.createdAt.startsWith(year.toString()) &&
      e.status !== "rejected_hod" &&
      e.status !== "rejected_finance"
    ).length;
  }

  async createSession(userId: string): Promise<Session> {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const id = `sess-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const [session] = await db.insert(sessions).values({
      id,
      userId,
      token,
      expiresAt,
      createdAt: new Date().toISOString(),
    }).returning();
    return session;
  }

  async getSessionByToken(token: string): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions).where(eq(sessions.token, token));
    if (session && new Date(session.expiresAt) < new Date()) {
      await db.delete(sessions).where(eq(sessions.id, session.id));
      return undefined;
    }
    return session;
  }

  async deleteSession(token: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.token, token));
  }

  async deleteUserSessions(userId: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.userId, userId));
  }

  async createInvitation(data: Omit<InsertInvitation, "token" | "createdAt">): Promise<Invitation> {
    const token = crypto.randomBytes(24).toString("hex");
    const [inv] = await db.insert(invitations).values({
      ...data,
      token,
      createdAt: new Date().toISOString(),
    }).returning();
    return inv;
  }

  async getInvitations(): Promise<Invitation[]> {
    return await db.select().from(invitations);
  }

  async getInvitationByToken(token: string): Promise<Invitation | undefined> {
    const [inv] = await db.select().from(invitations).where(eq(invitations.token, token));
    return inv;
  }

  async updateInvitation(id: number, updates: Partial<Invitation>): Promise<void> {
    await db.update(invitations)
      .set(updates)
      .where(eq(invitations.id, id));
  }

  async createInviteRequest(data: Omit<InsertInviteRequest, "createdAt">): Promise<InviteRequest> {
    const [req] = await db.insert(inviteRequests).values({
      ...data,
      createdAt: new Date().toISOString(),
    }).returning();
    return req;
  }

  async getInviteRequests(): Promise<InviteRequest[]> {
    return await db.select().from(inviteRequests);
  }

  async updateInviteRequest(id: number, updates: Partial<InviteRequest>): Promise<InviteRequest | undefined> {
    const [req] = await db.update(inviteRequests)
      .set(updates)
      .where(eq(inviteRequests.id, id))
      .returning();
    return req;
  }

  async getAdminUsers(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, "admin"));
  }

  async seedData(): Promise<void> {
    const existingUsers = await db.select().from(users);
    const hash = await bcrypt.hash("password", 10);

    // Seed Categories if empty
    const existingCategories = await db.select().from(expenseCategories);
    if (existingCategories.length === 0) {
      const CATEGORY_LIMITS: Record<string, number> = {
        "Air Tickets": 2000,
        "Cab/Taxi": 500,
        "Meals": 100,
        "Software": 500,
        "Office": 200,
        "Advertising": 5000,
        "Others": 1000,
      };
      await db.insert(expenseCategories).values(
        Object.entries(CATEGORY_LIMITS).map(([name, limit]) => ({
          name,
          budgetLimit: limit,
          status: "active",
        }))
      );
    }

    if (existingUsers.length > 0) {
      const usersWithoutPassword = existingUsers.filter(u => !u.password);
      for (const u of usersWithoutPassword) {
        await db.update(users).set({ password: hash, status: "active" }).where(eq(users.id, u.id));
      }
      const adminEmail = process.env.ADMIN_EMAIL || "akshatgera@gmail.com";
      const adminExists = existingUsers.some(u => u.role === "admin");
      if (!adminExists) {
        const existingByEmail = existingUsers.find(u => u.email === adminEmail);
        if (existingByEmail) {
          await db.update(users).set({ role: "admin", password: hash, status: "active" }).where(eq(users.id, existingByEmail.id));
        } else {
          await db.insert(users).values({
            id: "u-admin", name: "Admin", email: adminEmail, role: "admin",
            departmentId: existingUsers[0]?.departmentId || "dept-eng", password: hash, status: "active",
          });
        }
      }
      
      // Ensure u-hod-eng exists
      const hodEng = existingUsers.find(u => u.id === "u-hod-eng");
      if (!hodEng) {
        const existingByEmail = existingUsers.find(u => u.email === "sarah@avitech.com");
        if (existingByEmail) {
          await db.update(users).set({ id: "u-hod-eng", role: "hod", departmentId: "dept-eng", status: "active" }).where(eq(users.id, existingByEmail.id));
        } else {
          await db.insert(users).values({
            id: "u-hod-eng", name: "Sarah CTO", email: "sarah@avitech.com", role: "hod",
            departmentId: "dept-eng", password: hash, status: "active",
          });
        }
      }
      
      const apneshEmail = "apneshg@gmail.com";
      let apnesh = existingUsers.find(u => u.email === apneshEmail);
      if (!apnesh) {
        [apnesh] = await db.insert(users).values({
          id: "u-apnesh", name: "Apnesh G", email: apneshEmail, role: "hod",
          departmentId: "dept-mkt", password: hash, status: "active",
        }).returning();
      } else {
        await db.update(users).set({ role: "hod", departmentId: "dept-mkt", status: "active" }).where(eq(users.id, apnesh.id));
      }
      await db.update(departments).set({ hodId: apnesh.id }).where(eq(departments.name, "Marketing"));
      
      // Seed dummy invite requests for testing (always seed these, not just on first init)
      const existingRequests = await db.select().from(inviteRequests).where(eq(inviteRequests.status, "pending"));
      if (existingRequests.length === 0) {
        await db.insert(inviteRequests).values([
          {
            name: "Priya Designer",
            email: "priya@example.com",
            department: "Design",
            message: "Looking for design tools access",
            status: "pending",
            createdAt: new Date().toISOString(),
          },
          {
            name: "Raj Developer",
            email: "raj@example.com",
            department: "Engineering",
            message: "Need access to code repository",
            status: "pending",
            createdAt: new Date().toISOString(),
          },
          {
            name: "Zara Manager",
            email: "zara@example.com",
            department: "Sales",
            message: "Onboarding new sales manager",
            status: "pending",
            createdAt: new Date().toISOString(),
          },
        ]).onConflictDoNothing();
      }
      
      return;
    }

    await db.insert(users).values([
      { id: "u-admin", name: "Admin", email: process.env.ADMIN_EMAIL || "akshatgera@gmail.com", role: "admin", departmentId: "dept-eng", password: hash, status: "active" },
      { id: "u-emp-1", name: "Alice Engineer", email: "alice@avitech.com", role: "employee", departmentId: "dept-eng", password: hash, status: "active" },
      { id: "u-emp-2", name: "Bob Marketer", email: "bob@avitech.com", role: "employee", departmentId: "dept-mkt", password: hash, status: "active" },
      { id: "u-hod-eng", name: "Sarah CTO", email: "sarah@avitech.com", role: "hod", departmentId: "dept-eng", password: hash, status: "active" },
      { id: "u-apnesh", name: "Apnesh G", email: "apneshg@gmail.com", role: "hod", departmentId: "dept-mkt", password: hash, status: "active" },
      { id: "u-hod-sales", name: "Jenny VP Sales", email: "jenny@avitech.com", role: "hod", departmentId: "dept-sales", password: hash, status: "active" },
      { id: "u-fin-1", name: "David CFO", email: "david@avitech.com", role: "finance_head", departmentId: "dept-eng", password: hash, status: "active" },
    ]);

    await db.insert(departments).values([
      { id: "dept-eng", name: "Engineering", hodId: "u-hod-eng", annualBudget: 150000, spent: 45200 },
      { id: "dept-mkt", name: "Marketing", hodId: "u-apnesh", annualBudget: 80000, spent: 32100 },
      { id: "dept-sales", name: "Sales", hodId: "u-hod-sales", annualBudget: 60000, spent: 28500 },
    ]);

    const now = new Date();
    const sub = (days: number) => new Date(now.getTime() - days * 86400000).toISOString();
    const subDate = (days: number) => new Date(now.getTime() - days * 86400000).toISOString().split("T")[0];

    await db.insert(expenses).values([
      {
        id: "exp-1",
        employeeId: "u-emp-1",
        departmentId: "dept-eng",
        hodId: "u-hod-eng",
        billDate: subDate(5),
        amount: 1200,
        description: "Cloud Server Hosting Fees",
        category: "Software",
        status: "paid",
        hodComment: "Approved as per annual plan",
        hodActionDate: subDate(4),
        financeComment: "Processed via Wire Transfer",
        paymentMode: "Wire Transfer",
        paymentDate: subDate(2),
        financeActionDate: sub(2),
        createdAt: sub(5),
      },
      {
        id: "exp-2",
        employeeId: "u-emp-1",
        departmentId: "dept-eng",
        hodId: "u-hod-eng",
        billDate: subDate(10),
        amount: 350,
        description: "Team Lunch",
        category: "Meals",
        status: "pending_hod",
        createdAt: sub(10),
      },
      {
        id: "exp-3",
        employeeId: "u-emp-2",
        departmentId: "dept-mkt",
        hodId: "u-apnesh",
        billDate: subDate(2),
        amount: 2500,
        description: "Q3 Ad Campaign Assets",
        category: "Advertising",
        status: "pending_finance",
        hodComment: "Looks good, within budget.",
        hodActionDate: subDate(1),
        createdAt: sub(2),
      },
    ]);

    await db.insert(auditLogs).values([
      { expenseId: "exp-1", action: "Created", actorId: "u-emp-1", actorName: "Alice Engineer", timestamp: sub(5), details: "Expense submitted" },
      { expenseId: "exp-1", action: "Approved", actorId: "u-hod-eng", actorName: "Sarah CTO", timestamp: sub(4), details: "Approved as per annual plan" },
      { expenseId: "exp-1", action: "Paid", actorId: "u-fin-1", actorName: "David CFO", timestamp: sub(2), details: "Processed via Wire Transfer" },
      { expenseId: "exp-2", action: "Created", actorId: "u-emp-1", actorName: "Alice Engineer", timestamp: sub(10), details: "Expense submitted" },
      { expenseId: "exp-3", action: "Created", actorId: "u-emp-2", actorName: "Bob Marketer", timestamp: sub(2), details: "Expense submitted" },
      { expenseId: "exp-3", action: "Approved", actorId: "u-apnesh", actorName: "Apnesh G", timestamp: sub(1), details: "Looks good, within budget." },
    ]);

    // Seed employees table with employee and hod users
    await db.insert(employees).values([
      { id: "emp-u-emp-1", userId: "u-emp-1", name: "Alice Engineer", email: "alice@avitech.com", departmentId: "dept-eng", status: "active" },
      { id: "emp-u-emp-2", userId: "u-emp-2", name: "Bob Marketer", email: "bob@avitech.com", departmentId: "dept-mkt", status: "active" },
      { id: "emp-u-hod-eng", userId: "u-hod-eng", name: "Sarah CTO", email: "sarah@avitech.com", departmentId: "dept-eng", status: "active" },
      { id: "emp-u-apnesh", userId: "u-apnesh", name: "Apnesh G", email: "apneshg@gmail.com", departmentId: "dept-mkt", status: "active" },
      { id: "emp-u-hod-sales", userId: "u-hod-sales", name: "Jenny VP Sales", email: "jenny@avitech.com", departmentId: "dept-sales", status: "active" },
    ]).onConflictDoNothing();
  }
}

export const storage = new DatabaseStorage();
