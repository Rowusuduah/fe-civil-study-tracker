/**
 * ui-assessments.js — Mock exam logger and trend view.
 */

function renderAssessmentsTab() {
  renderAssessmentList();
  renderAssessmentTrend();
  buildSectionScoreInputs();
}

function initAssessmentForm() {
  qs('assessment-date') && setDateToToday('assessment-date');
  const form = qs('assessment-form');
  if (form) form.addEventListener('submit', e => { e.preventDefault(); saveAssessment(); });
  qs('assessment-cancel-btn')?.addEventListener('click', resetAssessmentForm);
}

// ─── Section Score Inputs ─────────────────────────────────────────────────────
function buildSectionScoreInputs() {
  const el = qs('assessment-section-scores');
  if (!el) return;
  el.innerHTML = STATE.subjects.map(s => `
    <div class="form-group">
      <label class="form-label">${escapeHTML(s.shortName || s.name)}</label>
      <input type="number" class="form-input" min="0" max="100"
        id="sec-score-${escapeHTML(s.id)}" placeholder="% correct" />
    </div>`).join('');
}

// ─── Save ─────────────────────────────────────────────────────────────────────
function saveAssessment() {
  const date    = qs('assessment-date')?.value;
  const total   = parseInt(qs('assessment-total')?.value || 0);
  const correct = parseInt(qs('assessment-correct')?.value || 0);
  if (!date) { showToast('Please select a date.', 'error'); return; }

  const sectionScores = {};
  STATE.subjects.forEach(s => {
    const val = parseFloat(qs(`sec-score-${s.id}`)?.value || '');
    if (!isNaN(val)) sectionScores[s.id] = { pct: clamp(val, 0, 100) };
  });

  const id = qs('assessment-id')?.value;
  const isEdit = !!id;

  const assessment = {
    id: isEdit ? id : genId(),
    date,
    type:            qs('assessment-type')?.value || 'full_mock',
    totalQuestions:  total,
    correct,
    accuracy:        safeAccuracy(correct, total),
    timingMinutes:   parseInt(qs('assessment-time')?.value || 0),
    sectionScores,
    notes:           qs('assessment-notes')?.value?.trim() || '',
    remediationNotes:qs('assessment-remediation')?.value?.trim() || '',
    createdAt: isEdit ? undefined : new Date().toISOString()
  };

  if (isEdit) {
    const idx = STATE.assessments.findIndex(a => a.id === id);
    if (idx >= 0) STATE.assessments[idx] = { ...STATE.assessments[idx], ...assessment };
  } else {
    STATE.assessments.unshift(assessment);
  }

  persistAssessments();
  resetAssessmentForm();
  renderAssessmentList();
  renderAssessmentTrend();
  showToast(isEdit ? 'Mock exam updated.' : 'Mock exam saved!', 'success');
}

function resetAssessmentForm() {
  qs('assessment-id').value = '';
  qs('assessment-form-title').textContent = 'Log Mock Exam';
  qs('assessment-form')?.reset();
  setDateToToday('assessment-date');
  buildSectionScoreInputs();
  hide(qs('assessment-cancel-btn'));
}

function editAssessment(id) {
  const a = STATE.assessments.find(x => x.id === id);
  if (!a) return;
  qs('assessment-id').value = a.id;
  qs('assessment-form-title').textContent = 'Edit Mock Exam';
  if (qs('assessment-date'))    qs('assessment-date').value    = a.date || '';
  if (qs('assessment-type'))    qs('assessment-type').value    = a.type || 'full_mock';
  if (qs('assessment-total'))   qs('assessment-total').value   = a.totalQuestions || '';
  if (qs('assessment-correct')) qs('assessment-correct').value = a.correct || '';
  if (qs('assessment-time'))    qs('assessment-time').value    = a.timingMinutes || '';
  if (qs('assessment-notes'))   qs('assessment-notes').value   = a.notes || '';
  if (qs('assessment-remediation')) qs('assessment-remediation').value = a.remediationNotes || '';
  // Restore section scores
  if (a.sectionScores) {
    Object.entries(a.sectionScores).forEach(([subjId, data]) => {
      const inp = qs(`sec-score-${subjId}`);
      if (inp) inp.value = data.pct ?? '';
    });
  }
  show(qs('assessment-cancel-btn'));
}

