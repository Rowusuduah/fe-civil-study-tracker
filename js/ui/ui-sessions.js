/**
 * ui-sessions.js — Session logger: form, star ratings, cascading dropdowns, list.
 */

let _sessionSearchQuery = '';

// ─── Init ─────────────────────────────────────────────────────────────────────
function initSessionForm() {
  populateSubjectDropdown('session-subject');
  initStarRatings();
  setDateToToday('session-date');

  // Cascade: subject → topic
  const subjSel = qs('session-subject');
  if (subjSel) subjSel.addEventListener('change', () => {
    populateTopicDropdown('session-topic', subjSel.value);
    qs('session-subtopic').innerHTML = '<option value="">All subtopics</option>';
    updateSessionTypeVisibility();
  });

  // Cascade: topic → subtopic
  const topicSel = qs('session-topic');
  if (topicSel) topicSel.addEventListener('change', () => {
    const subjId = qs('session-subject').value;
    populateSubtopicDropdown('session-subtopic', subjId, topicSel.value);
  });

  // Auto-calculate duration from start/end times
  const startEl = qs('session-start');
  const endEl   = qs('session-end');
  if (startEl && endEl) {
    const autoCalc = () => {
      const dur = computeSessionDuration(startEl.value, endEl.value);
      if (dur != null) qs('session-duration').value = dur;
    };
    startEl.addEventListener('change', autoCalc);
    endEl.addEventListener('change', autoCalc);

    // "Now" buttons for start/end time
    const setNowTime = (inputId) => {
      const el = qs(inputId);
      if (!el) return;
      const now = new Date();
      el.value = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
      autoCalc();
    };
    qs('btn-now-start')?.addEventListener('click', () => setNowTime('session-start'));
    qs('btn-now-end')?.addEventListener('click', () => setNowTime('session-end'));
  }

  // Session type buttons
  const typeButtons = document.querySelectorAll('.type-btn');
  typeButtons.forEach(btn => btn.addEventListener('click', () => {
    typeButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    qs('session-type').value = btn.dataset.type;
    updateSessionTypeVisibility();
  }));

  // Session form submit
  const form = qs('session-form');
  if (form) form.addEventListener('submit', e => { e.preventDefault(); saveSession(); });

  // Cancel
  const cancelBtn = qs('session-cancel-btn');
  if (cancelBtn) cancelBtn.addEventListener('click', resetSessionForm);

  // Search
  const searchEl = qs('session-search');
  if (searchEl) searchEl.addEventListener('input', () => {
    _sessionSearchQuery = searchEl.value.toLowerCase();
    renderSessionList();
  });
}

function updateSessionTypeVisibility() {
  const type = qs('session-type')?.value || 'practice';
  const qBlock = qs('questions-block');
  const rewatchLabel = qs('rewatch-label');
  if (qBlock)      qBlock.style.display = ['practice', 'mock', 'error_review'].includes(type) ? 'grid' : 'none';
  if (rewatchLabel) rewatchLabel.style.display = type === 'video' ? 'flex' : 'none';
}

