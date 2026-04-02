/**
 * storage.js — All localStorage keys, load/save, backup, and restore.
 * This is the single source of truth for data persistence.
 */

// ─── Storage Keys ───────────────────────────────────────────────────────────

const KEYS = {
  THEME:       'fe_civil_theme',
  SETTINGS:    'fe_civil_settings',
  SUBJECTS:    'fe_civil_subjects',
  SESSIONS:    'fe_civil_sessions',
  PLAN:        'fe_civil_plan',
  RESOURCES:   'fe_civil_resources',
  ASSESSMENTS: 'fe_civil_assessments',
  REVISIONS:   'fe_civil_revisions',
  MISTAKES:    'fe_civil_mistakes',
  GDRIVE_FILE: 'fe_civil_gdrive_file',
  GDRIVE_OK:   'fe_civil_gdrive_ok'
};

/** Keys included in backup export/import (excludes Drive credentials) */
const BACKUP_KEYS = [
  KEYS.THEME, KEYS.SETTINGS, KEYS.SUBJECTS,
  KEYS.SESSIONS, KEYS.PLAN, KEYS.RESOURCES,
  KEYS.ASSESSMENTS, KEYS.REVISIONS, KEYS.MISTAKES
];

const BACKUP_VERSION = 1;

// ─── Default Settings ────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  studyStartDate: null,
  examDate: '2026-04-22',
  intensePhaseDate: null,
  weekdayHours: 10,
  weekendHours: 12,
  intenseHours: 14,
  revisionIntervals: [1, 3, 7, 14],
  masteryThreshold: 75,       // score >= this = mastered
  weaknessThreshold: 50,      // score >= this = weak (needs attention)
  neglectDays: 7,             // days without study = neglected (tighter for crunch)
  finalSprintDays: 7,         // last 7 days = intensive review only
  catchUpMaxDays: 7,          // spread catch-up over this many days
  dailyHardCap: 14,           // absolute max hours per day (safety)
  userProfile: {
    name: '',
    previousAttempt: true
  }
};

// ─── Core Storage Functions ──────────────────────────────────────────────────

/**
 * Load a JSON value from localStorage.
 * Returns defaultValue if key missing or JSON parse fails.
 */
function loadJSON(key, defaultValue = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultValue;
    return JSON.parse(raw, (k, v) => k === '__proto__' ? undefined : v);
  } catch (e) {
    console.error(`[storage] Failed to parse ${key} — returning default. Data may be corrupted:`, e);
    return defaultValue;
  }
}

/**
 * Save a value to localStorage as JSON.
 * Queues Drive sync if connected.
 */
function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    queueDriveSync();
  } catch (e) {
    console.error(`[storage] Failed to save ${key}:`, e);
  }
}

// ─── Named Loaders / Savers ──────────────────────────────────────────────────

function loadTheme() { return localStorage.getItem(KEYS.THEME) || 'dark'; }
function saveTheme(v) { localStorage.setItem(KEYS.THEME, v); }

function loadSettings() { return loadJSON(KEYS.SETTINGS, DEFAULT_SETTINGS); }
function saveSettings(s) { saveJSON(KEYS.SETTINGS, s); }

function loadSubjects() { return loadJSON(KEYS.SUBJECTS, []); }
function saveSubjects(arr) { saveJSON(KEYS.SUBJECTS, arr); }

function loadSessions() { return loadJSON(KEYS.SESSIONS, []); }
function saveSessions(arr) { saveJSON(KEYS.SESSIONS, arr); }

function loadPlan() { return loadJSON(KEYS.PLAN, []); }
function savePlan(arr) { saveJSON(KEYS.PLAN, arr); }

function loadResources() { return loadJSON(KEYS.RESOURCES, []); }
function saveResources(arr) { saveJSON(KEYS.RESOURCES, arr); }

function loadAssessments() { return loadJSON(KEYS.ASSESSMENTS, []); }
function saveAssessments(arr) { saveJSON(KEYS.ASSESSMENTS, arr); }

