/**
 * ui-dashboard.js — Dashboard tab renderer
 * Reads from STATE. No direct storage calls.
 */

function renderDashboard() {
  renderExamCountdown();
  renderAlertBanner();
  renderKPIGrid();
  renderRecommendations();
  renderReadinessGauge();
  renderTodayProgress();
  renderWeeklyProgress();
  renderSubjectMasteryGrid();
  renderRevisionDueList();
  renderWeakAreasList();
}

// ─── Countdown ───────────────────────────────────────────────────────────────
function renderExamCountdown() {
  const el = qs('exam-countdown');
  if (!el) return;
  const days = STATE.computed.daysUntilExam;
  el.textContent = days === 0 ? '🎯 Exam Day!' : `${days} days to exam`;
  el.className = 'countdown-badge' +
    (days <= 7 ? ' urgent' : days <= 21 ? ' warning' : '');
}

// ─── Alert Banner ─────────────────────────────────────────────────────────────
function renderAlertBanner() {
  const banner = qs('alert-banner');
  if (!banner) return;

  const recovery = checkScheduleRecovery(STATE.plan, STATE.sessions, STATE.settings);
  const burnout  = detectBurnoutRisk(STATE.sessions);
  const days     = STATE.computed.daysUntilExam;

  let msg = '', cls = '';

  if (days <= 7 && days > 0) {
    msg = `⚡ Final week! ${days} day${days > 1 ? 's' : ''} remaining. Prioritize revision and mock practice.`;
    cls = 'danger';
  } else if (burnout) {
    msg = '😓 Fatigue detected in recent sessions. Consider a lighter study day or short break.';
    cls = 'warning';
  } else if (recovery.isBehind) {
    msg = `⚠ ${recovery.suggestion}`;
    cls = 'warning';
  }

  if (msg) {
    banner.textContent = msg;
    banner.className = `alert-banner ${cls}`;
    show(banner);
  } else {
    hide(banner);
  }
}

// ─── KPI Grid ────────────────────────────────────────────────────────────────
function renderKPIGrid() {
  const grid = qs('kpi-grid');
  if (!grid) return;
  const c = STATE.computed;
  const todayHours = roundTo(c.todaySessionMinutes / 60, 1);
  const todayPlanned = roundTo(plannedHoursForDate(todayISO(), STATE.settings), 1);
  const accuracy = safeAccuracy(c.totalQuestionsCorrect, c.totalQuestionsAttempted);

  const kpis = [
    { label: 'Days to Exam', value: c.daysUntilExam, sub: STATE.settings.examDate, accent: true },
    { label: 'Today Studied', value: `${todayHours}h`, sub: `of ${todayPlanned}h planned` },
    { label: 'Study Streak', value: `${c.studyStreak}d`, sub: `Best: ${c.longestStreak}d` },
    { label: 'Total Hours', value: fmtHours(c.totalSessionMinutes / 60), sub: 'All time' },
    { label: 'Questions', value: c.totalQuestionsAttempted.toLocaleString(), sub: accuracy != null ? `${fmtPct(accuracy)} accuracy` : 'No data yet' },
    { label: 'Videos Done', value: c.totalVideosWatched, sub: 'Sessions logged' },
    { label: 'Readiness', value: c.readinessScore != null ? `${fmtScore(c.readinessScore)}%` : '—', sub: 'Weighted mastery' },
    { label: 'Reviews Due', value: c.overdueRevisionCount, sub: 'Today + overdue' }
  ];

  grid.innerHTML = kpis.map(k => `
    <div class="kpi ${k.accent ? 'kpi-accent' : ''}">
      <div class="kpi-label">${escapeHTML(k.label)}</div>
      <div class="kpi-value">${escapeHTML(String(k.value))}</div>
      <div class="kpi-sub">${escapeHTML(k.sub || '')}</div>
    </div>
  `).join('');
}

// ─── Recommendations ─────────────────────────────────────────────────────────
function renderRecommendations() {
  const el = qs('recommendations');
  if (!el) return;

  const recs = getNextActionRecommendations(STATE);
  if (!recs.length) {
    el.innerHTML = '<p class="empty-state">Log a session to get personalized recommendations.</p>';
    return;
  }

  const iconMap = {
    revision: '🔁', study: '📚', mistake_review: '⚠', neglect: '⏰', catch_up: '🏃'
  };
  const colorMap = {
    revision: urgency => urgency > 100 ? 'urgent' : 'warning',
    mistake_review: () => 'urgent',
    neglect: () => 'warning',
    study: () => '',
    catch_up: () => 'warning'
  };

  el.innerHTML = `<div class="rec-list">${recs.map(r => {
    const cls = (colorMap[r.type] || (() => ''))(r.urgency);
    return `<div class="rec-item ${cls}">
      <span class="rec-icon">${iconMap[r.type] || '📌'}</span>
      <div class="rec-body">
        <div class="rec-label">${escapeHTML(r.label)}</div>
        <div class="rec-reason">${escapeHTML(r.reason)}</div>
      </div>
      <button class="btn btn-sm btn-ghost" data-rec-action="${escapeHTML(r.actionType)}" data-rec-subject="${escapeHTML(r.subjectId || '')}">Start</button>
    </div>`;
  }).join('')}</div>`;
}

