/**
 * ui-subjects.js — Subject tree with collapsible topics, mastery indicators.
 */

let _subjectFilter = 'all';
let _subjectSearch = '';
let _openSubjects  = new Set();
let _openTopics    = new Set();

function renderSubjectsTab() {
  renderOverallCoverage();
  renderSubjectTree();
}

// ─── Overall Coverage ─────────────────────────────────────────────────────────
function renderOverallCoverage() {
  const pctEl  = qs('overall-coverage-pct');
  const fillEl = qs('overall-progress-fill');
  if (!pctEl || !fillEl) return;

  const score = overallCoverageScore(STATE.subjects);
  const pct   = score != null ? Math.round(score) : 0;
  pctEl.textContent = `${pct}%`;
  fillEl.style.width = `${pct}%`;
  fillEl.className = 'progress-bar ' + (pct >= 75 ? 'green' : pct >= 40 ? '' : 'orange');
}

// ─── Subject Tree ─────────────────────────────────────────────────────────────
function renderSubjectTree() {
  const el = qs('subject-tree');
  if (!el) return;

  let subjects = STATE.subjects;

  // Filter
  if (_subjectFilter === 'not_started') subjects = subjects.filter(s => s.coverageStatus === 'not_started' || s.topics.some(t => t.coverageStatus === 'not_started'));
  if (_subjectFilter === 'in_progress') subjects = subjects.filter(s => s.coverageStatus === 'in_progress' || s.topics.some(t => t.subtopics.some(sub => sub.coverageStatus === 'in_progress')));
  if (_subjectFilter === 'complete')    subjects = subjects.filter(s => s.topics.every(t => t.subtopics.every(sub => sub.coverageStatus === 'complete')));
  if (_subjectFilter === 'weak')        subjects = subjects.filter(s => (s.priorityScore || 0) > 50 || PRIOR_EXAM_BASELINE[s.id]?.tier === 'WEAK');

  // Search
  if (_subjectSearch) {
    subjects = subjects.filter(s =>
      s.name.toLowerCase().includes(_subjectSearch) ||
      s.topics.some(t => t.name.toLowerCase().includes(_subjectSearch) ||
        t.subtopics.some(sub => sub.name.toLowerCase().includes(_subjectSearch)))
    );
  }

  if (!subjects.length) {
    el.innerHTML = '<p class="empty-state">No subjects match the current filter.</p>';
    return;
  }

  el.innerHTML = subjects.map(subj => renderSubjectRow(subj)).join('');

  // Event delegation for subject tree actions (guard against duplicate binding)
  if (!el._delegated) {
    el._delegated = true;
    el.addEventListener('click', e => {
      const target = e.target.closest('[data-action]');
      if (!target) return;
      if (target.dataset.action === 'toggle-subject') {
        toggleSubject(target.dataset.id);
      } else if (target.dataset.action === 'toggle-topic') {
        toggleTopic(target.dataset.id);
      } else if (target.dataset.action === 'cycle-subtopic') {
        cycleSubtopicStatus(target.dataset.id, target.dataset.subjectId);
      }
    });
  }
}

function renderSubjectRow(subj) {
  const isOpen   = _openSubjects.has(subj.id);
  const coverage = subjectCompletionRatio(subj);
  const covPct   = Math.round(coverage * 100);
  const mastery  = subj.masteryScore;
  const baseline = PRIOR_EXAM_BASELINE[subj.id];
  const tierBadge= baseline
    ? `<span class="badge ${baseline.tier === 'WEAK' ? 'badge-red' : baseline.tier === 'MID' ? 'badge-orange' : 'badge-green'}">${baseline.tier}</span>`
    : '';

  return `
    <div class="subject-row" id="subj-row-${escapeHTML(subj.id)}">
      <div class="subject-header" data-action="toggle-subject" data-id="${escapeHTML(subj.id)}">
        <span class="subject-toggle ${isOpen ? 'open' : ''}">▶</span>
        <span class="subject-icon">${escapeHTML(subj.icon || '◈')}</span>
        <div style="flex:1;min-width:0">
          <div class="subject-name">${escapeHTML(subj.name)}</div>
          <div style="display:flex;align-items:center;gap:.5rem;margin-top:.25rem">
            <div class="progress-wrap" style="flex:1;max-width:200px">
              <div class="progress-bar ${covPct >= 75 ? 'green' : covPct >= 40 ? '' : 'orange'}" style="width:${covPct}%"></div>
            </div>
            <span class="text-xs text-muted">${covPct}% covered</span>
          </div>
        </div>
        <div class="subject-meta">
          ${tierBadge}
          ${mastery != null ? `<span class="badge ${mastery >= 75 ? 'badge-green' : mastery >= 50 ? 'badge-yellow' : 'badge-orange'}">Mastery ${Math.round(mastery)}%</span>` : ''}
          <span class="text-xs text-muted">${Math.round(subj.examWeight * 100)}% of exam</span>
          ${subj.lastStudiedDate ? `<span class="text-xs text-muted">Last: ${escapeHTML(fmtDateShort(subj.lastStudiedDate))}</span>` : ''}
        </div>
      </div>
      ${isOpen ? renderTopicList(subj) : ''}
    </div>`;
}

