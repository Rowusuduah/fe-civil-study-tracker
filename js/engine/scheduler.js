/**
 * scheduler.js — Study plan generation, phase logic, and catch-up.
 * Generates a day-by-day plan from the configured start date to exam day.
 */

// ─── Plan Generation ──────────────────────────────────────────────────────────

/**
 * Generate a full study plan from startDate to examDate.
 *
 * Plan logic:
 *   - Each day gets a plannedHours budget based on phase + weekday/weekend
 *   - Time allocated to subjects proportional to (priorityScore × examWeight × weightMultiplier)
 *   - No single subject > 40% of a day (except final sprint)
 *   - Revision blocks inserted when items are due within 2 days
 *   - Final N days (finalSprintDays): revision + mock + error review only
 *   - Every ~7 days: insert a full mock exam day
 */
function generateStudyPlan(subjects, settings, existingSessions = []) {
  const startDate = resolveStartDate(settings);
  const examDate = settings.examDate;
  const finalSprintStart = addDays(examDate, -settings.finalSprintDays);
  const intenseStart = settings.intensePhaseDate || startDate; // default: intense from day 1

  const days = dateRange(startDate, examDate);
  const plan = [];

  // Compute subject priorities for allocation
  const subjectAlloc = computeSubjectAllocations(subjects, settings);

  let dayIndex = 0;
  days.forEach(date => {
    dayIndex++;
    const phase = date >= intenseStart ? 'intense' : 'normal';
    const isFinalSprint = date >= finalSprintStart;
    const plannedHours = plannedHoursForDate(date, settings);
    const isMockDay = !isFinalSprint && dayIndex % 7 === 0 && dayIndex > 0 && days.length > 7;

    const studyBlocks = [];

    if (isFinalSprint) {
      // Final sprint: revision + mock + error review only
      studyBlocks.push({ subjectId: null, type: 'revision', durationMinutes: plannedHours * 60 * 0.5, label: 'Spaced Revision' });
      studyBlocks.push({ subjectId: null, type: 'mock', durationMinutes: plannedHours * 60 * 0.3, label: 'Mock Practice' });
      studyBlocks.push({ subjectId: null, type: 'error_review', durationMinutes: plannedHours * 60 * 0.2, label: 'Error Review' });
    } else if (isMockDay) {
      studyBlocks.push({ subjectId: null, type: 'mock', durationMinutes: plannedHours * 60 * 0.6, label: 'Full Mock Exam' });
      studyBlocks.push({ subjectId: null, type: 'error_review', durationMinutes: plannedHours * 60 * 0.4, label: 'Mock Error Review' });
    } else {
      // Normal day: revision block first, then study blocks
      const revMinutes = Math.round(plannedHours * 60 * 0.20);
      studyBlocks.push({ subjectId: null, type: 'revision', durationMinutes: revMinutes, label: 'Daily Revision' });

      let remaining = plannedHours * 60 - revMinutes;
      const maxPerSubject = remaining * 0.40;

      // Rotate subjects by priority, ensuring balance
      const sortedSubj = [...subjectAlloc].sort((a, b) => b.allocWeight - a.allocWeight);
      const topSubjects = sortedSubj.slice(0, 3);

      const totalAllocWeight = topSubjects.reduce((s, a) => s + a.allocWeight, 0);
      topSubjects.forEach((alloc, idx) => {
        const fraction = totalAllocWeight > 0 ? alloc.allocWeight / totalAllocWeight : 1 / topSubjects.length;
        const minutes = Math.min(Math.round(remaining * fraction), maxPerSubject);
        if (minutes >= 20) {
          studyBlocks.push({
            subjectId: alloc.subjectId,
            type: 'study',
            durationMinutes: minutes,
            label: alloc.shortName,
            priority: alloc.priority
          });
        }
      });

      // Formula review slot if time remains
      const usedMinutes = studyBlocks.reduce((s, b) => s + b.durationMinutes, 0);
      const leftover = plannedHours * 60 - usedMinutes;
      if (leftover >= 20) {
        studyBlocks.push({ subjectId: null, type: 'formula_review', durationMinutes: Math.round(leftover), label: 'Formula & Concept Review' });
      }
    }

    plan.push({
      date,
      phase,
      plannedHours,
      actualHours: 0,
      isWeekend: isWeekend(date),
      isFinalSprint,
      isMockDay,
      studyBlocks,
      revisionItems: [],
      completed: false,
      missedFlag: false,
      catchUpFlag: false,
      catchUpHours: 0,
      notes: ''
    });
  });

  return plan;
}

/**
 * Compute allocation weights for each subject.
 * Weight = priorityScore × examWeight × baselineWeightMultiplier
 */
