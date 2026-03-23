/**
 * ui-resources.js — Resource tracker: videos, books, problem sets, notes.
 */

let _resourceTypeFilter = 'all';
let _resourceSubjectFilter = 'all';
let _resourceSearch = '';

function renderResourcesTab() {
  renderResourceList();
}

function initResourceForm() {
  populateSubjectDropdown('res-subject');
  const subjSel = qs('res-subject');
  if (subjSel) subjSel.addEventListener('change', () => populateTopicDropdown('res-topic', subjSel.value));

  const typeEl = qs('resource-type');
  if (typeEl) typeEl.addEventListener('change', updateResourceFormVisibility);

  const form = qs('resource-form');
  if (form) form.addEventListener('submit', e => { e.preventDefault(); saveResource(); });

  const cancelBtn = qs('resource-cancel-btn');
  if (cancelBtn) cancelBtn.addEventListener('click', resetResourceForm);

  // Populate subject filter
  const subjectFilter = qs('resource-subject-filter');
  if (subjectFilter) {
    subjectFilter.innerHTML = '<option value="all">All Subjects</option>' +
      STATE.subjects.map(s => `<option value="${escapeHTML(s.id)}">${escapeHTML(s.shortName || s.name)}</option>`).join('');
  }

  qs('resource-type-filter')?.addEventListener('change', e => { _resourceTypeFilter = e.target.value; renderResourceList(); });
  qs('resource-subject-filter')?.addEventListener('change', e => { _resourceSubjectFilter = e.target.value; renderResourceList(); });
  qs('resource-search')?.addEventListener('input', e => { _resourceSearch = e.target.value.toLowerCase(); renderResourceList(); });
}

function updateResourceFormVisibility() {
  const type = qs('resource-type')?.value;
  const durGroup = qs('res-duration-group');
  if (durGroup) durGroup.style.display = type === 'video' ? 'flex' : 'none';
}

function saveResource() {
  const title = qs('resource-title')?.value?.trim();
  if (!title) { showToast('Please enter a title.', 'error'); return; }

  const id = qs('resource-id')?.value;
  const isEdit = !!id;

  const resource = {
    id: isEdit ? id : genId(),
    type: qs('resource-type')?.value || 'video',
    title,
    source:        qs('resource-source')?.value?.trim() || '',
    subjectId:     qs('res-subject')?.value || null,
    topicId:       qs('res-topic')?.value || null,
    duration:      parseInt(qs('resource-duration')?.value || 0),
    watchedPercent:parseInt(qs('resource-progress')?.value || 0),
    completed:     parseInt(qs('resource-progress')?.value || 0) >= 100,
    rewatchNeeded: qs('resource-rewatch')?.checked || false,
    chapter:       qs('resource-chapter')?.value?.trim() || '',
    notes:         qs('resource-notes')?.value?.trim() || '',
    createdAt: isEdit ? undefined : new Date().toISOString()
  };

  if (isEdit) {
    const idx = STATE.resources.findIndex(r => r.id === id);
    if (idx >= 0) STATE.resources[idx] = { ...STATE.resources[idx], ...resource };
  } else {
    STATE.resources.unshift(resource);
  }

  persistResources();
  resetResourceForm();
  renderResourceList();
  showToast(isEdit ? 'Resource updated.' : 'Resource added!', 'success');
}

function resetResourceForm() {
  qs('resource-id').value = '';
  qs('resource-form-title').textContent = 'Add Resource';
  qs('resource-form')?.reset();
  hide(qs('resource-cancel-btn'));
  updateResourceFormVisibility();
}