function renderTopicList(subj) {
  return `<div class="topic-list">${subj.topics.map(topic => renderTopicRow(subj, topic)).join('')}</div>`;
}

function renderTopicRow(subj, topic) {
  const topicKey = `${subj.id}::${topic.id}`;
  const isOpen   = _openTopics.has(topicKey);
  const coverage = topic.subtopics.filter(s => s.coverageStatus === 'complete').length;
  const total    = topic.subtopics.length;

  return `
    <div>
      <div class="topic-row" data-action="toggle-topic" data-id="${escapeHTML(topicKey)}">
        <div style="display:flex;align-items:center;gap:.5rem">
          <span style="color:var(--muted);font-size:.7rem">${isOpen ? '▼' : '▶'}</span>
          <span>${escapeHTML(topic.name)}</span>
          ${topic.isFoundational ? '<span class="badge badge-purple" style="font-size:.6rem">foundational</span>' : ''}
        </div>
        <span class="text-xs text-muted">${coverage}/${total} done</span>
      </div>
      ${isOpen ? renderSubtopicList(subj, topic) : ''}
    </div>`;
}

function renderSubtopicList(subj, topic) {
  return `<div class="subtopic-list">${topic.subtopics.map(sub => {
    const statusClass = sub.coverageStatus || 'not_started';
    const mastery = sub.masteryScore;
    const accuracy = sub.avgAccuracy;

    return `<div class="subtopic-row" data-action="cycle-subtopic" data-id="${escapeHTML(sub.id)}" data-subject-id="${escapeHTML(subj.id)}">
      <span class="status-dot ${statusClass}"></span>
      <span style="flex:1">${escapeHTML(sub.name)}</span>
      ${mastery != null ? `<span class="text-xs ${mastery >= 75 ? 'text-green' : mastery >= 50 ? 'text-yellow' : 'text-orange'}">${Math.round(mastery)}%</span>` : ''}
      ${accuracy != null ? `<span class="text-xs text-muted">${fmtPct(accuracy)}</span>` : ''}
      ${sub.nextReviewDate ? `<span class="text-xs text-muted" title="Next review">${escapeHTML(relativeDate(sub.nextReviewDate))}</span>` : ''}
    </div>`;
  }).join('')}</div>`;
}

// ─── Toggle Helpers ───────────────────────────────────────────────────────────
function toggleSubject(id) {
  if (_openSubjects.has(id)) _openSubjects.delete(id);
  else _openSubjects.add(id);
  renderSubjectTree();
}

function toggleTopic(key) {
  if (_openTopics.has(key)) _openTopics.delete(key);
  else _openTopics.add(key);
  renderSubjectTree();
}

// ─── Cycle Subtopic Status ────────────────────────────────────────────────────
function cycleSubtopicStatus(subtopicId, subjectId) {
  const sub = STATE.computed.subtopicMap[subtopicId];
  if (!sub) return;
  const cycle = ['not_started', 'in_progress', 'complete'];
  const idx   = cycle.indexOf(sub.coverageStatus);
  sub.coverageStatus = cycle[(idx + 1) % cycle.length];

  if (sub.coverageStatus === 'complete' && !sub.lastStudiedDate) {
    sub.lastStudiedDate = todayISO();
  }
  if (sub.coverageStatus === 'complete' && !sub.nextReviewDate) {
    const sched = initializeReviewSchedule(sub.avgAccuracy, sub.avgConfidence, sub.avgDifficulty);
    sub.nextReviewDate  = sched.nextReviewDate;
    sub.reviewInterval  = sched.reviewInterval;
    sub.reviewCount     = sched.reviewCount;
  }

  persistSubjects();
  renderSubjectTree();
  renderOverallCoverage();
}

// ─── Filter/Search Init ───────────────────────────────────────────────────────
function initSubjectsFilters() {
  const filterSel = qs('subjects-filter');
  const searchEl  = qs('subjects-search');

  if (filterSel) filterSel.addEventListener('change', () => {
    _subjectFilter = filterSel.value;
    renderSubjectTree();
  });
  if (searchEl) searchEl.addEventListener('input', () => {
    _subjectSearch = searchEl.value.toLowerCase();
    renderSubjectTree();
  });
}
