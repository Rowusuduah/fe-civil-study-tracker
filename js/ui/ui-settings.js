/**
 * ui-settings.js — Settings tab: exam config, hours, revision intervals, backup/restore.
 */

function renderSettingsTab() {
  const s = STATE.settings;
  if (qs('set-start-date'))    qs('set-start-date').value   = s.studyStartDate || '';
  if (qs('set-exam-date'))     qs('set-exam-date').value    = s.examDate || DEFAULT_SETTINGS.examDate;
  if (qs('set-intense-date'))  qs('set-intense-date').value = s.intensePhaseDate || '';
  if (qs('set-name'))          qs('set-name').value          = s.userProfile?.name || '';
  if (qs('set-weekday-hours')) qs('set-weekday-hours').value = s.weekdayHours ?? DEFAULT_SETTINGS.weekdayHours;
  if (qs('set-weekend-hours')) qs('set-weekend-hours').value = s.weekendHours ?? DEFAULT_SETTINGS.weekendHours;
  if (qs('set-intense-hours')) qs('set-intense-hours').value = s.intenseHours ?? DEFAULT_SETTINGS.intenseHours;
  if (qs('set-daily-cap'))     qs('set-daily-cap').value     = s.dailyHardCap ?? DEFAULT_SETTINGS.dailyHardCap;
  if (qs('set-intervals'))     qs('set-intervals').value     = (s.revisionIntervals || DEFAULT_SETTINGS.revisionIntervals).join(',');
  if (qs('set-neglect-days'))  qs('set-neglect-days').value  = s.neglectDays ?? DEFAULT_SETTINGS.neglectDays;
  if (qs('set-final-sprint'))  qs('set-final-sprint').value  = s.finalSprintDays ?? DEFAULT_SETTINGS.finalSprintDays;

  // Theme buttons
  const isDark = STATE.theme === 'dark' || !document.body.classList.contains('light');
  qs('set-theme-dark')?.classList.toggle('active', isDark);
  qs('set-theme-light')?.classList.toggle('active', !isDark);
}

function initSettingsForm() {
  // Save settings
  qs('btn-save-settings')?.addEventListener('click', saveSettings_);

  // Theme buttons
  qs('set-theme-dark')?.addEventListener('click', () => applyTheme('dark'));
  qs('set-theme-light')?.addEventListener('click', () => applyTheme('light'));

  // Backup
  qs('btn-export-backup')?.addEventListener('click', () => {
    exportBackup();
    setBackupStatus('Backup exported successfully.', 'success');
  });

  qs('btn-export-csv')?.addEventListener('click', () => {
    exportSessionsCSV();
    setBackupStatus('Sessions CSV exported.', 'success');
  });

  const importInput = qs('import-backup-file');
  if (importInput) {
    importInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      if (!confirm('This will overwrite all current data. Are you sure?')) {
        e.target.value = '';
        return;
      }
      importBackupFromFile(file, result => {
        if (result.ok) {
          setBackupStatus(result.message, 'success');
          initState();
          renderCurrentTab();
          showToast('Data restored from backup.', 'success');
        } else {
          setBackupStatus(result.message, 'error');
          showToast(result.message, 'error');
        }
        e.target.value = '';
      });
    });
  }

  // Drive
  qs('btn-save-drive')?.addEventListener('click', () => saveToDrive());
  qs('btn-load-drive')?.addEventListener('click', () => loadFromDrive());

  // Danger zone
  qs('btn-reset-data')?.addEventListener('click', () => {
    if (!confirm('Reset ALL study data? Your settings and theme will be kept, but all sessions, plan, subjects, and resources will be deleted.\n\nExport a backup first if needed.')) return;
    resetAllData();
    initState();
    renderCurrentTab();
    showToast('All data reset.', 'info');
  });

  qs('btn-factory-reset')?.addEventListener('click', () => {
    if (!confirm('Factory reset? This deletes EVERYTHING including settings and theme.\n\nThis cannot be undone.')) return;
    factoryReset();
    location.reload();
  });
}

function saveSettings_() {
  const startDate  = qs('set-start-date')?.value;
  const examDate   = qs('set-exam-date')?.value;
  const intenseDate= qs('set-intense-date')?.value;
  const name       = qs('set-name')?.value?.trim() || '';
  const weekdayH   = parseInt(qs('set-weekday-hours')?.value || DEFAULT_SETTINGS.weekdayHours, 10);
  const weekendH   = parseInt(qs('set-weekend-hours')?.value || DEFAULT_SETTINGS.weekendHours, 10);
  const intenseH   = parseInt(qs('set-intense-hours')?.value || DEFAULT_SETTINGS.intenseHours, 10);
  const dailyCap   = parseInt(qs('set-daily-cap')?.value || DEFAULT_SETTINGS.dailyHardCap, 10);
  const neglect    = parseInt(qs('set-neglect-days')?.value || DEFAULT_SETTINGS.neglectDays, 10);
  const sprint     = parseInt(qs('set-final-sprint')?.value || DEFAULT_SETTINGS.finalSprintDays, 10);
  const intervalsRaw = qs('set-intervals')?.value || '1,3,7,14,30';

  // Validate
  if (!examDate || !isValidISODate(examDate)) { showToast('Please enter a valid exam date.', 'error'); return; }
  if (examDate < todayISO()) { showToast('Exam date cannot be in the past.', 'error'); return; }
  if (examDate > '2030-12-31') { showToast('Exam date must be before 2031.', 'error'); return; }
  if (startDate && !isValidISODate(startDate)) { showToast('Please enter a valid study start date.', 'error'); return; }
  if (startDate && startDate < todayISO()) { showToast('Study start date cannot be in the past.', 'error'); return; }
  if (startDate && examDate && startDate >= examDate) { showToast('Study start date must be before the exam date.', 'error'); return; }
  if (startDate && intenseDate && startDate > intenseDate) { showToast('Study start date must be on or before the intense phase start.', 'error'); return; }
  if (intenseDate && intenseDate >= examDate) { showToast('Intense phase must start before the exam date.', 'error'); return; }
  if (weekdayH < 1 || weekdayH > 20) { showToast('Weekday hours must be 1–20.', 'error'); return; }
  if (weekendH < 1 || weekendH > 24) { showToast('Weekend hours must be 1–24.', 'error'); return; }

  // Parse intervals
  const intervals = intervalsRaw.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n >= 1);
  if (intervals.length === 0) { showToast('Please enter at least one valid revision interval.', 'error'); return; }

  STATE.settings = {
    ...STATE.settings,
    studyStartDate: startDate || null,
    examDate,
    intensePhaseDate: intenseDate || null,
    weekdayHours: weekdayH,
    weekendHours: weekendH,
    intenseHours: intenseH,
    dailyHardCap: dailyCap,
    revisionIntervals: intervals,
    neglectDays: neglect,
    finalSprintDays: sprint,
    userProfile: { ...STATE.settings.userProfile, name }
  };

  persistSettings();
  showToast('Settings saved!', 'success');
}


function setBackupStatus(msg, type) {
  const el = qs('backup-status');
  if (!el) return;
  el.textContent = msg;
  el.style.color = type === 'success' ? 'var(--green)' : type === 'error' ? 'var(--red)' : 'var(--muted)';
}
