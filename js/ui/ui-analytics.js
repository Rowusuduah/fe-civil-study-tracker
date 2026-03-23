/**
 * ui-analytics.js — Charts, heatmap, analytics KPIs, readiness forecast.
 * All charts are pure CSS (no external libraries).
 */

let _analyticsRange = 'all';

function renderAnalyticsTab() {
  const rangeEl = qs('analytics-range');
  _analyticsRange = rangeEl?.value || 'all';

  const filteredSessions = getFilteredSessions();
  renderAnalyticsKPIs(filteredSessions);
  renderStudyHeatmap();
  renderHoursPerSubject(filteredSessions);
  renderAccuracyBySubject(filteredSessions);
  renderHoursOverTime(filteredSessions);
  renderConfidenceVsAccuracy(filteredSessions);
  renderPlannedVsActual();
  renderCoverageChart();
  renderReadinessForecast();
}

function getFilteredSessions() {
  if (_analyticsRange === 'all') return STATE.sessions;
  const days = parseInt(_analyticsRange);
  const cutoff = addDays(todayISO(), -days);
  return STATE.sessions.filter(s => s.date >= cutoff);
}

// ─── Analytics KPIs ───────────────────────────────────────────────────────────
function renderAnalyticsKPIs(sessions) {
  const el = qs('analytics-kpis');
  if (!el) return;

  const totalMins = sessions.reduce((s, x) => s + (x.durationMinutes || 0), 0);
  const totalQ    = sessions.reduce((s, x) => s + (x.questionsAttempted || 0), 0);
  const correctQ  = sessions.reduce((s, x) => s + (x.questionsCorrect || 0), 0);
  const accuracy  = safeAccuracy(correctQ, totalQ);
  const avgFatigue= average(sessions.map(s => s.mentalFatigue).filter(Boolean));
  const burnout   = detectBurnoutRisk(sessions);

  const kpis = [
    { label: 'Hours Studied', value: fmtHours(totalMins / 60), sub: `${sessions.length} sessions` },
    { label: 'Questions',     value: totalQ.toLocaleString(), sub: accuracy != null ? `${fmtPct(accuracy)} accuracy` : 'No question data' },
    { label: 'Correct',       value: correctQ.toLocaleString(), sub: totalQ > 0 ? `${totalQ - correctQ} missed` : '' },
    { label: 'Avg Fatigue',   value: avgFatigue != null ? roundTo(avgFatigue, 1) : '—', sub: burnout ? '⚠ Burnout risk' : 'Levels 1–5' },
    { label: 'Readiness',     value: STATE.computed.readinessScore != null ? `${Math.round(STATE.computed.readinessScore)}%` : '—', sub: 'Weighted mastery' },
    { label: 'Coverage',      value: `${Math.round(overallCoverageScore(STATE.subjects) || 0)}%`, sub: 'Subtopics done' }
  ];

  el.innerHTML = kpis.map(k => `
    <div class="kpi">
      <div class="kpi-label">${escapeHTML(k.label)}</div>
      <div class="kpi-value">${escapeHTML(String(k.value))}</div>
      <div class="kpi-sub">${escapeHTML(k.sub || '')}</div>
    </div>`).join('');
}

