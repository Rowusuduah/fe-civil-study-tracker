/**
 * utils.js — Shared helpers: escaping, dates, UUIDs, formatting
 * No dependencies on other app modules.
 */

// ─── Security ──────────────────────────────────────────────────────────────

/**
 * Escape HTML special characters to prevent XSS.
 * Always use before inserting user-supplied text into innerHTML.
 */
function escapeHTML(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;');
}

// ─── UUID ───────────────────────────────────────────────────────────────────

function genId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ─── Date Helpers ───────────────────────────────────────────────────────────

/** Returns today's date as YYYY-MM-DD string (local time) */
function todayISO() {
  const d = new Date();
  return toISO(d);
}

/** Convert a Date object to YYYY-MM-DD string (local time) */
function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse YYYY-MM-DD string to local midnight Date object */
function parseISO(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Add N days to a YYYY-MM-DD string, returns YYYY-MM-DD
 * Handles month/year rollovers correctly.
 */
function addDays(isoStr, n) {
  const d = parseISO(isoStr);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** Days between two YYYY-MM-DD strings (b - a). Positive if b is after a. Uses truncation to avoid DST rounding errors. */
function daysBetween(isoA, isoB) {
  const a = parseISO(isoA);
  const b = parseISO(isoB);
  const diff = (b - a) / 86400000;
  return diff >= 0 ? Math.floor(diff + 0.5) : Math.ceil(diff - 0.5);
}

/** Returns true if the given YYYY-MM-DD is a Saturday or Sunday */
function isWeekend(isoStr) {
  const d = parseISO(isoStr);
  const day = d.getDay(); // 0=Sun, 6=Sat
  return day === 0 || day === 6;
}

/**
 * Format YYYY-MM-DD for display: "Mon, Mar 23, 2026"
 */
function fmtDate(isoStr) {
  if (!isoStr) return '—';
  const d = parseISO(isoStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Format YYYY-MM-DD for short display: "Mar 23"
 */
function fmtDateShort(isoStr) {
  if (!isoStr) return '—';
  const d = parseISO(isoStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Returns "X days ago", "today", "in X days", etc. */
function relativeDate(isoStr) {
  if (!isoStr) return 'never';
  const diff = daysBetween(todayISO(), isoStr);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  if (diff > 0) return `in ${diff} days`;
  return `${Math.abs(diff)} days ago`;
}

/** Resolve the effective study start date: uses settings.studyStartDate if set and not in the past, otherwise tomorrow. */
function resolveStartDate(settings) {
  if (!settings) return addDays(todayISO(), 1);
  const today = todayISO();
  if (settings.studyStartDate && settings.studyStartDate >= today) {
    return settings.studyStartDate;
  }
  return addDays(today, 1);
}

/** Exam countdown in full days from today */
function daysUntilExam(examDate) {
  return Math.max(0, daysBetween(todayISO(), examDate));
}

/** Generate array of YYYY-MM-DD strings from startDate to endDate (inclusive) */
function dateRange(startISO, endISO) {
  const dates = [];
  let cur = startISO;
  while (cur <= endISO) {
    dates.push(cur);
    cur = addDays(cur, 1);
  }
  return dates;
}

/** Get Monday of the week containing the given date */
function getMondayOfWeek(isoStr) {
  const d = parseISO(isoStr);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toISO(d);
}

// ─── Number / Score Formatting ──────────────────────────────────────────────

/** Clamp n to [min, max] */
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/** Round to N decimal places */
function roundTo(n, places = 1) {
  const factor = Math.pow(10, places);
  return Math.round(n * factor) / factor;
}

/** Format a score 0-100 as "72.4" */
function fmtScore(n) {
  if (n == null || isNaN(n)) return '—';
  return roundTo(n, 1).toFixed(1);
}

/** Format decimal as percentage string "72.4%" */
function fmtPct(ratio) {
  if (ratio == null || isNaN(ratio)) return '—';
  return `${roundTo(ratio * 100, 1)}%`;
}

/** Format minutes as "2h 30m" or "45m" */
function fmtDuration(minutes) {
  if (!minutes || minutes < 1) return '0m';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Format hours as "6.5h" */
function fmtHours(hours) {
  if (hours == null) return '0h';
  return `${roundTo(hours, 1)}h`;
}

/** Safely compute accuracy from correct/attempted, returns null if no attempts */
function safeAccuracy(correct, attempted) {
  if (!attempted || attempted <= 0) return null;
  return clamp(correct / attempted, 0, 1);
}

// ─── Color Helpers ──────────────────────────────────────────────────────────

/** Return CSS class based on score tier (0-100) */
function scoreColorClass(score) {
  if (score == null) return 'color-muted';
  if (score >= 75) return 'color-green';
  if (score >= 50) return 'color-orange';
  return 'color-red';
}

/** Return CSS class based on tier string */
function tierColorClass(tier) {
  if (tier === 'STRONG') return 'color-green';
  if (tier === 'MID') return 'color-orange';
  return 'color-red';
}

// ─── DOM Helpers ────────────────────────────────────────────────────────────

/** Safely get element by ID */
function qs(id) {
  return document.getElementById(id);
}

/** Create an element with optional class and inner text */
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/** Show element (remove hidden class) */
function show(elem) {
  if (elem) elem.classList.remove('hidden');
}

/** Hide element */
function hide(elem) {
  if (elem) elem.classList.add('hidden');
}

/** Toggle hidden */
function toggleHidden(elem, forceHide) {
  if (!elem) return;
  if (forceHide === true) { hide(elem); return; }
  if (forceHide === false) { show(elem); return; }
  elem.classList.toggle('hidden');
}

// ─── Validation ─────────────────────────────────────────────────────────────

/** Returns true if value is a valid YYYY-MM-DD string */
function isValidISODate(str) {
  if (!str || typeof str !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = parseISO(str);
  return !isNaN(d.getTime());
}

/** Clamp confidence/difficulty/fatigue input to 1–5 integer */
function clampRating(val) {
  const n = parseInt(val, 10);
  if (isNaN(n)) return 3;
  return clamp(n, 1, 5);
}

// ─── Array Helpers ───────────────────────────────────────────────────────────

/** Weighted average: items is [{value, weight}] */
function weightedAverage(items) {
  if (!items || items.length === 0) return null;
  const validItems = items.filter(i => i.value != null && !isNaN(i.value) && i.weight > 0);
  if (validItems.length === 0) return null;
  const totalWeight = validItems.reduce((sum, i) => sum + i.weight, 0);
  if (totalWeight === 0) return null;
  const sum = validItems.reduce((acc, i) => acc + i.value * i.weight, 0);
  return sum / totalWeight;
}

/** Simple average of array of numbers, ignoring nulls */
function average(arr) {
  const valid = arr.filter(v => v != null && !isNaN(v));
  if (valid.length === 0) return null;
  return valid.reduce((s, v) => s + v, 0) / valid.length;
}

// ─── Debounce ────────────────────────────────────────────────────────────────

function debounce(fn, ms) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

// ─── CSV Helpers ─────────────────────────────────────────────────────────────

function csvField(v) {
  const s = String(v == null ? '' : v).replace(/"/g, '""');
  return `"${s}"`;
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Exports ─────────────────────────────────────────────────────────────────

if (typeof module !== 'undefined') {
  module.exports = {
    escapeHTML, genId,
    todayISO, toISO, parseISO, addDays, daysBetween, isWeekend,
    fmtDate, fmtDateShort, relativeDate, resolveStartDate, daysUntilExam, dateRange, getMondayOfWeek,
    clamp, roundTo, fmtScore, fmtPct, fmtDuration, fmtHours, safeAccuracy,
    scoreColorClass, tierColorClass,
    qs, el, show, hide, toggleHidden,
    isValidISODate, clampRating,
    weightedAverage, average,
    debounce, csvField, downloadFile
  };
}