// ─── Star Ratings ────────────────────────────────────────────────────────────
function initStarRatings() {
  const fields = [
    { rowId: 'conf-before-stars', hiddenId: 'session-confidence-before' },
    { rowId: 'conf-after-stars',  hiddenId: 'session-confidence-after'  },
    { rowId: 'difficulty-stars',  hiddenId: 'session-difficulty'        },
    { rowId: 'fatigue-stars',     hiddenId: 'session-fatigue'           }
  ];

  fields.forEach(({ rowId, hiddenId }) => {
    const row = qs(rowId);
    const hidden = qs(hiddenId);
    if (!row || !hidden) return;

    row.innerHTML = '';
    row.setAttribute('role', 'radiogroup');
    row.setAttribute('tabindex', '0');
    for (let i = 1; i <= 5; i++) {
      const star = document.createElement('span');
      star.className = 'star' + (i <= parseInt(hidden.value || 3, 10) ? ' filled' : '');
      star.textContent = '★';
      star.setAttribute('role', 'radio');
      star.setAttribute('aria-checked', i <= parseInt(hidden.value || 3, 10) ? 'true' : 'false');
      star.setAttribute('aria-label', `${i} star${i > 1 ? 's' : ''}`);
      star.setAttribute('tabindex', '-1');
      star.dataset.value = i;
      star.addEventListener('click', () => {
        hidden.value = i;
        updateStars(row, i);
        if (hiddenId === 'session-confidence-after') checkMismatchWarning();
      });
      row.appendChild(star);
    }
    // Keyboard navigation: arrow keys to change rating
    row.addEventListener('keydown', e => {
      const cur = parseInt(hidden.value || 3, 10);
      let next = cur;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = Math.min(5, cur + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = Math.max(1, cur - 1);
      else return;
      e.preventDefault();
      hidden.value = next;
      updateStars(row, next);
      if (hiddenId === 'session-confidence-after') checkMismatchWarning();
    });
  });
}

function updateStars(row, value) {
  row.querySelectorAll('.star').forEach((s, idx) => {
    s.classList.toggle('filled', idx < value);
    s.setAttribute('aria-checked', idx < value ? 'true' : 'false');
  });
}

function setStarValue(hiddenId, value) {
  const hidden = qs(hiddenId);
  if (hidden) hidden.value = value;
  const rowMap = {
    'session-confidence-before': 'conf-before-stars',
    'session-confidence-after':  'conf-after-stars',
    'session-difficulty':        'difficulty-stars',
    'session-fatigue':           'fatigue-stars'
  };
  const row = qs(rowMap[hiddenId]);
  if (row) updateStars(row, value);
}

function checkMismatchWarning() {
  const warnEl = qs('mismatch-warning');
  if (!warnEl) return;
  const confAfter = parseInt(qs('session-confidence-after')?.value || 3);
  const attempted = parseInt(qs('session-q-attempted')?.value || 0);
  const correct   = parseInt(qs('session-q-correct')?.value || 0);
  const accuracy  = safeAccuracy(correct, attempted);
  const mismatch  = detectConfidenceMismatch(confAfter, accuracy);
  if (mismatch === 'overconfident') {
    warnEl.textContent = '⚠ Overconfidence detected: high confidence but low accuracy. Consider more practice.';
    warnEl.className = 'alert-inline warning';
    show(warnEl);
  } else if (mismatch === 'underconfident') {
    warnEl.textContent = '✓ You\'re doing better than you think! High accuracy despite low confidence.';
    warnEl.className = 'alert-inline success';
    show(warnEl);
  } else {
    hide(warnEl);
  }
}

// ─── Dropdown Population ─────────────────────────────────────────────────────
function populateSubjectDropdown(selectId) {
  const sel = qs(selectId);
  if (!sel) return;
  sel.innerHTML = '<option value="">Select subject…</option>' +
    STATE.subjects.map(s => `<option value="${escapeHTML(s.id)}">${escapeHTML(s.name)}</option>`).join('');
}

function populateTopicDropdown(selectId, subjectId) {
  const sel = qs(selectId);
  if (!sel) return;
  const subj = STATE.computed.subjectMap[subjectId];
  if (!subj) { sel.innerHTML = '<option value="">All topics</option>'; return; }
  sel.innerHTML = '<option value="">All topics</option>' +
    subj.topics.map(t => `<option value="${escapeHTML(t.id)}">${escapeHTML(t.name)}</option>`).join('');
}

function populateSubtopicDropdown(selectId, subjectId, topicId) {
  const sel = qs(selectId);
  if (!sel) return;
  const subj = STATE.computed.subjectMap[subjectId];
  if (!subj || !topicId) { sel.innerHTML = '<option value="">All subtopics</option>'; return; }
  const topic = subj.topics.find(t => t.id === topicId);
  if (!topic) { sel.innerHTML = '<option value="">All subtopics</option>'; return; }
  sel.innerHTML = '<option value="">All subtopics</option>' +
    topic.subtopics.map(s => `<option value="${escapeHTML(s.id)}">${escapeHTML(s.name)}</option>`).join('');
}

// ─── Save Session ─────────────────────────────────────────────────────────────
function saveSession() {
  const subjectId = qs('session-subject')?.value;
  const date      = qs('session-date')?.value;
  const durVal    = parseInt(qs('session-duration')?.value || 0);

  if (!subjectId) { showToast('Please select a subject.', 'error'); return; }
  if (!date || !isValidISODate(date)) { showToast('Please enter a valid date.', 'error'); return; }
  if (!durVal || durVal < 1) { showToast('Please enter a valid duration (at least 1 minute).', 'error'); return; }

  const attempted = parseInt(qs('session-q-attempted')?.value || 0);
  const correct   = parseInt(qs('session-q-correct')?.value || 0);
  if (correct > attempted) {
    showToast('Correct questions cannot exceed attempted.', 'error');
    return;
  }
  const incorrect = parseInt(qs('session-q-incorrect')?.value || 0);
  const guessed   = parseInt(qs('session-q-guessed')?.value || 0);
  const confBefore= clampRating(qs('session-confidence-before')?.value);
  const confAfter = clampRating(qs('session-confidence-after')?.value);
  const difficulty= clampRating(qs('session-difficulty')?.value);
  const fatigue   = clampRating(qs('session-fatigue')?.value);

  const sessionId = qs('session-id')?.value;
  const isEdit    = !!sessionId;

  const session = {
    id: isEdit ? sessionId : genId(),
    type: qs('session-type')?.value || 'practice',
    date,
    startTime: qs('session-start')?.value || null,
    endTime:   qs('session-end')?.value || null,
    durationMinutes: durVal,
    plannedDurationMinutes: null,
    subjectId,
    topicId:    qs('session-topic')?.value || null,
    subtopicId: qs('session-subtopic')?.value || null,
    resourceId: null,
    notes:      qs('session-notes')?.value?.trim() || '',
    confidenceBefore: confBefore,
    confidenceAfter:  confAfter,
    perceivedDifficulty: difficulty,
    mentalFatigue:    fatigue,
    questionsAttempted: attempted,
    questionsCorrect:   correct,
    questionsIncorrect: incorrect,
    guessedCount:       guessed,
    flaggedForReview:   qs('session-flagged')?.checked || false,
    rewatchNeeded:      qs('session-rewatch')?.checked || false,
    followUpDate:       qs('session-followup')?.value || null,
    resource:           qs('session-resource')?.value?.trim() || '',
    createdAt: isEdit ? undefined : new Date().toISOString()
  };

  let oldSession = null;
  if (isEdit) {
    const idx = STATE.sessions.findIndex(s => s.id === sessionId);
    if (idx >= 0) {
      oldSession = STATE.sessions[idx];
      STATE.sessions[idx] = { ...oldSession, ...session };
    }
  } else {
    STATE.sessions.unshift(session);
  }

  // Update subject progress (subtract old duration if editing)
  updateSubjectFromSession(session, oldSession);

  persistSessions();
  persistSubjects();
  resetSessionForm();
  renderSessionList();
  renderDashboard();
  showToast(isEdit ? 'Session updated.' : 'Session saved!', 'success');
}

function updateSubjectFromSession(session, oldSession) {
  const subj = STATE.computed.subjectMap[session.subjectId];
  if (!subj) return;

  // Subtract old duration if editing, then add new
  const durationDelta = session.durationMinutes - (oldSession ? oldSession.durationMinutes : 0);
  subj.lastStudiedDate = session.date > (subj.lastStudiedDate || '') ? session.date : subj.lastStudiedDate;
  subj.totalTimeMinutes = Math.max(0, (subj.totalTimeMinutes || 0) + durationDelta);

  // Update subtopic if specified
  if (session.subtopicId) {
    const sub = STATE.computed.subtopicMap[session.subtopicId];
    if (sub) {
      sub.lastStudiedDate = session.date > (sub.lastStudiedDate || '') ? session.date : sub.lastStudiedDate;
      sub.totalTimeMinutes = Math.max(0, (sub.totalTimeMinutes || 0) + durationDelta);
      if (sub.coverageStatus === 'not_started') sub.coverageStatus = 'in_progress';

      const accuracy = safeAccuracy(session.questionsCorrect, session.questionsAttempted);
      if (accuracy != null) sub.avgAccuracy = average([sub.avgAccuracy, accuracy].filter(v => v != null));
      sub.avgConfidence = average([sub.avgConfidence, session.confidenceAfter].filter(v => v != null));
      sub.avgDifficulty = average([sub.avgDifficulty, session.perceivedDifficulty].filter(v => v != null));

      // Update review schedule
      const schedUpdate = updateReviewSchedule({
        reviewCount: sub.reviewCount || 0,
        accuracy,
        confidence: session.confidenceAfter,
        difficulty: session.perceivedDifficulty,
        mistakeCount: sub.mistakeCount || 0,
        lastReviewDate: session.date
      });
      sub.reviewCount     = schedUpdate.reviewCount;
      sub.reviewInterval  = schedUpdate.reviewInterval;
      sub.nextReviewDate  = schedUpdate.nextReviewDate;
    }
  }

  recomputeSubjectScores(session.subjectId);
}

// ─── Reset Form ───────────────────────────────────────────────────────────────
function resetSessionForm() {
  qs('session-id').value = '';
  qs('session-form-title').textContent = 'New Session';
  qs('session-form').reset();
  setDateToToday('session-date');

  // Reset type selector
  document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
  const firstType = document.querySelector('.type-btn[data-type="practice"]');
  if (firstType) firstType.classList.add('active');
  if (qs('session-type')) qs('session-type').value = 'practice';

  // Reset stars to 3
  ['session-confidence-before','session-confidence-after','session-difficulty','session-fatigue']
    .forEach(id => setStarValue(id, 3));

  hide(qs('session-cancel-btn'));
  hide(qs('mismatch-warning'));
  updateSessionTypeVisibility();
  populateTopicDropdown('session-topic', '');
  qs('session-subtopic').innerHTML = '<option value="">All subtopics</option>';
}

// ─── Edit / Delete ────────────────────────────────────────────────────────────
function editSession(id) {
  const session = STATE.sessions.find(s => s.id === id);
  if (!session) return;

  qs('session-id').value       = id;
  qs('session-form-title').textContent = 'Edit Session';
  qs('session-date').value     = session.date || '';
  qs('session-start').value    = session.startTime || '';
  qs('session-end').value      = session.endTime || '';
  qs('session-duration').value = session.durationMinutes || '';
  qs('session-notes').value    = session.notes || '';
  qs('session-resource').value = session.resource || '';
  qs('session-followup').value = session.followUpDate || '';
  qs('session-flagged').checked = session.flaggedForReview || false;
  qs('session-rewatch').checked = session.rewatchNeeded || false;
  qs('session-q-attempted').value = session.questionsAttempted || '';
  qs('session-q-correct').value   = session.questionsCorrect || '';
  qs('session-q-incorrect').value = session.questionsIncorrect || '';
  qs('session-q-guessed').value   = session.guessedCount || '';

  // Set type
  if (qs('session-type')) qs('session-type').value = session.type;
  document.querySelectorAll('.type-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.type === session.type);
  });

  // Set dropdowns
  if (qs('session-subject')) qs('session-subject').value = session.subjectId || '';
  populateTopicDropdown('session-topic', session.subjectId || '');
  if (qs('session-topic')) qs('session-topic').value = session.topicId || '';
  populateSubtopicDropdown('session-subtopic', session.subjectId || '', session.topicId || '');
  if (qs('session-subtopic')) qs('session-subtopic').value = session.subtopicId || '';

  // Set stars
  setStarValue('session-confidence-before', session.confidenceBefore || 3);
  setStarValue('session-confidence-after',  session.confidenceAfter  || 3);
  setStarValue('session-difficulty',        session.perceivedDifficulty || 3);
  setStarValue('session-fatigue',           session.mentalFatigue || 3);

  show(qs('session-cancel-btn'));
  updateSessionTypeVisibility();
  switchTab('tab-sessions');
  qs('session-date').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function deleteSession(id) {
  if (!confirm('Delete this session? This cannot be undone.')) return;
  STATE.sessions = STATE.sessions.filter(s => s.id !== id);
  persistSessions();
  renderSessionList();
  renderDashboard();
  showToast('Session deleted.', 'info');
}

// ─── Session List ─────────────────────────────────────────────────────────────
function renderSessionList() {
  const el = qs('sessions-list');
  if (!el) return;

  let sessions = [...STATE.sessions];
  if (_sessionSearchQuery) {
    sessions = sessions.filter(s => {
      const subj = STATE.computed.subjectMap[s.subjectId];
      const text = [s.notes, s.resource, subj?.name, s.type, s.date].join(' ').toLowerCase();
      return text.includes(_sessionSearchQuery);
    });
  }

  if (!sessions.length) {
    el.innerHTML = '<p class="empty-state">No sessions logged yet.</p>';
    return;
  }

  el.innerHTML = sessions.slice(0, 50).map(s => {
    const subj = STATE.computed.subjectMap[s.subjectId];
    const accuracy = safeAccuracy(s.questionsCorrect, s.questionsAttempted);
    const typeColors = { practice:'blue', video:'purple', revision:'green', formula:'teal', mock:'orange', error_review:'red' };
    const typeColor = typeColors[s.type] || 'blue';

    return `<div class="item-row type-${escapeHTML(s.type)}">
      <div class="item-body">
        <div class="item-title">
          <span class="badge badge-${escapeHTML(typeColor)}" style="margin-right:.35rem">${escapeHTML(s.type.replace('_',' '))}</span>
          ${escapeHTML(subj?.shortName || subj?.name || 'Unknown subject')}
        </div>
        <div class="item-meta">
          <span>${escapeHTML(fmtDate(s.date))}</span>
          <span>${escapeHTML(fmtDuration(s.durationMinutes))}</span>
          ${accuracy != null ? `<span>${fmtPct(accuracy)} accuracy</span>` : ''}
          ${s.questionsAttempted ? `<span>${s.questionsAttempted} Qs</span>` : ''}
          ${s.flaggedForReview ? '<span class="text-red">⚑ Flagged</span>' : ''}
          ${s.notes ? `<span title="${escapeHTML(s.notes)}" style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHTML(s.notes)}</span>` : ''}
        </div>
      </div>
      <div class="item-actions">
        <button class="item-btn" data-action="edit-session" data-id="${escapeHTML(s.id)}">Edit</button>
        <button class="item-btn del" data-action="delete-session" data-id="${escapeHTML(s.id)}">Del</button>
      </div>
    </div>`;
  }).join('');

  if (sessions.length > 50) {
    el.insertAdjacentHTML('beforeend', `<p class="empty-state">Showing 50 of ${sessions.length} sessions.</p>`);
  }

  // Event delegation for session list actions (guard against duplicate binding)
  if (!el._delegated) {
    el._delegated = true;
    el.addEventListener('click', e => {
      const target = e.target.closest('[data-action]');
      if (!target) return;
      if (target.dataset.action === 'edit-session') {
        editSession(target.dataset.id);
      } else if (target.dataset.action === 'delete-session') {
        deleteSession(target.dataset.id);
      }
    });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function setDateToToday(inputId) {
  const el = qs(inputId);
  if (el) el.value = todayISO();
}
