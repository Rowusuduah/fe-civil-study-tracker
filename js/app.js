/**
 * app.js — FE Civil Study Tracker Entry Point
 * Initializes state, wires all tabs, binds all events, renders first tab.
 * Load order: utils → storage → data → engine → state → ui → app (this file)
 */

'use strict';

// ─── Google Drive Config ──────────────────────────────────────────────────────
// Set GDRIVE_CLIENT_ID to your Google Cloud OAuth 2.0 Client ID to enable sync.
const GDRIVE_CLIENT_ID = '';
const GDRIVE_SCOPE     = 'https://www.googleapis.com/auth/drive.file';
const GDRIVE_FILENAME  = 'FECivil_Backup.json';

let _gTokenClient  = null;
let _gAccessToken  = null;
let _gdriveFileId  = null;
let _driveConnected= false;
let _driveSyncTimer= null;

// ─── Active Tab Tracker ───────────────────────────────────────────────────────
let _activeTab = 'dashboard';

// ─── Auth ─────────────────────────────────────────────────────────────────────
// SHA-256 of "preparation_intense"
const AUTH_HASH = '63c0e99f5c0595eefcab57e9e55000b2f4223d39c93315854e3470005c989281';
const AUTH_KEY  = 'fe_civil_auth';

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function bootApp() {
  initState();
  applyTheme(STATE.theme);
  bindAllEvents();
  switchTab('tab-dashboard');
  autoSyncDrive();
}

function initAuth() {
  const gate = document.getElementById('login-gate');
  if (sessionStorage.getItem(AUTH_KEY) === '1') {
    gate.style.display = 'none';
    bootApp();
    return;
  }
  gate.style.display = 'flex';
  document.getElementById('login-pw').focus();
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pw    = document.getElementById('login-pw').value;
    const hash  = await sha256(pw);
    const errEl = document.getElementById('login-error');
    if (hash === AUTH_HASH) {
      sessionStorage.setItem(AUTH_KEY, '1');
      gate.style.display = 'none';
      bootApp();
    } else {
      errEl.textContent = 'Incorrect password. Try again.';
      document.getElementById('login-pw').value = '';
      document.getElementById('login-pw').focus();
    }
  });
}

// ─── App Init ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
});

// ─── Theme ────────────────────────────────────────────────────────────────────
function applyTheme(theme) {
  STATE.theme = theme || 'dark';
  saveTheme(STATE.theme);
  document.body.classList.toggle('light', STATE.theme === 'light');
  const btn = qs('theme-toggle');
  if (btn) {
    btn.textContent = STATE.theme === 'light' ? '🌙' : '☀';
    btn.setAttribute('aria-label', `Switch to ${STATE.theme === 'light' ? 'dark' : 'light'} theme`);
  }
  qs('set-theme-dark')?.classList.toggle('active', STATE.theme === 'dark');
  qs('set-theme-light')?.classList.toggle('active', STATE.theme === 'light');
}

function toggleTheme() {
  const next = STATE.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next); // applyTheme saves theme and updates all buttons
}

// ─── Tab Switching ────────────────────────────────────────────────────────────
function switchTab(tabId) {
  const sectionId = tabId.replace('tab-', 'sec-');

  document.querySelectorAll('.sec').forEach(s => s.classList.remove('on'));
  document.querySelectorAll('.nav-tab').forEach(t => {
    t.classList.remove('active');
    t.setAttribute('aria-selected', 'false');
    t.setAttribute('tabindex', '-1');
  });

  const section = document.getElementById(sectionId);
  if (section) section.classList.add('on');

  const tabBtn = document.getElementById(tabId);
  if (tabBtn) {
    tabBtn.classList.add('active');
    tabBtn.setAttribute('aria-selected', 'true');
    tabBtn.setAttribute('tabindex', '0');
  }

  _activeTab = tabId.replace('tab-', '');
  renderCurrentTab();
}

function renderCurrentTab() {
  switch (_activeTab) {
    case 'dashboard':   renderDashboard();      break;
    case 'plan':        renderPlanTab();         break;
    case 'sessions':    renderSessionList();     break;
    case 'subjects':    renderSubjectsTab();     break;
    case 'revision':    renderRevisionTab();     break;
    case 'resources':   renderResourcesTab();    break;
    case 'assessments': renderAssessmentsTab();  break;
    case 'analytics':   renderAnalyticsTab();    break;
    case 'settings':    renderSettingsTab();     break;
  }
}

