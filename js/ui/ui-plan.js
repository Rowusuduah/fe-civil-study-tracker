/**
 * ui-plan.js — Study plan calendar and day detail renderer.
 */

let _calViewMonth = null; // { year, month }

function renderPlanTab() {
  const today = todayISO();
  if (!_calViewMonth) {
    const d = parseISO(today);
    _calViewMonth = { year: d.getFullYear(), month: d.getMonth() };
  }
  renderPlanKPIs();
  renderCalendar();
  renderWeeklyMilestones();
}

// ─── Plan KPIs ────────────────────────────────────────────────────────────────
function renderPlanKPIs() {
  const el = qs('plan-kpis');
  if (!el) return;

  if (!STATE.plan.length) {
    el.innerHTML = `<div class="kpi"><div class="kpi-label">Plan Status</div><div class="kpi-value" style="font-size:1rem">No plan yet</div><div class="kpi-sub">Click "Generate Plan"</div></div>`;
    return;
  }

  const summary = getPlanSummary(STATE.plan, STATE.sessions, STATE.settings);
  const kpis = [
    { label: 'Total Days',    value: summary.totalDays,                   sub: `${summary.phases.normal} normal · ${summary.phases.intense} intense` },
    { label: 'Total Planned', value: `${summary.totalPlannedHours}h`,     sub: 'Full period' },
    { label: 'Studied So Far',value: `${summary.actualHoursToDate}h`,     sub: `of ${summary.plannedHoursToDate}h planned` },
    { label: 'Remaining',     value: `${summary.remainingPlannedHours}h`, sub: 'Still ahead' },
    { label: 'Progress',      value: `${summary.progressPct}%`,           sub: 'On-plan', accent: true },
    { label: 'Missed Days',   value: summary.missedDays,                  sub: '<50% of goal' }
  ];
  el.innerHTML = kpis.map(k => `
    <div class="kpi ${k.accent ? 'kpi-accent' : ''}">
      <div class="kpi-label">${escapeHTML(k.label)}</div>
      <div class="kpi-value">${escapeHTML(String(k.value))}</div>
      <div class="kpi-sub">${escapeHTML(k.sub || '')}</div>
    </div>`).join('');
}