function editResource(id) {
  const r = STATE.resources.find(x => x.id === id);
  if (!r) return;
  qs('resource-id').value = r.id;
  qs('resource-form-title').textContent = 'Edit Resource';
  if (qs('resource-type'))    qs('resource-type').value    = r.type || 'video';
  if (qs('resource-title'))   qs('resource-title').value   = r.title || '';
  if (qs('resource-source'))  qs('resource-source').value  = r.source || '';
  if (qs('res-subject'))      qs('res-subject').value       = r.subjectId || '';
  populateTopicDropdown('res-topic', r.subjectId || '');
  if (qs('res-topic'))        qs('res-topic').value         = r.topicId || '';
  if (qs('resource-duration')) qs('resource-duration').value= r.duration || '';
  if (qs('resource-progress')) qs('resource-progress').value= r.watchedPercent || 0;
  if (qs('resource-chapter'))  qs('resource-chapter').value = r.chapter || '';
  if (qs('resource-notes'))    qs('resource-notes').value   = r.notes || '';
  if (qs('resource-rewatch'))  qs('resource-rewatch').checked = r.rewatchNeeded || false;
  show(qs('resource-cancel-btn'));
  updateResourceFormVisibility();
}

function deleteResource(id) {
  if (!confirm('Delete this resource?')) return;
  STATE.resources = STATE.resources.filter(r => r.id !== id);
  persistResources();
  renderResourceList();
  showToast('Resource deleted.', 'info');
}

function renderResourceList() {
  const el = qs('resource-list');
  if (!el) return;

  let resources = [...STATE.resources];

  if (_resourceTypeFilter !== 'all')    resources = resources.filter(r => r.type === _resourceTypeFilter);
  if (_resourceSubjectFilter !== 'all') resources = resources.filter(r => r.subjectId === _resourceSubjectFilter);
  if (_resourceSearch) resources = resources.filter(r =>
    [r.title, r.source, r.chapter, r.notes].join(' ').toLowerCase().includes(_resourceSearch)
  );

  if (!resources.length) {
    el.innerHTML = '<p class="empty-state">No resources match the current filters.</p>';
    return;
  }

  const typeIcons = { video:'🎬', book:'📖', problem_set:'📝', formula_sheet:'📐', notes:'📄' };
  const typeColors = { video:'purple', book:'blue', problem_set:'orange', formula_sheet:'teal', notes:'green' };

  el.innerHTML = resources.map(r => {
    const subj = STATE.computed.subjectMap[r.subjectId];
    const icon  = typeIcons[r.type] || '📄';
    const color = typeColors[r.type] || 'muted';
    const prog  = r.watchedPercent || 0;

    return `<div class="item-row">
      <div class="item-body">
        <div class="item-title">
          <span>${icon}</span>
          <span class="badge badge-${escapeHTML(color)}" style="margin-right:.35rem">${escapeHTML(r.type.replace('_',' '))}</span>
          ${escapeHTML(r.title)}
          ${r.rewatchNeeded ? ' <span class="badge badge-orange">Rewatch</span>' : ''}
          ${r.completed ? ' <span class="badge badge-green">Done</span>' : ''}
        </div>
        <div class="item-meta">
          ${r.source ? `<span>${escapeHTML(r.source)}</span>` : ''}
          ${subj ? `<span>${escapeHTML(subj.shortName || subj.name)}</span>` : ''}
          ${r.duration ? `<span>${escapeHTML(fmtDuration(r.duration))}</span>` : ''}
          ${r.chapter ? `<span>${escapeHTML(r.chapter)}</span>` : ''}
        </div>
        ${r.type === 'video' || r.type === 'book' ? `
          <div class="progress-wrap" style="margin-top:.4rem">
            <div class="progress-bar ${prog >= 100 ? 'green' : ''}" style="width:${prog}%"></div>
          </div>
          <div class="text-xs text-muted" style="margin-top:.1rem">${prog}% complete</div>` : ''}
      </div>
      <div class="item-actions">
        <button class="item-btn" onclick="editResource('${escapeHTML(r.id)}')">Edit</button>
        <button class="item-btn del" onclick="deleteResource('${escapeHTML(r.id)}')">Del</button>
      </div>
    </div>`;
  }).join('');
}
