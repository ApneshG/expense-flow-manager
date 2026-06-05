import OpenAI from "openai";
import { storage } from "./storage";
import type { Expense, Department, User } from "@shared/schema";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI | null {
  if (_openai) return _openai;
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  _openai = new OpenAI({ apiKey: key });
  return _openai;
}

export function isCopilotConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

const PAID_STATUSES = ["paid"];
const COMMITTED_UNPAID = ["pending_hod", "needs_revision", "pending_finance", "on_hold"];

function fmt$(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function daysAgo(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24)));
}

async function gatherCommonData() {
  const expenses = await storage.getExpenses();
  const departments = await storage.getDepartments();
  const users = await storage.getUsers();
  return { expenses, departments, users };
}

function nameOf(users: User[], id: string): string {
  return users.find(u => u.id === id)?.name || id;
}

function deptOf(depts: Department[], id: string): string {
  return depts.find(d => d.id === id)?.name || id;
}

/**
 * Build a compact text snapshot of CFO-relevant data for the LLM.
 * Keep total tokens under ~1000 to keep latency + cost low.
 */
export async function buildCFOContext(): Promise<string> {
  const { expenses, departments, users } = await gatherCommonData();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const paid = expenses.filter(e => PAID_STATUSES.includes(e.status));
  const committed = expenses.filter(e => COMMITTED_UNPAID.includes(e.status));
  const pendingFinance = expenses.filter(e => e.status === "pending_finance");
  const onHold = expenses.filter(e => e.status === "on_hold");

  const paidYTD = paid
    .filter(e => {
      const ref = e.paymentDate || e.financeActionDate;
      return ref && new Date(ref) >= yearStart;
    })
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const paidThisMonth = paid
    .filter(e => {
      const ref = e.paymentDate || e.financeActionDate;
      return ref && new Date(ref) >= monthStart;
    })
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const committedTotal = committed.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const pendingFinanceTotal = pendingFinance.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const onHoldTotal = onHold.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  // Stuck > 7 days in pending_finance
  const stuck = pendingFinance.filter(e => {
    const ref = e.hodActionDate || e.createdAt;
    const d = daysAgo(ref);
    return d !== null && d > 7;
  });

  // Dept summary
  const deptRows = departments.map(d => {
    const dPaid = paid.filter(e => e.departmentId === d.id).reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const dCommitted = committed.filter(e => e.departmentId === d.id).reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const total = dPaid + dCommitted;
    const pct = d.annualBudget > 0 ? Math.round((total / d.annualBudget) * 100) : 0;
    return `- ${d.name}: annual ${fmt$(d.annualBudget)}, paid ${fmt$(dPaid)}, committed ${fmt$(dCommitted)}, total ${fmt$(total)} (${pct}% utilised), HoD: ${nameOf(users, d.hodId)}`;
  }).join("\n");

  // Top 10 pending payouts
  const top10 = [...pendingFinance]
    .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))
    .slice(0, 10)
    .map(e => `- ${e.id}: ${fmt$(Number(e.amount) || 0)} · ${e.description} · ${nameOf(users, e.employeeId)} (${deptOf(departments, e.departmentId)}) · waiting ${daysAgo(e.hodActionDate || e.createdAt) ?? "?"} days`)
    .join("\n");

  // On hold list (limit 10)
  const onHoldList = onHold.slice(0, 10).map(e =>
    `- ${e.id}: ${fmt$(Number(e.amount) || 0)} · ${e.description} · ${nameOf(users, e.employeeId)} (${deptOf(departments, e.departmentId)}) · finance comment: "${(e.financeComment || "").slice(0, 80)}"`
  ).join("\n");

  return [
    `Today's date: ${now.toISOString().slice(0, 10)}`,
    ``,
    `COMPANY-WIDE TOTALS`,
    `- Paid YTD: ${fmt$(paidYTD)}`,
    `- Paid this month: ${fmt$(paidThisMonth)}`,
    `- Committed Unpaid (in approval queue): ${fmt$(committedTotal)}`,
    `- Pending Payouts (need CFO action): ${pendingFinance.length} requests · ${fmt$(pendingFinanceTotal)}`,
    `- On Hold (CFO paused): ${onHold.length} requests · ${fmt$(onHoldTotal)}`,
    `- Stuck > 7 days in CFO queue: ${stuck.length} requests`,
    ``,
    `DEPARTMENTS (${departments.length})`,
    deptRows || "(none)",
    ``,
    `TOP 10 LARGEST PENDING PAYOUTS`,
    top10 || "(none)",
    ``,
    `ON HOLD REQUESTS`,
    onHoldList || "(none)",
  ].join("\n");
}

/**
 * Build a HoD-scoped snapshot for the LLM. Only includes the HoD's department.
 */