// ─── Readiness Gauge ─────────────────────────────────────────────────────────
function renderReadinessGauge() {
  const el = qs('readiness-gauge');
  if (!el) return;

  const score = STATE.computed.readinessScore;
  const pct = score != null ? score : 0;
  const circumference = 2 * Math.PI * 40; // r=40
  const offset = circumference * (1 - pct / 100);

  // Color based on score
  const color = pct >= 75 ? 'var(--green)' : pct >= 50 ? 'var(--yellow)' : pct >= 30 ? 'var(--orange)' : 'var(--red)';
  const label = pct >= 75 ? 'Strong' : pct >= 50 ? 'Building' : pct >= 30 ? 'Needs Work' : 'Starting';

  el.innerHTML = `
    <div class="gauge-wrap">
      <div class="gauge-ring">
        <svg viewBox="0 0 100 100" role="img" aria-label="Readiness gauge showing ${score != null ? Math.round(pct) + '%' : 'no data'}">
          <circle class="gauge-track" cx="50" cy="50" r="40" />
          <circle class="gauge-fill" cx="50" cy="50" r="40" />
        </svg>
        <div class="gauge-score">${score != null ? Math.round(pct) : '—'}</div>
      </div>
      <div class="gauge-label">${score != null ? escapeHTML(label) : 'No data yet'}</div>
    </div>
  `;
  // Set dynamic styles via DOM API to avoid XSS via template injection
  const fillCircle = el.querySelector('.gauge-fill');
  if (fillCircle) {
    fillCircle.setAttribute('stroke', color);
    fillCircle.setAttribute('stroke-dasharray', circumference);
    fillCircle.setAttribute('stroke-dashoffset', offset);
  }
  const scoreEl = el.querySelector('.gauge-score');
  if (scoreEl) scoreEl.style.color = color;
}

// ─── Today Progress ───────────────────────────────────────────────────────────
function renderTodayProgress() {
  const el = qs('today-progress');
  if (!el) return;

  const todayHours = roundTo(STATE.computed.todaySessionMinutes / 60, 1);
  const planned    = roundTo(plannedHoursForDate(todayISO(), STATE.settings), 1);
  const pct        = planned > 0 ? clamp(todayHours / planned, 0, 1) : 0;
  const color      = pct >= 1 ? 'green' : pct >= 0.5 ? '' : 'orange';

  const phase = !STATE.settings.intensePhaseDate || todayISO() >= STATE.settings.intensePhaseDate ? 'Intense Phase' : 'Normal Phase';

  el.innerHTML = `
    <div class="today-stats">
      <div style="text-align:center">
        <div style="font-size:2rem;font-weight:800;color:var(--blue);line-height:1">${todayHours}h</div>
        <div class="text-muted text-xs" style="margin-top:.2rem">of ${planned}h planned · ${phase}</div>
      </div>
      <div class="progress-wrap">
        <div class="progress-bar ${color}" style="width:${Math.round(pct*100)}%"></div>
      </div>
      <div style="text-align:center;font-size:var(--text-xs);color:var(--muted)">
        ${pct >= 1 ? '✅ Daily goal met!' : `${Math.round(pct*100)}% of today's goal`}
      </div>
    </div>
  `;
}

// ─── Weekly Progress ──────────────────────────────────────────────────────────
function renderWeeklyProgress() {
  const el = qs('weekly-progress');
  if (!el) return;

  const actual  = roundTo(STATE.computed.weeklyActualHours, 1);
  const planned = roundTo(STATE.computed.weeklyPlannedHours, 1);
  const pct     = planned > 0 ? clamp(actual / planned, 0, 1) : 0;
  const color   = pct >= 0.9 ? 'green' : pct >= 0.6 ? '' : 'orange';

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem">
      <span class="text-muted text-sm">This Week</span>
      <span class="fw-bold">${actual}h <span class="text-muted text-sm">/ ${planned}h</span></span>
    </div>
    <div class="progress-wrap">
      <div class="progress-bar ${color}" style="width:${Math.round(pct*100)}%"></div>
    </div>
    <div style="text-align:right;font-size:var(--text-xs);color:var(--muted);margin-top:.3rem">
      ${Math.round(pct*100)}% complete
    </div>
  `;
}