function loadRevisions() { return loadJSON(KEYS.REVISIONS, []); }
function saveRevisions(arr) { saveJSON(KEYS.REVISIONS, arr); }

function loadMistakes() { return loadJSON(KEYS.MISTAKES, []); }
function saveMistakes(arr) { saveJSON(KEYS.MISTAKES, arr); }

// ─── Backup Export ───────────────────────────────────────────────────────────

function buildBackupPayload() {
  const data = {};
  BACKUP_KEYS.forEach(k => {
    const raw = localStorage.getItem(k);
    if (raw !== null) data[k] = raw;
  });
  return {
    _version: BACKUP_VERSION,
    _app: 'FE Civil Study Tracker',
    _exported: new Date().toISOString(),
    data
  };
}

function exportBackup() {
  const payload = buildBackupPayload();
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `FECivil_Backup_${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Restore backup from a JSON payload object.
 * Returns { ok: boolean, message: string }
 */
/** Max allowed size per backup key (1MB) to prevent DoS via oversized data */
const MAX_BACKUP_KEY_SIZE = 1024 * 1024;

function restoreBackup(payload) {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, message: 'Invalid backup file format.' };
  }
  if (payload._version !== BACKUP_VERSION) {
    return { ok: false, message: `Unsupported backup version: ${payload._version}. Expected: ${BACKUP_VERSION}.` };
  }
  if (!payload.data || typeof payload.data !== 'object') {
    return { ok: false, message: 'Backup file is missing data section.' };
  }

  // Only restore known backup keys — never write arbitrary keys
  // Validate each value is a string (raw JSON) and within size limits
  let restored = 0;
  const errors = [];
  BACKUP_KEYS.forEach(k => {
    if (!Object.prototype.hasOwnProperty.call(payload.data, k)) return;
    const val = payload.data[k];
    if (typeof val !== 'string') {
      errors.push(`${k}: expected string, got ${typeof val}`);
      return;
    }
    if (val.length > MAX_BACKUP_KEY_SIZE) {
      errors.push(`${k}: exceeds ${MAX_BACKUP_KEY_SIZE} byte limit (${val.length})`);
      return;
    }
    // Verify it's valid JSON (or a plain string for theme key)
    if (k !== KEYS.THEME) {
      try { JSON.parse(val); } catch (e) {
        errors.push(`${k}: invalid JSON`);
        return;
      }
    }
    localStorage.setItem(k, val);
    restored++;
  });

  if (errors.length > 0) {
    console.error('[storage] Backup restore warnings:', errors);
  }
  return { ok: true, message: `Restored ${restored} data keys.${errors.length ? ` Skipped ${errors.length} invalid.` : ''}` };
}

/**
 * Import a backup from a File input event.
 * Calls onComplete(result) with { ok, message }
 */
const MAX_BACKUP_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function importBackupFromFile(file, onComplete) {
  if (!file) { onComplete({ ok: false, message: 'No file selected.' }); return; }
  if (file.size > MAX_BACKUP_FILE_SIZE) { onComplete({ ok: false, message: 'Backup file too large (max 10MB).' }); return; }
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const payload = JSON.parse(e.target.result);
      const result = restoreBackup(payload);
      onComplete(result);
    } catch (err) {
      onComplete({ ok: false, message: 'Failed to parse JSON: ' + err.message });
    }
  };
  reader.onerror = () => onComplete({ ok: false, message: 'Failed to read file.' });
  reader.readAsText(file);
}

// ─── Reset ────────────────────────────────────────────────────────────────────

/** Clear all app data from localStorage (keeps theme) */
function resetAllData() {
  const theme = loadTheme();
  BACKUP_KEYS.forEach(k => localStorage.removeItem(k));
  saveTheme(theme);
}

/** Full factory reset including theme */
function factoryReset() {
  BACKUP_KEYS.forEach(k => localStorage.removeItem(k));
  localStorage.removeItem(KEYS.GDRIVE_FILE);
  localStorage.removeItem(KEYS.GDRIVE_OK);
}