// ─── Event Binding ─────────────────────────────────────────────────────────────
let _eventsBound = false;
function bindAllEvents() {
  if (_eventsBound) return;
  _eventsBound = true;

  // Tab list (click + keyboard)
  const tablist = qs('tablist');
  if (tablist) {
    tablist.addEventListener('click', e => {
      const btn = e.target.closest('.nav-tab');
      if (btn?.id) switchTab(btn.id);
    });
    tablist.addEventListener('keydown', e => {
      const tabs = [...document.querySelectorAll('.nav-tab')];
      const idx  = tabs.findIndex(t => t === document.activeElement);
      if (idx < 0) return;
      if (e.key === 'ArrowRight') { const n = tabs[(idx+1) % tabs.length]; n.focus(); switchTab(n.id); }
      if (e.key === 'ArrowLeft')  { const p = tabs[(idx-1+tabs.length) % tabs.length]; p.focus(); switchTab(p.id); }
    });
  }

  // Theme toggle
  qs('theme-toggle')?.addEventListener('click', toggleTheme);

  // Calendar navigation
  qs('cal-prev')?.addEventListener('click', () => calNav(-1));
  qs('cal-next')?.addEventListener('click', () => calNav(1));

  // Plan actions
  qs('btn-generate-plan')?.addEventListener('click', () => {
    STATE.plan = generateStudyPlan(STATE.subjects, STATE.settings, STATE.sessions);
    persistPlan();
    renderPlanTab();
    showToast('Study plan generated!', 'success');
  });
  qs('btn-regenerate-plan')?.addEventListener('click', () => {
    if (!STATE.plan.length) {
      STATE.plan = generateStudyPlan(STATE.subjects, STATE.settings, STATE.sessions);
    } else {
      STATE.plan = regeneratePlan(STATE.plan, STATE.subjects, STATE.settings, STATE.sessions);
    }
    persistPlan();
    renderPlanTab();
    showToast('Plan regenerated with catch-up adjustments.', 'success');
  });

  // Session form
  initSessionForm();

  // Subjects filters
  initSubjectsFilters();

  // Revision: mistake modal (cascade dropdowns wired once here)
  initMistakeModal();
  qs('btn-add-mistake')?.addEventListener('click', openMistakeModal);
  qs('btn-close-mistake')?.addEventListener('click', closeMistakeModal);
  qs('mistake-form')?.addEventListener('submit', saveMistake);
  qs('mistake-modal')?.addEventListener('click', e => {
    if (e.target === qs('mistake-modal')) closeMistakeModal();
  });

  // Resources
  initResourceForm();
  qs('btn-add-resource')?.addEventListener('click', () => {
    resetResourceForm();
    qs('resource-form-card')?.scrollIntoView({ behavior: 'smooth' });
  });

  // Assessments
  initAssessmentForm();
  qs('btn-add-assessment')?.addEventListener('click', () => {
    resetAssessmentForm();
    qs('assessment-form-card')?.scrollIntoView({ behavior: 'smooth' });
  });

  // Analytics range change
  qs('analytics-range')?.addEventListener('change', renderAnalyticsTab);

  // Settings
  initSettingsForm();

  // Escape key closes modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeMistakeModal();
  });
}

// ─── Toast ────────────────────────────────────────────────────────────────────
let _toastTimer = null;
function showToast(message, type = 'info') {
  const el = qs('toast');
  if (!el) return;
  el.textContent = message; // toast only shows app-generated text, no user content
  el.className = `toast ${type}`;
  show(el);
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => hide(el), 3500);
}

// ─── Google Drive Sync ────────────────────────────────────────────────────────
function initGDrive() {
  if (!GDRIVE_CLIENT_ID || typeof google === 'undefined') return;
  try {
    _gTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GDRIVE_CLIENT_ID,
      scope: GDRIVE_SCOPE,
      callback: () => {}
    });
    _gdriveFileId    = localStorage.getItem(KEYS.GDRIVE_FILE) || null;
    _driveConnected  = localStorage.getItem(KEYS.GDRIVE_OK) === 'true';
  } catch (e) {
    /* Drive not available */
  }
}