function deleteAssessment(id) {
  if (!confirm('Delete this mock exam record?')) return;
  STATE.assessments = STATE.assessments.filter(a => a.id !== id);
  persistAssessments();
  renderAssessmentList();
  renderAssessmentTrend();
  showToast('Mock exam deleted.', 'info');
}

// ─── Assessment List ──────────────────────────────────────────────────────────
function renderAssessmentList() {
  const el = qs('assessment-list');
  if (!el) return;

  if (!STATE.assessments.length) {
    el.innerHTML = '<p class="empty-state">No mock exams logged yet.</p>';
    return;
  }

  const typeLabels = { full_mock:'Full Mock', section_quiz:'Section Quiz', self_test:'Self Test' };

  el.innerHTML = STATE.assessments.map(a => {
    const pct = a.accuracy != null ? fmtPct(a.accuracy) : '—';
    const colorClass = a.accuracy != null ? (a.accuracy >= 0.7 ? 'badge-green' : a.accuracy >= 0.5 ? 'badge-yellow' : 'badge-red') : 'badge-muted';
    return `<div class="item-row">
      <div class="item-body">
        <div class="item-title">
          <span class="badge badge-purple">${escapeHTML(typeLabels[a.type] || a.type)}</span>
          <span style="margin-left:.4rem">${escapeHTML(fmtDate(a.date))}</span>
          <span class="badge ${colorClass}" style="margin-left:.4rem">${pct}</span>
        </div>
        <div class="item-meta">
          ${a.totalQuestions ? `<span>${a.correct}/${a.totalQuestions} correct</span>` : ''}
          ${a.timingMinutes ? `<span>${escapeHTML(fmtDuration(a.timingMinutes))}</span>` : ''}
          ${a.notes ? `<span style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHTML(a.notes)}">${escapeHTML(a.notes)}</span>` : ''}
        </div>
      </div>
      <div class="item-actions">
        <button class="item-btn" onclick="editAssessment('${escapeHTML(a.id)}')">Edit</button>
        <button class="item-btn del" onclick="deleteAssessment('${escapeHTML(a.id)}')">Del</button>
      </div>
    </div>`;
  }).join('');
}

// ─── Score Trend Chart ────────────────────────────────────────────────────────
function renderAssessmentTrend() {
  const el = qs('assessment-trend-chart');
  if (!el) return;

  const exams = [...STATE.assessments]
    .filter(a => a.accuracy != null)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (exams.length < 2) {
    el.innerHTML = `<p class="empty-state">${exams.length === 0 ? 'Log mock exams to see score trends.' : 'Log at least 2 exams to see trends.'}</p>`;
    return;
  }

  // Simple CSS bar chart showing score trend
  const max = Math.max(...exams.map(a => a.accuracy || 0));
  el.innerHTML = `<div class="bar-chart">${exams.map(a => {
    const pct = Math.round((a.accuracy || 0) * 100);
    const color = pct >= 70 ? 'var(--green)' : pct >= 50 ? 'var(--yellow)' : 'var(--red)';
    return `<div class="bar-row">
      <span class="bar-label">${escapeHTML(fmtDateShort(a.date))}</span>
      <div class="bar-track">
        <div class="bar-fill" style="width:${pct}%;background:${color}"></div>
      </div>
      <span class="bar-value">${pct}%</span>
    </div>`;
  }).join('')}</div>
  <div class="text-xs text-muted" style="margin-top:.5rem">
    ${exams.length} exams · Latest: ${fmtPct(exams[exams.length-1].accuracy)} · Best: ${fmtPct(max)}
  </div>`;
}