// ─── Subject Mastery Grid ─────────────────────────────────────────────────────
function renderSubjectMasteryGrid() {
  const el = qs('subject-mastery-grid');
  if (!el) return;

  el.innerHTML = STATE.subjects.map(subj => {
    const score = subj.masteryScore;
    const baseline = PRIOR_EXAM_BASELINE[subj.id];
    let cellClass = 'mastery-empty';
    if (score != null) {
      if (score >= 75) cellClass = 'mastery-strong';
      else if (score >= 50) cellClass = 'mastery-mid';
      else if (score >= 30) cellClass = 'mastery-weak';
      else cellClass = 'mastery-critical';
    }
    const tierLabel = baseline ? `Prior: ${baseline.score}` : (score != null ? 'Active' : 'Not started');

    return `<div class="mastery-cell ${cellClass}" title="${escapeHTML(subj.name)} — ${score != null ? `Mastery: ${fmtScore(score)}%` : 'Not started'}">
      <div class="mastery-cell-name">${escapeHTML(subj.shortName || subj.name)}</div>
      <div class="mastery-cell-score">${score != null ? Math.round(score) : '—'}</div>
      <div class="mastery-cell-tier">${escapeHTML(tierLabel)}</div>
    </div>`;
  }).join('');
}

// ─── Revision Due List ────────────────────────────────────────────────────────
function renderRevisionDueList() {
  const listEl = qs('revision-due-list');
  const countEl = qs('revision-due-count');
  if (!listEl) return;

  const queue = buildRevisionQueue(STATE.subjects);
  const due = getDueToday(queue);

  if (countEl) countEl.textContent = due.length;

  if (!due.length) {
    listEl.innerHTML = '<p class="empty-state">No reviews due today.</p>';
    return;
  }

  listEl.innerHTML = due.slice(0, 6).map(item => `
    <div class="rev-item ${item.urgent ? 'urgent' : item.overdueDays > 0 ? 'warning' : ''}">
      <div class="rev-body">
        <div class="rev-name">${escapeHTML(item.name)}</div>
        <div class="rev-meta">${escapeHTML(item.subjectName)} · ${item.overdueDays > 0 ? `${item.overdueDays}d overdue` : 'Due today'}</div>
      </div>
      <button class="btn btn-sm btn-ghost" data-action="switch-tab" data-tab="tab-revision">Review</button>
    </div>
  `).join('');

  if (due.length > 6) {
    listEl.insertAdjacentHTML('beforeend', `<div class="empty-state" style="padding:.5rem">+${due.length - 6} more — <a href="#" data-action="switch-tab" data-tab="tab-revision">See all</a></div>`);
  }

  // Event delegation for dashboard revision list actions (guard against duplicate binding)
  if (!listEl._delegated) {
    listEl._delegated = true;
    listEl.addEventListener('click', e => {
      const target = e.target.closest('[data-action]');
      if (!target) return;
      if (target.dataset.action === 'switch-tab') {
        e.preventDefault();
        switchTab(target.dataset.tab);
      }
    });
  }
}

// ─── Weak Areas List ──────────────────────────────────────────────────────────
function renderWeakAreasList() {
  const el = qs('weak-areas-list');
  if (!el) return;

  const sorted = [...STATE.subjects]
    .filter(s => s.priorityScore != null || PRIOR_EXAM_BASELINE[s.id])
    .sort((a, b) => {
      const pa = a.priorityScore ?? (PRIOR_EXAM_BASELINE[a.id] ? (10 - PRIOR_EXAM_BASELINE[a.id].score) * 10 : 50);
      const pb = b.priorityScore ?? (PRIOR_EXAM_BASELINE[b.id] ? (10 - PRIOR_EXAM_BASELINE[b.id].score) * 10 : 50);
      return pb - pa;
    })
    .slice(0, 6);

  if (!sorted.length) {
    el.innerHTML = '<p class="empty-state">Complete a session to see priorities.</p>';
    return;
  }

  el.innerHTML = sorted.map(subj => {
    const priority = subj.priorityScore ?? (PRIOR_EXAM_BASELINE[subj.id] ? (10 - PRIOR_EXAM_BASELINE[subj.id].score) * 10 : 50);
    const baseline = PRIOR_EXAM_BASELINE[subj.id];
    const tierClass = baseline?.tier === 'WEAK' ? 'badge-red' : baseline?.tier === 'MID' ? 'badge-orange' : 'badge-green';
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:.4rem .6rem;background:var(--surf2);border-radius:var(--radius);margin-bottom:.3rem">
        <div>
          <div style="font-size:var(--text-sm);font-weight:600">${escapeHTML(subj.shortName || subj.name)}</div>
          <div style="font-size:var(--text-xs);color:var(--muted)">Priority: ${Math.round(priority)}</div>
        </div>
        <span class="badge ${tierClass}">${baseline?.tier || 'Active'}</span>
      </div>`;
  }).join('');
}
