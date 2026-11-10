/**
 * Primavera P6 XER reader. An XER file is tab-separated text holding the P6 database tables:
 *   %T <table>   %F <field names>   %R <values> ...   %E
 * The TASK table (plus PROJECT, PROJWBS, CALENDAR, TASKRSRC, PROJCOST) is turned into one sheet
 * with standard column names, so it goes through the same mapping, validation and engine as an
 * Excel export. Durations are converted from hours with each activity's own calendar.
 */
import { fromYMD, type Day } from './dates';
import type { Grid, RawCell, WorkbookData } from './xlsx';
import { XlsxError } from './xlsx';

export type XerTables = Record<string, Record<string, string>[]>;

/** Decode the bytes: UTF-8 when valid, otherwise Windows-1256 for Arabic text, else Windows-1252. */
export function decodeXer(bytes: Uint8Array): { text: string; encoding: string } {
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'UTF-8' };
  } catch { /* not UTF-8 */ }
  // Arabic words are runs of high bytes; accented Latin letters are mostly single high bytes.
  let runs = 0, singles = 0, len = 0;
  for (let i = 0; i <= bytes.length; i++) {
    if (i < bytes.length && bytes[i] >= 0xc0) { len++; continue; }
    if (len >= 3) runs++; else if (len > 0) singles++;
    len = 0;
  }
  const enc = runs > singles ? 'windows-1256' : 'windows-1252';
  return { text: new TextDecoder(enc).decode(bytes), encoding: enc };
}

export function parseXer(text: string): XerTables {
  const tables: XerTables = {};
  let fields: string[] = [];
  let cur: Record<string, string>[] | null = null;
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('%T\t')) { cur = tables[line.slice(3).trim()] = []; fields = []; }
    else if (line.startsWith('%F\t')) fields = line.slice(3).split('\t').map((f) => f.trim());
    else if (line.startsWith('%R\t') && cur) {
      const vals = line.slice(3).split('\t');
      const rec: Record<string, string> = {};
      fields.forEach((f, i) => { rec[f] = vals[i] ?? ''; });
      cur.push(rec);
    }
  }
  return tables;
}

/** "2026-01-05 08:00" -> whole-day serial (time of day dropped, like the rest of the app). */
export function xerDate(s: string | undefined): Day | null {
  const m = (s ?? '').trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  return m ? fromYMD(+m[1], +m[2], +m[3]) : null;
}
const n = (s: string | undefined): number | null => {
  if (s == null || s.trim() === '') return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
};
const d = (v: Day | null): RawCell => (v == null ? null : { d: v });
const pctText = (v: number | null): RawCell => (v == null ? null : `${+v.toFixed(6)}%`);
const round = (v: number | null, k = 1e6) => (v == null ? null : Math.round(v * k) / k);

const STATUS: Record<string, string> = { TK_NotStart: 'Not Started', TK_Active: 'In Progress', TK_Complete: 'Completed' };
const TYPE: Record<string, string> = {
  TT_Task: 'Task Dependent', TT_Rsrc: 'Resource Dependent', TT_LOE: 'Level of Effort', TT_Mile: 'Start Milestone',
  TT_FinMile: 'Finish Milestone', TT_WBS: 'WBS Summary',
};

export const XER_HEADERS = [
  'Project ID', 'Project Name', 'Activity ID', 'Activity Name', 'Activity Status', 'WBS Code', 'WBS Name', 'Activity Type',
  'Original Duration(d)', 'Remaining Duration(d)', 'Actual Duration(d)', 'Total Float(d)', 'Free Float(d)', 'Critical',
  '__BL_START__', '__BL_FINISH__', 'Start', 'Finish', 'Actual Start', 'Actual Finish',
  'Physical % Complete', 'Duration % Complete', 'Units % Complete', 'Activity % Complete',
  'Budgeted Total Cost', 'Actual Total Cost', 'Budgeted Labor Units', 'Actual Labor Units',
  'Primary Constraint', 'Primary Constraint Date', 'Secondary Constraint', 'Secondary Constraint Date',
] as const;

/** P6 constraint codes -> the names P6 shows. */
export const CONSTRAINT: Record<string, string> = {
  CS_MSO: 'Start On', CS_MSOA: 'Start On or After', CS_MSOB: 'Start On or Before',
  CS_MEO: 'Finish On', CS_MEOA: 'Finish On or After', CS_MEOB: 'Finish On or Before',
  CS_ALAP: 'As Late As Possible', CS_MANDSTART: 'Mandatory Start', CS_MANDFIN: 'Mandatory Finish',
};
const REL: Record<string, string> = { PR_FS: 'FS', PR_SS: 'SS', PR_FF: 'FF', PR_SF: 'SF' };