function setDriveStatus(msg, color) {
  const el = qs('gdrive-status');
  if (el) { el.textContent = msg; el.style.color = color || 'var(--muted)'; }
}

function gWithToken(op) {
  if (!_gTokenClient) {
    setDriveStatus('Google Drive not configured. Add Client ID to app.js.', 'var(--red)');
    return;
  }
  _gTokenClient.callback = async ({ access_token, error }) => {
    if (error) { setDriveStatus('Auth failed: ' + error, 'var(--red)'); return; }
    _gAccessToken = access_token;
    await op(access_token).catch(e => setDriveStatus('Drive error: ' + e.message, 'var(--red)'));
  };
  if (_gAccessToken) {
    op(_gAccessToken).catch(() => {
      _gAccessToken = null;
      _gTokenClient.requestAccessToken({ prompt: '' });
    });
  } else {
    _gTokenClient.requestAccessToken({ prompt: '' });
  }
}

async function _gFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${_gAccessToken}`, ...(options.headers || {}) }
  });
  if (res.status === 401) { _gAccessToken = null; throw new Error('Token expired'); }
  return res;
}

async function _gFindFile() {
  const res  = await _gFetch(`https://www.googleapis.com/drive/v3/files?q=name='${GDRIVE_FILENAME}'&fields=files(id)&spaces=drive`);
  const data = await res.json();
  return data.files?.[0]?.id || null;
}

async function _gCreateFile(content) {
  const meta = JSON.stringify({ name: GDRIVE_FILENAME, mimeType: 'application/json' });
  const form = new FormData();
  form.append('metadata', new Blob([meta], { type: 'application/json' }));
  form.append('media',    new Blob([content], { type: 'application/json' }));
  const res  = await _gFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', body: form });
  const data = await res.json();
  return data.id;
}

async function _gUpdateFile(fileId, content) {
  await _gFetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
    { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: content }
  );
}

function saveToDrive() {
  setDriveStatus('Saving to Drive…');
  gWithToken(async () => {
    const content = JSON.stringify(buildBackupPayload());
    let fileId = _gdriveFileId || await _gFindFile();
    if (fileId) {
      await _gUpdateFile(fileId, content);
    } else {
      fileId = await _gCreateFile(content);
      _gdriveFileId = fileId;
      localStorage.setItem(KEYS.GDRIVE_FILE, fileId);
    }
    localStorage.setItem(KEYS.GDRIVE_OK, 'true');
    _driveConnected = true;
    setDriveStatus(`Saved — ${new Date().toLocaleTimeString()}`, 'var(--green)');
  });
}

function loadFromDrive() {
  setDriveStatus('Loading from Drive…');
  gWithToken(async () => {
    const fileId = _gdriveFileId || await _gFindFile();
    if (!fileId) { setDriveStatus('No backup found on Drive.', 'var(--orange)'); return; }
    const res    = await _gFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
    const data   = await res.json();
    const result = restoreBackup(data);
    if (result.ok) {
      _gdriveFileId = fileId;
      localStorage.setItem(KEYS.GDRIVE_FILE, fileId);
      localStorage.setItem(KEYS.GDRIVE_OK, 'true');
      initState();
      renderCurrentTab();
      setDriveStatus(`Loaded — ${new Date().toLocaleTimeString()}`, 'var(--green)');
      showToast('Data loaded from Drive.', 'success');
    } else {
      setDriveStatus('Restore failed: ' + result.message, 'var(--red)');
    }
  });
}

/** Debounced auto-save after any data mutation */
function queueDriveSync() {
  if (!_driveConnected || !GDRIVE_CLIENT_ID) return;
  clearTimeout(_driveSyncTimer);
  _driveSyncTimer = setTimeout(saveToDrive, 3000);
}

function autoSyncDrive() {
  if (!GDRIVE_CLIENT_ID) return;
  initGDrive();
  if (_driveConnected && _gdriveFileId && STATE.sessions.length === 0) {
    setTimeout(loadFromDrive, 1000);
  }
}

function autoLoadFromDrive() { loadFromDrive(); }