// ─── Calendar ─────────────────────────────────────────────────────────────────
function renderCalendar() {
  const grid = qs('calendar-grid');
  const label = qs('cal-month-label');
  if (!grid || !_calViewMonth) return;

  const { year, month } = _calViewMonth;
  const today = todayISO();

  if (label) {
    label.textContent = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  // Build plan day lookup
  const planMap = {};
  STATE.plan.forEach(d => { planMap[d.date] = d; });

  // Session hours per day
  const sessionMap = {};
  STATE.sessions.forEach(s => {
    sessionMap[s.date] = (sessionMap[s.date] || 0) + (s.durationMinutes || 0) / 60;
  });

  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  let html = weekdays.map(d => `<div class="cal-weekday">${d}</div>`).join('');

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) html += '<div class="cal-day empty"></div>';

  for (let day = 1; day <= daysInMonth; day++) {
    const y = String(year);
    const m = String(month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    const iso = `${y}-${m}-${d}`;
    const plan = planMap[iso];
    const actual = sessionMap[iso] || 0;

    let classes = 'cal-day';
    if (iso === today) classes += ' today';
    if (plan) {
      if (plan.phase === 'intense') classes += ' intense';
      if (plan.isFinalSprint) classes += ' sprint';
      else if (plan.isMockDay) classes += ' mock-d';
      if (iso < today) {
        classes += actual >= plan.plannedHours * 0.5 ? ' done' : ' missed';
      } else {
        classes += ' planned';
      }
      if (plan.catchUpFlag) classes += ' catchup';
    }

    const hoursText = plan ? `${roundTo(actual, 1)}/${plan.plannedHours}h` : '';

    html += `<div class="${classes}" data-date="${iso}" title="${iso}${plan ? ` — ${hoursText}` : ''}" onclick="showDayDetail('${iso}')">
      <span>${day}</span>
      ${plan ? '<div class="cal-dot"></div>' : ''}
    </div>`;
  }

  grid.innerHTML = html;
}

function calNav(dir) {
  if (!_calViewMonth) return;
  let { year, month } = _calViewMonth;
  month += dir;
  if (month < 0)  { month = 11; year--; }
  if (month > 11) { month = 0;  year++; }
  _calViewMonth = { year, month };
  renderCalendar();
}

// ─── Day Detail Panel ────────────────────────────────────────────────────────
function showDayDetail(isoDate) {
  const panel = qs('day-detail-panel');
  const title = qs('day-detail-title');
  const content = qs('day-detail-content');
  if (!panel || !title || !content) return;

  const plan = STATE.plan.find(d => d.date === isoDate);
  const daySessions = STATE.sessions.filter(s => s.date === isoDate);
  const actualHours = roundTo(daySessions.reduce((s, x) => s + (x.durationMinutes || 0) / 60, 0), 1);

  title.textContent = fmtDate(isoDate);

  let html = '';

  if (plan) {
    const phaseLabel = plan.isFinalSprint ? '🔥 Final Sprint' : plan.phase === 'intense' ? '⚡ Intense Phase' : '📘 Normal Phase';
    const catchUpNote = plan.catchUpFlag ? `<span class="badge badge-orange" style="margin-left:.5rem">+${plan.catchUpHours}h catch-up</span>` : '';
    html += `<div style="margin-bottom:.75rem">
      <span class="badge badge-blue">${phaseLabel}</span>${catchUpNote}
      <span class="badge badge-muted" style="margin-left:.5rem">${plan.plannedHours}h planned</span>
      <span class="badge ${actualHours >= plan.plannedHours * 0.9 ? 'badge-green' : 'badge-orange'}" style="margin-left:.5rem">${actualHours}h actual</span>
    </div>`;

    if (plan.studyBlocks?.length) {
      html += '<div class="text-muted text-sm fw-bold" style="margin-bottom:.4rem">Study Blocks:</div>';
      html += plan.studyBlocks.map(b => {
        const subjName = b.subjectId ? (STATE.computed.subjectMap[b.subjectId]?.shortName || b.subjectId) : '';
        return `<div style="display:flex;align-items:center;gap:.5rem;padding:.35rem .6rem;background:var(--surf2);border-radius:var(--radius);margin-bottom:.3rem;font-size:var(--text-sm)">
          <span class="badge badge-muted">${escapeHTML(fmtDuration(b.durationMinutes))}</span>
          <span>${escapeHTML(b.label || subjName || b.type)}</span>
        </div>`;
      }).join('');
    }
  }

  if (daySessions.length) {
    html += `<div class="text-muted text-sm fw-bold" style="margin:.75rem 0 .4rem">Sessions Logged (${daySessions.length}):</div>`;
    html += daySessions.map(s => {
      const subj = STATE.computed.subjectMap[s.subjectId];
      return `<div style="padding:.4rem .6rem;background:var(--surf3);border-radius:var(--radius);margin-bottom:.3rem;font-size:var(--text-sm)">
        <strong>${escapeHTML(subj?.shortName || 'Session')}</strong> — ${escapeHTML(fmtDuration(s.durationMinutes))} · ${escapeHTML(s.type)}
        ${s.questionsAttempted ? ` · ${s.questionsAttempted} Qs (${s.questionsCorrect} correct)` : ''}
      </div>`;
    }).join('');
  } else if (!plan) {
    html = '<p class="empty-state">No plan or sessions for this date.</p>';
  }

  content.innerHTML = html;
  show(panel);
}

// ─── Weekly Milestones ────────────────────────────────────────────────────────
function renderWeeklyMilestones() {
  const el = qs('weekly-milestones');
  if (!el) return;

  if (!STATE.plan.length) {
    el.innerHTML = '<p class="empty-state">Generate a plan to see milestones.</p>';
    return;
  }

  const milestones = generateWeeklyMilestones(STATE.subjects, STATE.settings);
  const today = todayISO();

  if (!milestones.length) {
    el.innerHTML = '<p class="empty-state">No milestones generated.</p>';
    return;
  }

  el.innerHTML = `<div style="display:flex;flex-direction:column;gap:.5rem">
    ${milestones.slice(0, 12).map(m => {
      const isPast = m.weekStart < today;
      const isCurrent = !isPast && addDays(m.weekStart, 7) >= today;
      return `<div style="display:flex;align-items:center;gap:.75rem;padding:.6rem .85rem;background:${isCurrent ? 'rgba(59,130,246,.08)' : 'var(--surf2)'};border-radius:var(--radius);border-left:3px solid ${isCurrent ? 'var(--blue)' : 'var(--border2)'}">
        <span class="badge ${isPast ? 'badge-green' : isCurrent ? 'badge-blue' : 'badge-muted'}">Wk ${m.weekNum}</span>
        <span style="font-size:var(--text-sm)">${escapeHTML(fmtDateShort(m.weekStart))}</span>
        <span class="text-muted text-sm" style="flex:1">Target: ${m.targets[0].targetCompletionPct}% overall coverage</span>
        ${isCurrent ? '<span class="badge badge-blue">Current</span>' : ''}
      </div>`;
    }).join('')}
  </div>`;
}

// Plan actions are wired in app.js bindAllEvents()
