/**
 * ui-revision.js — Revision queue, mistake notebook, keep missing, neglected.
 */

function renderRevisionTab() {
  renderRevisionDueItems();
  renderRevisionUpcoming();
  renderMistakeList();
  renderKeepMissingList();
  renderNeglectedList();
  updateRevisionBadges();
}

function updateRevisionBadges() {
  const today = todayISO();
  const queue = buildRevisionQueue(STATE.subjects, today);
  const due   = getDueToday(queue, today);
  const el1 = qs('rev-total-due');
  const el2 = qs('rev-due-count');
  if (el1) el1.textContent = `${due.length} due`;
  if (el2) el2.textContent = due.length;
}

// ─── Due Today ────────────────────────────────────────────────────────────────
function renderRevisionDueItems() {
  const el = qs('rev-due-list');
  if (!el) return;

  const today = todayISO();
  const queue = buildRevisionQueue(STATE.subjects, today);
  const due   = getDueToday(queue, today);

  if (!due.length) {
    el.innerHTML = '<p class="empty-state">Nothing due today. Great job staying current!</p>';
    return;
  }

  el.innerHTML = due.map(item => revItemHTML(item)).join('');
}

// ─── Upcoming ─────────────────────────────────────────────────────────────────
function renderRevisionUpcoming() {
  const el = qs('rev-upcoming-list');
  if (!el) return;

  const today = todayISO();
  const queue = buildRevisionQueue(STATE.subjects, today);
  const upcoming = getUpcoming(queue, 7, today);

  if (!upcoming.length) {
    el.innerHTML = '<p class="empty-state">No upcoming reviews in the next 7 days.</p>';
    return;
  }

  el.innerHTML = upcoming.slice(0, 15).map(item => revItemHTML(item)).join('');
}

function revItemHTML(item) {
  const overdue = item.overdueDays > 0;
  const cls = item.urgent ? 'urgent' : overdue ? 'warning' : '';
  return `<div class="rev-item ${cls}">
    <div class="rev-body">
      <div class="rev-name">${escapeHTML(item.name)}</div>
      <div class="rev-meta">
        ${escapeHTML(item.subjectName)} · ${escapeHTML(item.topicName)}
        · ${overdue ? `<span class="text-red">${item.overdueDays}d overdue</span>` : escapeHTML(relativeDate(item.nextReviewDate))}
        ${item.lastPerformance != null ? ` · Accuracy: ${fmtPct(item.lastPerformance)}` : ''}
      </div>
    </div>
    <button class="btn btn-sm btn-ghost" onclick="markRevisionDone('${escapeHTML(item.subtopicId)}')">Done ✓</button>
  </div>`;
}

function markRevisionDone(subtopicId) {
  const sub = STATE.computed.subtopicMap[subtopicId];
  if (!sub) return;

  const update = updateReviewSchedule({
    reviewCount: sub.reviewCount || 0,
    accuracy: sub.avgAccuracy,
    confidence: sub.avgConfidence,
    difficulty: sub.avgDifficulty,
    mistakeCount: sub.mistakeCount || 0,
    lastReviewDate: todayISO()
  });

  sub.reviewCount    = update.reviewCount;
  sub.reviewInterval = update.reviewInterval;
  sub.nextReviewDate = update.nextReviewDate;
  sub.lastRevisedDate= todayISO();

  persistSubjects();
  renderRevisionTab();
  renderDashboard();
  showToast('Marked as reviewed. Next: ' + escapeHTML(relativeDate(update.nextReviewDate)), 'success');
}

