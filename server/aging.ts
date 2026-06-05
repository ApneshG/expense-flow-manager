/**
 * Aging notifications for stuck expenses.
 * - HoD: anything sitting in pending_hod for more than HOD_THRESHOLD_DAYS days
 * - CFO: anything sitting in pending_finance for more than CFO_THRESHOLD_DAYS days
 *
 * Runs on a 12-hour in-process timer (also exposed via /api/admin/aging-check).
 * Tracks last-notified timestamp per expense in the settings table so users
 * are not spammed about the same item more than once a day.
 */
import { storage } from "./storage";
import { sendHoDAgingReminder, sendCFOAgingReminder } from "./email";

const HOD_THRESHOLD_DAYS = 1;
const CFO_THRESHOLD_DAYS = 3;
const RENOTIFY_COOLDOWN_HOURS = 20; // don't re-email the same person more often than this

type StuckRow = {
  expenseId: string;
  amount: number;
  category: string;
  description: string;
  employeeName: string;
  daysWaiting: number;
};

const COOLDOWN_KEY = "aging_last_notified"; // JSON: { [recipientEmail]: ISO timestamp }

async function getLastNotifiedMap(): Promise<Record<string, string>> {
  const raw = await storage.getSetting(COOLDOWN_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function setLastNotified(email: string): Promise<void> {
  const map = await getLastNotifiedMap();
  map[email] = new Date().toISOString();
  await storage.setSetting(COOLDOWN_KEY, JSON.stringify(map));
}

function withinCooldown(lastNotifiedIso: string | undefined): boolean {
  if (!lastNotifiedIso) return false;
  const last = Date.parse(lastNotifiedIso);
  if (isNaN(last)) return false;
  const hoursSince = (Date.now() - last) / (1000 * 60 * 60);
  return hoursSince < RENOTIFY_COOLDOWN_HOURS;
}

function daysAgo(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  if (isNaN(t)) return 0;
  return Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
}

export type AgingRunResult = {
  hodSent: number;
  cfoSent: number;
  hodSkippedCooldown: number;
  cfoSkippedCooldown: number;
  hodNoEmail: number;
  cfoNoEmail: number;
};

export async function runAgingCheck(opts?: { force?: boolean }): Promise<AgingRunResult> {
  const force = !!opts?.force;
  const result: AgingRunResult = {
    hodSent: 0,
    cfoSent: 0,
    hodSkippedCooldown: 0,
    cfoSkippedCooldown: 0,
    hodNoEmail: 0,
    cfoNoEmail: 0,
  };

  const lastMap = await getLastNotifiedMap();
  const [expenses, users] = await Promise.all([storage.getExpenses(), storage.getUsers()]);
  const userById = new Map(users.map(u => [u.id, u]));

  // ---- HoD aging: group by assigned hodId ----
  const hodGroups = new Map<string, StuckRow[]>();
  for (const e of expenses) {
    if (e.status !== "pending_hod") continue;
    const age = daysAgo(e.createdAt);
    if (age < HOD_THRESHOLD_DAYS) continue;
    const row: StuckRow = {
      expenseId: e.id,
      amount: Number(e.amount) || 0,
      category: e.category,
      description: e.description,
      employeeName: userById.get(e.employeeId)?.name || "Unknown",
      daysWaiting: age,
    };
    const list = hodGroups.get(e.hodId) || [];
    list.push(row);
    hodGroups.set(e.hodId, list);
  }

  for (const [hodId, rows] of hodGroups) {
    const hod = userById.get(hodId);
    if (!hod) continue;
    if (!hod.email) { result.hodNoEmail++; continue; }
    if (!force && withinCooldown(lastMap[hod.email])) {
      result.hodSkippedCooldown++;
      continue;
    }
    const ok = await sendHoDAgingReminder(hod.email, hod.name, rows);
    if (ok) {
      result.hodSent++;
      await setLastNotified(hod.email);
    }
  }

  // ---- CFO aging: send a single digest to every finance_head user ----
  const cfoRows: StuckRow[] = [];
  for (const e of expenses) {
    if (e.status !== "pending_finance") continue;
    const ref = e.hodActionDate || e.createdAt;
    const age = daysAgo(ref);
    if (age < CFO_THRESHOLD_DAYS) continue;
    cfoRows.push({
      expenseId: e.id,
      amount: Number(e.amount) || 0,
      category: e.category,
      description: e.description,
      employeeName: userById.get(e.employeeId)?.name || "Unknown",
      daysWaiting: age,
    });
  }

  if (cfoRows.length > 0) {
    const cfos = users.filter(u => u.role === "finance_head" && u.status === "active");
    for (const cfo of cfos) {
      if (!cfo.email) { result.cfoNoEmail++; continue; }
      if (!force && withinCooldown(lastMap[cfo.email])) {
        result.cfoSkippedCooldown++;
        continue;
      }
      const ok = await sendCFOAgingReminder(cfo.email, cfo.name, cfoRows);
      if (ok) {
        result.cfoSent++;
        await setLastNotified(cfo.email);
      }
    }
  }

  return result;
}

let _intervalHandle: NodeJS.Timeout | null = null;

/**
 * Start the in-process 12-hour scheduler. Also runs once 60 seconds after start
 * so the first cycle isn't 12 hours away.
 */
export function startAgingScheduler() {
  if (_intervalHandle) return;
  const TWELVE_HOURS = 12 * 60 * 60 * 1000;
  const ONE_MINUTE = 60 * 1000;

  const safeRun = async () => {
    try {
      const r = await runAgingCheck();
      console.log(`[Aging] HoD sent=${r.hodSent} skipped=${r.hodSkippedCooldown} · CFO sent=${r.cfoSent} skipped=${r.cfoSkippedCooldown}`);
    } catch (err: any) {
      console.error("[Aging] run failed:", err?.message || err);
    }
  };

  setTimeout(safeRun, ONE_MINUTE);
  _intervalHandle = setInterval(safeRun, TWELVE_HOURS);
  console.log("[Aging] scheduler started (every 12h)");
}