export async function buildHoDContext(userId: string): Promise<string> {
  const { expenses, departments, users } = await gatherCommonData();
  const hod = users.find(u => u.id === userId);
  if (!hod) return "User not found.";

  const dept = departments.find(d => d.id === hod.departmentId);
  if (!dept) return `You are HoD ${hod.name} but your department is not configured.`;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const deptExpenses = expenses.filter(e => e.departmentId === dept.id);
  const paid = deptExpenses.filter(e => PAID_STATUSES.includes(e.status));
  const committed = deptExpenses.filter(e => COMMITTED_UNPAID.includes(e.status));

  const paidTotal = paid.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const committedTotal = committed.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const available = (dept.annualBudget || 0) - paidTotal - committedTotal;

  const pendingHoD = deptExpenses.filter(e => e.status === "pending_hod" && e.hodId === userId);
  const needsRevision = deptExpenses.filter(e => e.status === "needs_revision");
  const onHold = deptExpenses.filter(e => e.status === "on_hold");

  const paidThisMonth = paid
    .filter(e => {
      const ref = e.paymentDate || e.financeActionDate;
      return ref && new Date(ref) >= monthStart;
    })
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const paidYTD = paid
    .filter(e => {
      const ref = e.paymentDate || e.financeActionDate;
      return ref && new Date(ref) >= yearStart;
    })
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);

  // Top spenders in dept
  const spendByEmp: Record<string, number> = {};
  [...paid, ...committed].forEach(e => {
    spendByEmp[e.employeeId] = (spendByEmp[e.employeeId] || 0) + (Number(e.amount) || 0);
  });
  const topSpenders = Object.entries(spendByEmp)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, total]) => `- ${nameOf(users, id)}: ${fmt$(total)}`)
    .join("\n");

  // Category breakdown
  const catTotals: Record<string, number> = {};
  [...paid, ...committed].forEach(e => {
    catTotals[e.category] = (catTotals[e.category] || 0) + (Number(e.amount) || 0);
  });
  const topCats = Object.entries(catTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, total]) => `- ${name}: ${fmt$(total)}`)
    .join("\n");

  // Pending list (waiting on HoD action)
  const pendingList = pendingHoD.slice(0, 10).map(e =>
    `- ${e.id}: ${fmt$(Number(e.amount) || 0)} · ${e.description} · ${nameOf(users, e.employeeId)} · waiting ${daysAgo(e.createdAt) ?? "?"} days`
  ).join("\n");

  return [
    `Today's date: ${now.toISOString().slice(0, 10)}`,
    `You are HoD: ${hod.name}, Department: ${dept.name}`,
    ``,
    `DEPARTMENT BUDGET`,
    `- Annual Budget: ${fmt$(dept.annualBudget)}`,
    `- Paid YTD: ${fmt$(paidYTD)}`,
    `- Paid This Month: ${fmt$(paidThisMonth)}`,
    `- Committed Unpaid (in approval queue): ${fmt$(committedTotal)}`,
    `- Available Budget: ${fmt$(available)}`,
    ``,
    `YOUR APPROVAL QUEUE`,
    `- Awaiting your approval (pending_hod): ${pendingHoD.length}`,
    `- Needs revision (back with employee): ${needsRevision.length}`,
    `- On hold (paused by finance): ${onHold.length}`,
    ``,
    `TOP 5 SPENDERS IN YOUR DEPARTMENT`,
    topSpenders || "(none)",
    ``,
    `TOP 5 CATEGORIES`,
    topCats || "(none)",
    ``,
    `PENDING REQUESTS WAITING ON YOU (top 10)`,
    pendingList || "(none)",
  ].join("\n");
}

const SYSTEM_PROMPT_CFO = `You are Avi Tech's Finance Copilot, helping the Finance Head (CFO) manage company-wide expenses.
Answer concisely (1-3 short paragraphs, or bullet lists). Always cite specific numbers from the DATA SNAPSHOT below.
When useful, suggest a clear next action (e.g., "Review the 3 pending payouts > 7 days old on the Finance Review page").
If the question is outside the expense management scope, politely redirect.
Do not invent data not present in the snapshot.`;

const SYSTEM_PROMPT_HOD = `You are Avi Tech's Department Copilot, helping a Head of Department manage their team's expenses.
Answer concisely (1-3 short paragraphs, or bullet lists). Always cite specific numbers from the DATA SNAPSHOT below.
When useful, suggest a clear next action (e.g., "Review the 2 pending approvals on the Pending Approvals page").
If the question is outside the expense management scope, politely redirect.
Do not invent data not present in the snapshot.`;

export type ChatTurn = { role: "user" | "assistant"; content: string };

export async function askCopilot(args: {
  scope: "cfo" | "hod";
  question: string;
  history?: ChatTurn[];
  userId: string;
}): Promise<{ reply: string }> {
  const client = getOpenAI();
  if (!client) {
    return {
      reply:
        "I am not configured yet. Ask your admin to set the OPENAI_API_KEY environment variable in Render, then redeploy. After that, I will be able to answer your questions about your team's expenses.",
    };
  }

  const context =
    args.scope === "cfo"
      ? await buildCFOContext()
      : await buildHoDContext(args.userId);

  const systemPrompt =
    (args.scope === "cfo" ? SYSTEM_PROMPT_CFO : SYSTEM_PROMPT_HOD) +
    "\n\nDATA SNAPSHOT:\n" +
    context;

  const recentHistory = (args.history || []).slice(-6); // keep last 6 turns

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...recentHistory.map(t => ({ role: t.role, content: t.content })),
        { role: "user", content: args.question },
      ],
      temperature: 0.2,
      max_tokens: 500,
    });

    const reply =
      completion.choices[0]?.message?.content?.trim() ||
      "Sorry, I could not generate a response.";
    return { reply };
  } catch (err: any) {
    console.error("[Copilot] OpenAI error:", err?.message || err);
    return {
      reply:
        "I had trouble reaching the AI service. Please try again in a moment. If this keeps happening, check that the OpenAI key is valid.",
    };
  }
}