function computeSubjectAllocations(subjects, settings) {
  return subjects.map(subj => {
    const priority = subj.priorityScore ?? computePriorityScore({
      weaknessScore: subj.weaknessScore,
      nextReviewDate: subj.nextReviewDate,
      examWeight: subj.examWeight,
      isFoundational: subj.topics.some(t => t.isFoundational),
      lastStudiedDate: subj.lastStudiedDate,
      neglectDays: settings.neglectDays
    });
    const weightMult = getStudyWeightMultiplier(subj.id);
    const allocWeight = (priority / 100) * subj.examWeight * weightMult;

    return {
      subjectId: subj.id,
      shortName: subj.shortName || subj.name,
      priority,
      examWeight: subj.examWeight,
      allocWeight
    };
  });
}

// ─── Plan Regeneration ────────────────────────────────────────────────────────

/**
 * Regenerate the plan from today forward, preserving past day actuals.
 * Called when performance deviates significantly from plan.
 */
function regeneratePlan(existingPlan, subjects, settings, sessions) {
  const today = todayISO();
  // Clone past days to avoid mutating the original plan
  const sessionMap = {};
  sessions.forEach(s => {
    sessionMap[s.date] = (sessionMap[s.date] || 0) + (s.durationMinutes || 0) / 60;
  });
  const pastDays = existingPlan.filter(d => d.date < today).map(d => {
    const actual = roundTo(sessionMap[d.date] || 0, 2);
    return { ...d, actualHours: actual, missedFlag: actual < d.plannedHours * 0.5 };
  });

  // Generate fresh future plan
  const tempSettings = { ...settings };
  const futurePlan = generateStudyPlan(subjects, tempSettings, sessions);

  // Mark catch-up days if behind
  const { deficitHours } = checkScheduleRecovery(existingPlan, sessions, settings);
  if (deficitHours > 0) {
    const catchUpPerDay = computeCatchUpPerDay(deficitHours, Math.min(7, futurePlan.length));
    futurePlan.slice(0, 7).forEach(day => {
      day.catchUpFlag = catchUpPerDay > 0;
      day.catchUpHours = catchUpPerDay;
      day.plannedHours = Math.min(
        roundTo(day.plannedHours + catchUpPerDay, 1),
        settings.dailyHardCap
      );
    });
  }

  return [...pastDays, ...futurePlan];
}

// ─── Plan Summary ─────────────────────────────────────────────────────────────

/**
 * Compute summary statistics for the current plan.
 */
function getPlanSummary(plan, sessions, settings) {
  const today = todayISO();
  const sessionMap = {};
  sessions.forEach(s => {
    sessionMap[s.date] = (sessionMap[s.date] || 0) + (s.durationMinutes || 0) / 60;
  });

  const totalPlanned = plan.reduce((s, d) => s + d.plannedHours, 0);
  const actualToDate = plan
    .filter(d => d.date <= today)
    .reduce((s, d) => s + (sessionMap[d.date] || 0), 0);
  const plannedToDate = plan
    .filter(d => d.date <= today)
    .reduce((s, d) => s + d.plannedHours, 0);
  const remainingPlanned = plan
    .filter(d => d.date > today)
    .reduce((s, d) => s + d.plannedHours, 0);

  const progressPct = plannedToDate > 0
    ? clamp(roundTo(actualToDate / plannedToDate * 100, 1), 0, 100)
    : 0;

  const phases = {
    normal: plan.filter(d => d.phase === 'normal').length,
    intense: plan.filter(d => d.phase === 'intense').length
  };

  return {
    totalDays: plan.length,
    totalPlannedHours: roundTo(totalPlanned, 1),
    actualHoursToDate: roundTo(actualToDate, 1),
    plannedHoursToDate: roundTo(plannedToDate, 1),
    remainingPlannedHours: roundTo(remainingPlanned, 1),
    progressPct,
    phases,
    missedDays: plan.filter(d => d.date < today && (sessionMap[d.date] || 0) < d.plannedHours * 0.5).length
  };
}

// ─── Weekly Plan ─────────────────────────────────────────────────────────────

/**
 * Get the plan days for a specific week (by any date in that week).
 */
function getWeekPlan(plan, anyDateInWeek) {
  const monday = getMondayOfWeek(anyDateInWeek);
  const sunday = addDays(monday, 6);
  return plan.filter(d => d.date >= monday && d.date <= sunday);
}

// ─── Milestone Detection ──────────────────────────────────────────────────────

/**
 * Generate weekly milestones based on subject coverage targets.
 * Returns array of { weekStart, targets: [{ subjectId, targetCompletionPct }] }
 */
function generateWeeklyMilestones(subjects, settings) {
  const startDate = resolveStartDate(settings);
  const examDate = settings.examDate;
  const totalWeeks = Math.ceil(daysBetween(startDate, examDate) / 7);

  const milestones = [];
  for (let w = 0; w < totalWeeks; w++) {
    const weekStart = addDays(startDate, w * 7);
    const weekNum = w + 1;
    const progress = weekNum / totalWeeks;

    const targets = subjects.map(subj => ({
      subjectId: subj.id,
      subjectName: subj.shortName || subj.name,
      targetCompletionPct: Math.min(100, Math.round(progress * 100))
    }));

    milestones.push({ weekStart, weekNum, targets });
  }

  return milestones;
}