// ─── Mistake Notebook ─────────────────────────────────────────────────────────
function renderMistakeList() {
  const el = qs('mistake-list');
  if (!el) return;

  const unresolved = STATE.mistakes.filter(m => !m.resolved);

  if (!STATE.mistakes.length) {
    el.innerHTML = '<p class="empty-state">No mistakes logged. Keep pushing!</p>';
    return;
  }

  el.innerHTML = STATE.mistakes.slice(0, 30).map(m => {
    const subj = STATE.computed.subjectMap[m.subjectId];
    return `<div class="item-row ${m.resolved ? '' : 'flagged'}">
      <div class="item-body">
        <div class="item-title">${escapeHTML(m.questionRef || 'Mistake')} <span class="badge badge-muted">${escapeHTML(m.mistakeType)}</span></div>
        <div class="item-meta">
          <span>${escapeHTML(subj?.shortName || m.subjectId || '—')}</span>
          <span>${escapeHTML(fmtDate(m.createdAt?.slice(0,10) || ''))}</span>
          ${m.notes ? `<span style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHTML(m.notes)}">${escapeHTML(m.notes)}</span>` : ''}
        </div>
      </div>
      <div class="item-actions">
        ${!m.resolved ? `<button class="item-btn" onclick="resolveMistake('${escapeHTML(m.id)}')">✓ Resolve</button>` : '<span class="badge badge-green">Resolved</span>'}
        <button class="item-btn del" onclick="deleteMistake('${escapeHTML(m.id)}')">Del</button>
      </div>
    </div>`;
  }).join('');

  if (unresolved.length > 0) {
    el.insertAdjacentHTML('afterbegin', `<div class="badge badge-red" style="margin-bottom:.5rem">${unresolved.length} unresolved</div>`);
  }
}

function resolveMistake(id) {
  const m = STATE.mistakes.find(x => x.id === id);
  if (!m) return;
  m.resolved = true;
  persistMistakes();
  renderMistakeList();
  showToast('Mistake resolved!', 'success');
}

function deleteMistake(id) {
  if (!confirm('Delete this mistake entry?')) return;
  STATE.mistakes = STATE.mistakes.filter(m => m.id !== id);
  persistMistakes();
  renderMistakeList();
}

// ─── Keep Missing List ────────────────────────────────────────────────────────
function renderKeepMissingList() {
  const el = qs('keep-missing-list');
  if (!el) return;

  const items = getKeepMissingList(STATE.mistakes, STATE.subjects);

  if (!items.length) {
    el.innerHTML = '<p class="empty-state">No persistent problem areas. Great consistency!</p>';
    return;
  }

  el.innerHTML = items.map(item => `
    <div class="rev-item urgent">
      <div class="rev-body">
        <div class="rev-name">${escapeHTML(item.name)}</div>
        <div class="rev-meta">${escapeHTML(item.subjectName)} · ${item.mistakeCount} unresolved mistakes</div>
      </div>
    </div>`).join('');
}

// ─── Neglected Topics ─────────────────────────────────────────────────────────
function renderNeglectedList() {
  const el = qs('neglected-list');
  if (!el) return;

  const neglected = STATE.computed.neglectedSubtopics;

  if (!neglected.length) {
    el.innerHTML = '<p class="empty-state">No neglected topics. All covered recently!</p>';
    return;
  }

  el.innerHTML = neglected.slice(0, 12).map(sub => {
    const daysSince = sub.lastStudiedDate ? daysBetween(sub.lastStudiedDate, todayISO()) : null;
    return `<div class="rev-item warning">
      <div class="rev-body">
        <div class="rev-name">${escapeHTML(sub.name)}</div>
        <div class="rev-meta">
          ${escapeHTML(sub.subjectName || '')} ·
          ${daysSince != null ? `Not studied in ${daysSince} days` : 'Never studied'}
        </div>
      </div>
    </div>`;
  }).join('');

  if (neglected.length > 12) {
    el.innerHTML += `<p class="empty-state">+${neglected.length - 12} more neglected topics.</p>`;
  }
}

// ─── Mistake Modal ────────────────────────────────────────────────────────────

/** Called once at startup — wires the cascade dropdowns inside the mistake modal. */
function initMistakeModal() {
  const subjSel = qs('mistake-subject');
  if (subjSel) subjSel.addEventListener('change', () => {
    populateTopicDropdown('mistake-topic', subjSel.value);
    qs('mistake-subtopic').innerHTML = '<option value="">Select subtopic…</option>';
  });

  const topicSel = qs('mistake-topic');
  if (topicSel) topicSel.addEventListener('change', () => {
    populateSubtopicDropdown('mistake-subtopic', qs('mistake-subject')?.value || '', topicSel.value);
  });
}

function openMistakeModal() {
  populateSubjectDropdown('mistake-subject');
  populateTopicDropdown('mistake-topic', '');
  const modal = qs('mistake-modal');
  if (modal) show(modal);
}

function closeMistakeModal() {
  const modal = qs('mistake-modal');
  if (modal) hide(modal);
  qs('mistake-form')?.reset();
}

function saveMistake(e) {
  e.preventDefault();
  const subjectId  = qs('mistake-subject')?.value;
  const topicId    = qs('mistake-topic')?.value;
  const subtopicId = qs('mistake-subtopic')?.value;
  const type       = qs('mistake-type')?.value || 'conceptual';
  const questionRef= qs('mistake-question')?.value?.trim() || '';
  const notes      = qs('mistake-notes')?.value?.trim() || '';

  if (!subjectId) { showToast('Please select a subject.', 'error'); return; }

  const mistake = {
    id: genId(),
    subjectId,
    topicId:    topicId    || null,
    subtopicId: subtopicId || null,
    mistakeType: type,
    questionRef,
    notes,
    resolved: false,
    resurfaceCount: 0,
    createdAt: new Date().toISOString()
  };

  STATE.mistakes.unshift(mistake);

  // Increment mistake count on subtopic
  if (subtopicId) {
    const sub = STATE.computed.subtopicMap[subtopicId];
    if (sub) sub.mistakeCount = (sub.mistakeCount || 0) + 1;
    persistSubjects();
  }

  persistMistakes();
  closeMistakeModal();
  renderRevisionTab();
  showToast('Mistake logged.', 'info');
}