export function readXer(bytes: Uint8Array, hoursPerDayDefault = 8): WorkbookData & { encoding: string; projects: string[]; baselineFound: boolean } {
  const { text, encoding } = decodeXer(bytes);
  if (!/^ERMHDR/.test(text.replace(/^﻿/, '')) && !text.includes('%T\tTASK')) throw new XlsxError('This is not a Primavera P6 XER file (the ERMHDR header is missing).');
  const t = parseXer(text);
  const tasks = t.TASK ?? [];
  if (!tasks.length) throw new XlsxError('The XER file has no activities (TASK table is empty or missing). Export the project from P6 again with File > Export > Primavera PM (XER).');

  const projects = t.PROJECT ?? [];
  const projById = new Map(projects.map((p) => [p.proj_id, p]));
  // A project referenced as another project's baseline is a baseline copy, not a schedule to report.
  const baselineIds = new Set(projects.map((p) => p.sum_base_proj_id).filter((x) => x && projById.has(x)));
  const reportProjects = projects.filter((p) => !baselineIds.has(p.proj_id) && tasks.some((k) => k.proj_id === p.proj_id));
  const reportIds = new Set(reportProjects.length ? reportProjects.map((p) => p.proj_id) : tasks.map((k) => k.proj_id));

  const hpd = new Map<string, number>();
  for (const c of t.CALENDAR ?? []) {
    const h = n(c.day_hr_cnt);
    if (h && h > 0) hpd.set(c.clndr_id, h);
  }
  const wbs = new Map((t.PROJWBS ?? []).map((w) => [w.wbs_id, w]));
  const wbsCode = (id: string): string => {
    const parts: string[] = [];
    const seen = new Set<string>();
    for (let w = wbs.get(id); w && !seen.has(w.wbs_id); w = wbs.get(w.parent_wbs_id)) {
      seen.add(w.wbs_id);
      parts.unshift(w.wbs_short_name);
      if (w.proj_node_flag === 'Y') break;
    }
    return parts.join('.');
  };

  const cost = new Map<string, { budget: number; actual: number }>();
  const addCost = (taskId: string, budget: number | null, actual: number | null) => {
    const c = cost.get(taskId) ?? { budget: 0, actual: 0 };
    c.budget += budget ?? 0; c.actual += actual ?? 0;
    cost.set(taskId, c);
  };
  for (const r of t.TASKRSRC ?? []) addCost(r.task_id, n(r.target_cost), (n(r.act_reg_cost) ?? 0) + (n(r.act_ot_cost) ?? 0));
  for (const r of t.PROJCOST ?? []) addCost(r.task_id, n(r.target_cost), n(r.act_cost));

  // Baseline: tasks of the project named as baseline (sum_base_proj_id), matched by Activity ID.
  const blByProj = new Map<string, Map<string, { s: Day | null; f: Day | null }>>();
  for (const p of projects) {
    const b = p.sum_base_proj_id;
    if (!b || !baselineIds.has(b) || !reportIds.has(p.proj_id)) continue;
    const m = new Map<string, { s: Day | null; f: Day | null }>();
    for (const k of tasks) if (k.proj_id === b) m.set(k.task_code, {
      s: xerDate(k.act_start_date) ?? xerDate(k.restart_date) ?? xerDate(k.early_start_date) ?? xerDate(k.target_start_date),
      f: xerDate(k.act_end_date) ?? xerDate(k.reend_date) ?? xerDate(k.early_end_date) ?? xerDate(k.target_end_date),
    });
    blByProj.set(p.proj_id, m);
  }
  const baselineFound = blByProj.size > 0;

  // PROJECT holds only the short name; the long name is the project's root WBS node.
  const longName = new Map<string, string>();
  for (const w of t.PROJWBS ?? []) if (w.proj_node_flag === 'Y') longName.set(w.proj_id, w.wbs_name);

  const rows: Grid = [];
  for (const k of tasks) {
    if (!reportIds.has(k.proj_id)) continue;
    const p = projById.get(k.proj_id);
    const h = hpd.get(k.clndr_id) ?? hoursPerDayDefault;
    const days = (v: string) => round(n(v) == null ? null : n(v)! / h);
    const status = STATUS[k.status_code] ?? k.status_code;
    const actStart = xerDate(k.act_start_date);
    const actFinish = xerDate(k.act_end_date);
    const start = actStart ?? xerDate(k.restart_date) ?? xerDate(k.early_start_date) ?? xerDate(k.target_start_date);
    const finish = actFinish ?? xerDate(k.reend_date) ?? xerDate(k.early_end_date) ?? xerDate(k.target_end_date);
    const od = n(k.target_drtn_hr_cnt), rd = n(k.remain_drtn_hr_cnt);
    const phys = n(k.phys_complete_pct);
    const durPct = status === 'Completed' ? 100 : od && od > 0 && rd != null ? Math.min(100, Math.max(0, ((od - rd) / od) * 100)) : status === 'Not Started' ? 0 : null;
    const aw = n(k.act_work_qty), rw = n(k.remain_work_qty);
    const unitsPct = aw != null && rw != null && aw + rw > 0 ? (aw / (aw + rw)) * 100 : status === 'Completed' ? 100 : null;
    const actPct = k.complete_pct_type === 'CP_Drtn' ? durPct : k.complete_pct_type === 'CP_Units' ? unitsPct : phys;
    let actDur: number | null = null;
    if (actStart != null) {
      const total = n(k.act_drtn_hr_cnt);
      actDur = total != null ? round(total / h) : od != null && rd != null && status !== 'Not Started' ? round(Math.max(0, od - rd) / h) : null;
    }
    const bl = blByProj.get(k.proj_id)?.get(k.task_code);
    const c = cost.get(k.task_id);
    rows.push([
      p?.proj_short_name ?? k.proj_id, longName.get(k.proj_id) ?? p?.proj_short_name ?? null, k.task_code, k.task_name, status,
      wbsCode(k.wbs_id), wbs.get(k.wbs_id)?.wbs_name ?? '', TYPE[k.task_type] ?? k.task_type,
      days(k.target_drtn_hr_cnt), days(k.remain_drtn_hr_cnt), actDur, days(k.total_float_hr_cnt), days(k.free_float_hr_cnt),
      k.driving_path_flag === 'Y' ? 'Yes' : k.driving_path_flag === 'N' ? 'No' : '',
      d(baselineFound ? bl?.s ?? null : xerDate(k.target_start_date)), d(baselineFound ? bl?.f ?? null : xerDate(k.target_end_date)),
      d(start), d(finish), d(actStart), d(actFinish),
      pctText(phys), pctText(durPct), pctText(unitsPct), pctText(actPct),
      c ? c.budget : null, c ? c.actual : null, n(k.target_work_qty), aw,
      CONSTRAINT[k.cstr_type] ?? (k.cstr_type || null), d(xerDate(k.cstr_date)),
      CONSTRAINT[k.cstr_type2] ?? (k.cstr_type2 || null), d(xerDate(k.cstr_date2)),
    ]);
  }

  // Relationships (TASKPRED), named like the P6 Excel export; lag converted with the successor's calendar.
  const byId = new Map(tasks.map((k) => [k.task_id, k]));
  const predRows: Grid = [['Predecessor', 'Successor', 'Relationship Type', 'Lag(d)']];
  for (const r of t.TASKPRED ?? []) {
    const s = byId.get(r.task_id), pr = byId.get(r.pred_task_id);
    if (!s || !pr || !reportIds.has(s.proj_id)) continue;
    const h = hpd.get(s.clndr_id) ?? hoursPerDayDefault;
    predRows.push([pr.task_code, s.task_code, REL[r.pred_type] ?? r.pred_type, round(n(r.lag_hr_cnt) == null ? 0 : n(r.lag_hr_cnt)! / h)]);
  }
  const header = XER_HEADERS.map((x) => x === '__BL_START__' ? (baselineFound ? 'BL Project Start' : 'Planned Start')
    : x === '__BL_FINISH__' ? (baselineFound ? 'BL Project Finish' : 'Planned Finish') : x);
  const projRows: Grid = [['Project ID', 'Project Name', 'Data Date']];
  for (const p of reportProjects) projRows.push([p.proj_short_name, longName.get(p.proj_id) ?? '', d(xerDate(p.last_recalc_date))]);

  return {
    sheets: [{ name: 'TASK (XER)', rows: [header, ...rows] }, { name: 'PROJECT (XER)', rows: projRows }, { name: 'TASKPRED (XER)', rows: predRows },
      { name: 'PROJWBS (XER)', rows: [['WBS Code', 'WBS Name'], ...(t.PROJWBS ?? []).filter((w) => reportIds.has(w.proj_id)).map((w) => [wbsCode(w.wbs_id), w.wbs_name] as RawCell[])] }],
    date1904: false,
    encoding,
    projects: reportProjects.map((p) => p.proj_short_name),
    baselineFound,
  };
}
