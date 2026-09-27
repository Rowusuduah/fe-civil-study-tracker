/**
 * app.js — FE Civil Study Tracker Entry Point
 * Initializes state, wires all tabs, binds all events, renders first tab.
 * Load order: utils → storage → data → engine → state → ui → app (this file)
 */

'use strict';

// ─── Google Drive Config ──────────────────────────────────────────────────────
// Set GDRIVE_CLIENT_ID to your Google Cloud OAuth 2.0 Client ID to enable sync.
const GDRIVE_CLIENT_ID = '394124622094-3cj4ho2ipp3m6pm0un09tg9knelhfqtu.apps.googleusercontent.com';
const GDRIVE_SCOPE     = 'https://www.googleapis.com/auth/drive.file';
const GDRIVE_FILENAME  = 'FECivil_Backup.json';

let _gTokenClient  = null;
let _gAccessToken  = null;
let _gdriveFileId  = null;
let _driveConnected= false;
let _driveSyncTimer= null;

/** Validate Google Drive file ID format to prevent URL injection */
function isValidDriveId(id) {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id) && id.length <= 100;
}

// ─── Active Tab Tracker ───────────────────────────────────────────────────────
let _activeTab = 'dashboard';

// ─── Lock screen (email code) ───────────────────────────────────
// js/email-login.js (shared with MoneyTrack and Deadline Tracker) emails a 6-digit code to
// the owner's Gmail and stores a signed 30-day pass. Study data itself remains in
// localStorage; this is a screen lock, not encryption.
const LOCK_CONFIRM = "Lock MoneyTrack, Deadline Tracker and FE Civil on this device? You'll need a new email code to open them.";

function bootApp() {
  initState();
  applyTheme(STATE.theme);
  bindAllEvents();
  switchTab('tab-dashboard');
  autoSyncDrive();
}

function openApp() {
  document.getElementById('login-gate').style.display = 'none';
  document.body.classList.remove('auth-locked');
  bootApp();
}

function showLockScreen() {
  const gate = document.getElementById('login-gate');
  gate.style.display = 'flex';
  // Focus trap: keep focus inside the lock screen
  gate.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const focusable = [...gate.querySelectorAll('input, button, [tabindex]:not([tabindex="-1"])')]
      .filter(el => !el.closest('[hidden]') && !el.disabled);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  EmailLogin.mountLockScreen({
    app: 'fe-civil-study-tracker',
    legacyKeys: ['fe_civil_auth_config'],
    legacySessionKeys: ['fe_civil_auth', 'fe_login_attempts', 'fe_login_lockout'],
    onUnlock: openApp,
  });
}

// ─── Cross-Tab Sync ──────────────────────────────────────────────────────────
window.addEventListener('storage', (e) => {
  if (e.key && e.key.startsWith('fe_civil_')) {
    // Another tab changed data — reload state
    initState();
    renderCurrentTab();
    showToast('Data updated from another tab.', 'info');
  }
});

// ─── App Init ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  EmailLogin.onLockedElsewhere(() => location.reload());
  document.getElementById('lock-btn')?.addEventListener('click', () => {
    if (!confirm(LOCK_CONFIRM)) return;
    EmailLogin.lock();
    location.reload();
  });
  if (await EmailLogin.hasValidPass()) openApp();
  else showLockScreen();
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
    const storedId   = sessionStorage.getItem(KEYS.GDRIVE_FILE) || localStorage.getItem(KEYS.GDRIVE_FILE) || null;
    _gdriveFileId    = storedId && isValidDriveId(storedId) ? storedId : null;
    _driveConnected  = sessionStorage.getItem(KEYS.GDRIVE_OK) === 'true' || localStorage.getItem(KEYS.GDRIVE_OK) === 'true';
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

async function _gFetch(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { Authorization: `Bearer ${_gAccessToken}`, ...(options.headers || {}) }
    });
    if (res.status === 401) { _gAccessToken = null; throw new Error('Token expired'); }
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function _gFindFile() {
  const res  = await _gFetch(`https://www.googleapis.com/drive/v3/files?q=name='${GDRIVE_FILENAME}'&fields=files(id)&spaces=drive`);
  if (!res.ok) { console.error('[drive] Find file failed:', res.status); return null; }
  const data = await res.json();
  return data.files?.[0]?.id || null;
}

async function _gCreateFile(content) {
  const meta = JSON.stringify({ name: GDRIVE_FILENAME, mimeType: 'application/json' });
  const form = new FormData();
  form.append('metadata', new Blob([meta], { type: 'application/json' }));
  form.append('media',    new Blob([content], { type: 'application/json' }));
  const res  = await _gFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', body: form });
  if (!res.ok) throw new Error('Drive create failed: ' + res.status);
  const data = await res.json();
  return data.id;
}