// ─── Study Heatmap ────────────────────────────────────────────────────────────
function renderStudyHeatmap() {
  const el = qs('study-heatmap');
  if (!el) return;

  // Build day → hours map
  const dayMap = {};
  STATE.sessions.forEach(s => {
    dayMap[s.date] = (dayMap[s.date] || 0) + (s.durationMinutes || 0) / 60;
  });

  // Show last 52 weeks
  const today = todayISO();
  const startDate = addDays(today, -(52 * 7 - 1));

  // Group by weeks
  const weeks = [];
  let weekDays = [];
  let cur = startDate;

  // Align to Sunday start
  const startDayOfWeek = parseISO(startDate).getDay();
  for (let i = 0; i < startDayOfWeek; i++) weekDays.push(null); // padding

  while (cur <= today) {
    weekDays.push(cur);
    if (weekDays.length === 7) {
      weeks.push(weekDays);
      weekDays = [];
    }
    cur = addDays(cur, 1);
  }
  if (weekDays.length) {
    while (weekDays.length < 7) weekDays.push(null);
    weeks.push(weekDays);
  }

  // Max hours per day for scaling
  const maxHours = Math.max(...Object.values(dayMap), 1);

  const html = `<div class="heatmap-grid">${weeks.map(week =>
    `<div class="heatmap-week">${week.map(day => {
      if (!day) return '<div class="heatmap-cell" style="opacity:0"></div>';
      const hours = dayMap[day] || 0;
      const level = hours === 0 ? 0 : Math.min(5, Math.ceil(hours / (maxHours / 5)));
      const isToday = day === today;
      return `<div class="heatmap-cell" data-level="${level}"
        title="${day}: ${roundTo(hours, 1)}h"
        style="${isToday ? 'outline:2px solid var(--blue)' : ''}"></div>`;
    }).join('')}</div>`
  ).join('')}</div>
  <div class="text-xs text-muted" style="margin-top:.5rem">
    Last 52 weeks · Darker = more hours
  </div>`;

  el.innerHTML = html;
}

// ─── Hours per Subject ────────────────────────────────────────────────────────
function renderHoursPerSubject(sessions) {
  const el = qs('chart-hours-subject');
  if (!el) return;

  const subjectHours = {};
  sessions.forEach(s => {
    const subj = STATE.computed.subjectMap[s.subjectId];
    const name = subj?.shortName || subj?.name || 'Unknown';
    subjectHours[name] = (subjectHours[name] || 0) + (s.durationMinutes || 0) / 60;
  });

  const sorted = Object.entries(subjectHours)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  if (!sorted.length) { el.innerHTML = '<p class="empty-state">No session data.</p>'; return; }

  const max = sorted[0][1];
  el.innerHTML = `<div class="bar-chart">${sorted.map(([name, hours]) => `
    <div class="bar-row">
      <span class="bar-label" title="${escapeHTML(name)}">${escapeHTML(name)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${max > 0 ? Math.round(hours/max*100) : 0}%"></div></div>
      <span class="bar-value">${roundTo(hours, 1)}h</span>
    </div>`).join('')}</div>`;
}

// ─── Accuracy by Subject ──────────────────────────────────────────────────────
function renderAccuracyBySubject(sessions) {
  const el = qs('chart-accuracy-subject');
  if (!el) return;

  const subjectData = {};
  sessions.filter(s => s.questionsAttempted > 0).forEach(s => {
    const subj = STATE.computed.subjectMap[s.subjectId];
    const name = subj?.shortName || 'Unknown';
    if (!subjectData[name]) subjectData[name] = { correct: 0, attempted: 0 };
    subjectData[name].correct   += s.questionsCorrect   || 0;
    subjectData[name].attempted += s.questionsAttempted || 0;
  });

  const sorted = Object.entries(subjectData)
    .map(([name, d]) => [name, safeAccuracy(d.correct, d.attempted)])
    .filter(([, a]) => a != null)
    .sort((a, b) => (b[1] || 0) - (a[1] || 0));

  if (!sorted.length) { el.innerHTML = '<p class="empty-state">No question data yet.</p>'; return; }

  el.innerHTML = `<div class="bar-chart">${sorted.slice(0, 10).map(([name, acc]) => {
    const pct = Math.round(acc * 100);
    const color = pct >= 70 ? 'var(--green)' : pct >= 50 ? 'var(--yellow)' : 'var(--red)';
    return `<div class="bar-row">
      <span class="bar-label">${escapeHTML(name)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>
      <span class="bar-value">${pct}%</span>
    </div>`;
  }).join('')}</div>`;
}

// ─── Hours Over Time ──────────────────────────────────────────────────────────
function renderHoursOverTime(sessions) {
  const el = qs('chart-hours-time');
  if (!el) return;

  // Aggregate by week
  const weekMap = {};
  sessions.forEach(s => {
    const week = getMondayOfWeek(s.date);
    weekMap[week] = (weekMap[week] || 0) + (s.durationMinutes || 0) / 60;
  });

  const weeks = Object.entries(weekMap).sort((a, b) => a[0].localeCompare(b[0])).slice(-12);
  if (!weeks.length) { el.innerHTML = '<p class="empty-state">No data yet.</p>'; return; }

  const max = Math.max(...weeks.map(([, h]) => h), 1);
  el.innerHTML = `<div class="bar-chart">${weeks.map(([week, hours]) => `
    <div class="bar-row">
      <span class="bar-label">${escapeHTML(fmtDateShort(week))}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.round(hours/max*100)}%"></div></div>
      <span class="bar-value">${roundTo(hours, 1)}h</span>
    </div>`).join('')}</div>`;
}

// ─── Confidence vs Accuracy ───────────────────────────────────────────────────
function renderConfidenceVsAccuracy(sessions) {
  const el = qs('chart-conf-accuracy');
  if (!el) return;

  const data = sessions
    .filter(s => s.confidenceAfter && s.questionsAttempted > 0)
    .map(s => ({
      conf: s.confidenceAfter,
      acc:  safeAccuracy(s.questionsCorrect, s.questionsAttempted)
    }))
    .filter(d => d.acc != null);

  if (!data.length) { el.innerHTML = '<p class="empty-state">No data yet.</p>'; return; }

  // Group by confidence level 1–5
  const groups = {};
  data.forEach(d => {
    groups[d.conf] = groups[d.conf] || [];
    groups[d.conf].push(d.acc);
  });

  el.innerHTML = `<div class="bar-chart">${[1,2,3,4,5].map(conf => {
    const accs = groups[conf] || [];
    const avg = average(accs);
    const pct = avg != null ? Math.round(avg * 100) : 0;
    const color = conf >= 4 && avg != null && avg < 0.5 ? 'var(--red)' : 'var(--blue)';
    return `<div class="bar-row">
      <span class="bar-label">Confidence ${conf}★</span>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>
      <span class="bar-value">${avg != null ? `${pct}%` : '—'}</span>
    </div>`;
  }).join('')}</div>
  <div class="text-xs text-muted" style="margin-top:.4rem">Average accuracy by confidence rating</div>`;
}

// ─── Planned vs Actual ────────────────────────────────────────────────────────
function renderPlannedVsActual() {
  const el = qs('chart-planned-actual');
  if (!el) return;

  const sessionMap = {};
  STATE.sessions.forEach(s => {
    sessionMap[s.date] = (sessionMap[s.date] || 0) + (s.durationMinutes || 0) / 60;
  });

  const weeks = {};
  STATE.plan.forEach(d => {
    const week = getMondayOfWeek(d.date);
    if (!weeks[week]) weeks[week] = { planned: 0, actual: 0 };
    weeks[week].planned += d.plannedHours || 0;
    weeks[week].actual  += sessionMap[d.date] || 0;
  });

  const sorted = Object.entries(weeks).sort((a, b) => a[0].localeCompare(b[0])).slice(-10);
  if (!sorted.length) { el.innerHTML = '<p class="empty-state">Generate a plan to see this chart.</p>'; return; }

  const maxH = Math.max(...sorted.flatMap(([, w]) => [w.planned, w.actual]), 1);

  el.innerHTML = `<div class="bar-chart">${sorted.map(([week, w]) => {
    const planPct   = Math.round(w.planned / maxH * 100);
    const actualPct = Math.round(w.actual / maxH * 100);
    const color     = w.actual >= w.planned * 0.9 ? 'var(--green)' : 'var(--orange)';
    return `<div style="margin-bottom:.35rem">
      <div style="font-size:var(--text-xs);color:var(--muted);margin-bottom:.15rem">${escapeHTML(fmtDateShort(week))}</div>
      <div style="display:flex;flex-direction:column;gap:2px">
        <div style="display:flex;align-items:center;gap:.4rem">
          <span style="width:50px;font-size:var(--text-xs);color:var(--muted)">Plan</span>
          <div class="bar-track" style="flex:1"><div class="bar-fill" style="width:${planPct}%;background:var(--surf4)"></div></div>
          <span style="width:35px;font-size:var(--text-xs);text-align:right">${roundTo(w.planned,1)}h</span>
        </div>
        <div style="display:flex;align-items:center;gap:.4rem">
          <span style="width:50px;font-size:var(--text-xs);color:var(--muted)">Actual</span>
          <div class="bar-track" style="flex:1"><div class="bar-fill" style="width:${actualPct}%;background:${color}"></div></div>
          <span style="width:35px;font-size:var(--text-xs);text-align:right">${roundTo(w.actual,1)}h</span>
        </div>
      </div>
    </div>`;
  }).join('')}</div>`;
}

// ─── Coverage Chart ───────────────────────────────────────────────────────────
function renderCoverageChart() {
  const el = qs('chart-coverage');
  if (!el) return;

  const data = STATE.subjects.map(s => ({
    name: s.shortName || s.name,
    pct:  Math.round(subjectCompletionRatio(s) * 100)
  })).sort((a, b) => b.pct - a.pct);

  el.innerHTML = `<div class="bar-chart">${data.map(d => {
    const color = d.pct >= 75 ? 'var(--green)' : d.pct >= 40 ? 'var(--blue)' : 'var(--orange)';
    return `<div class="bar-row">
      <span class="bar-label">${escapeHTML(d.name)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${d.pct}%;background:${color}"></div></div>
      <span class="bar-value">${d.pct}%</span>
    </div>`;
  }).join('')}</div>`;
}

// ─── Readiness Forecast ────────────────────────────────────────────────────────
function renderReadinessForecast() {
  const el = qs('readiness-forecast');
  if (!el) return;

  // Build historical readiness from sessions by date
  const sortedSessions = [...STATE.sessions].sort((a, b) => a.date.localeCompare(b.date));
  if (sortedSessions.length < 3) {
    el.innerHTML = '<p class="empty-state">Log at least 3 sessions to see a readiness forecast.</p>';
    return;
  }

  // Sample weekly readiness checkpoints
  const weekPoints = {};
  sortedSessions.forEach(s => {
    const week = getMondayOfWeek(s.date);
    weekPoints[week] = STATE.computed.readinessScore; // simplified: use current readiness
  });

  // Simple trend display
  const current = STATE.computed.readinessScore;
  const daysLeft = STATE.computed.daysUntilExam;
  const passThreshold = 70; // rough passing target

  el.innerHTML = `
    <div style="display:flex;gap:1.5rem;align-items:center;flex-wrap:wrap">
      <div style="text-align:center">
        <div style="font-size:2.5rem;font-weight:800;color:${current != null && current >= 70 ? 'var(--green)' : 'var(--orange)'}">
          ${current != null ? `${Math.round(current)}%` : '—'}
        </div>
        <div class="text-xs text-muted">Current Readiness</div>
      </div>
      <div style="flex:1">
        <div style="margin-bottom:.5rem">
          <div class="text-sm">Progress to 70% target (approximate passing threshold)</div>
          <div class="progress-wrap" style="margin-top:.35rem">
            <div class="progress-bar ${current != null && current >= 70 ? 'green' : ''}"
              style="width:${current != null ? Math.min(100, Math.round(current/70*100)) : 0}%"></div>
          </div>
          <div class="text-xs text-muted" style="margin-top:.2rem">
            ${current != null && current >= 70 ? '✅ At target!' : current != null ? `${Math.round(70 - current)} points to go` : 'No data yet'}
          </div>
        </div>
        <div class="text-xs text-muted">${daysLeft} days remaining · Keep studying daily to improve readiness.</div>
      </div>
    </div>`;
}

// ─── Range Change Handler ─────────────────────────────────────────────────────
function initAnalyticsRange() {
  const rangeEl = qs('analytics-range');
  if (rangeEl) rangeEl.addEventListener('change', renderAnalyticsTab);
}