async function _gUpdateFile(fileId, content) {
  if (!isValidDriveId(fileId)) throw new Error('Invalid Drive file ID');
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
    if (fileId && isValidDriveId(fileId)) {
      await _gUpdateFile(fileId, content);
    } else {
      fileId = await _gCreateFile(content);
      if (!isValidDriveId(fileId)) throw new Error('Drive returned invalid file ID');
      _gdriveFileId = fileId;
      sessionStorage.setItem(KEYS.GDRIVE_FILE, fileId);
    }
    sessionStorage.setItem(KEYS.GDRIVE_OK, 'true');
    _driveConnected = true;
    setDriveStatus(`Saved — ${new Date().toLocaleTimeString()}`, 'var(--green)');
  });
}

function _getLocalDataDate() {
  try {
    const sessions = JSON.parse(localStorage.getItem(KEYS.SESSIONS) || '[]');
    const dates = sessions.map(s => s.date).filter(Boolean).sort();
    return dates.length ? dates[dates.length - 1] : null;
  } catch { return null; }
}

function loadFromDrive() {
  setDriveStatus('Loading from Drive…');
  gWithToken(async () => {
    const fileId = _gdriveFileId || await _gFindFile();
    if (!fileId || !isValidDriveId(fileId)) { setDriveStatus('No backup found on Drive.', 'var(--orange)'); return; }
    const res    = await _gFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
    if (!res.ok) { setDriveStatus('Load failed: HTTP ' + res.status, 'var(--red)'); return; }
    const data   = await res.json();

    // Warn if local data is newer than Drive backup
    const localDate = _getLocalDataDate();
    const driveDate = data._exported ? data._exported.slice(0, 10) : '';
    const newerWarning = (localDate && driveDate && localDate > driveDate)
      ? `\n\n⚠️ WARNING: Your local data (${localDate}) is NEWER than the Drive backup (${driveDate}). Loading will overwrite your recent changes!`
      : '';
    if (!confirm(`Load backup from Drive?${newerWarning}\n\nThis will replace all current data on this device.`)) {
      setDriveStatus(''); return;
    }

    const result = restoreBackup(data);
    if (result.ok) {
      _gdriveFileId = fileId;
      sessionStorage.setItem(KEYS.GDRIVE_FILE, fileId);
      sessionStorage.setItem(KEYS.GDRIVE_OK, 'true');
      initState();
      renderCurrentTab();
      setDriveStatus(`Loaded — ${new Date().toLocaleTimeString()}`, 'var(--green)');
      showToast('Data loaded from Drive.', 'success');
    } else {
      setDriveStatus('Restore failed: ' + result.message, 'var(--red)');
    }
  });
}

/** Silent auto-load — compares dates, no confirm dialog */
async function _autoLoadFromDrive() {
  try {
    setDriveStatus('Syncing…');
    const fileId = _gdriveFileId || await _gFindFile();
    if (!fileId || !isValidDriveId(fileId)) { setDriveStatus(''); return; }
    const res = await _gFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
    if (!res.ok) { setDriveStatus(''); return; }
    const data = await res.json();
    if (!data || !data.data || typeof data.data !== 'object') { setDriveStatus(''); return; }

    const localDate = _getLocalDataDate();
    const driveDate = data._exported ? data._exported.slice(0, 10) : '';

    if (localDate && driveDate && localDate > driveDate) {
      // Local is newer — upload to Drive
      setDriveStatus('Local data is newer — uploading…');
      saveToDrive();
      return;
    }

    if (driveDate && (!localDate || driveDate > localDate)) {
      // Drive is newer — load it silently
      const result = restoreBackup(data);
      if (result.ok) {
        _gdriveFileId = fileId;
        sessionStorage.setItem(KEYS.GDRIVE_FILE, fileId);
        initState();
        renderCurrentTab();
        setDriveStatus(`Synced ${driveDate}`, 'var(--green)');
      }
      return;
    }

    // Same date — just confirm connection
    setDriveStatus('Up to date', 'var(--green)');
  } catch (err) {
    setDriveStatus('');
    console.error('[FE Civil Drive auto-sync]', err);
  }
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
  if (_driveConnected && _gdriveFileId) {
    setTimeout(() => gWithToken(_autoLoadFromDrive), 1000);
  }
}

// Offline support. Registered from this file because the page's CSP blocks inline scripts.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => console.warn('[sw] Registration failed:', err));
  });
}
