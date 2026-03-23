/**
 * adaptive.js — Adaptive recommendations, neglect detection, mismatch flags.
 * Drives the "smart" behavior of the app.
 */

// ─── Next Action Recommendation ───────────────────────────────────────────────

/**
 * Generate a ranked list of "what to study next" recommendations.
 * Combines overdue reviews, high-priority unstarted topics, and weak areas.
 *
 * Returns array of recommendation objects, sorted by urgency.
 */
function getNextActionRecommendations(state) {
  const today = todayISO();
  const recommendations = [];

  // 1. Overdue revisions (highest urgency)
  const revisionQueue = buildRevisionQueue(state.subjects, today);
  const dueNow = getDueToday(revisionQueue, today);
  dueNow.slice(0, 5).forEach(item => {
    recommendations.push({
      type: 'revision',
      urgency: 100 + item.overdueDays, // overdue = urgent
      subjectId: item.subjectId,
      topicId: item.topicId,
      subtopicId: item.subtopicId,
      label: `Revise: ${item.name}`,
      reason: item.overdueDays > 0
        ? `${item.overdueDays} day${item.overdueDays > 1 ? 's' : ''} overdue`
        : 'Due today',
      subjectName: item.subjectName,
      actionType: 'revision'
    });
  });

  // 2. High-priority weak subjects not recently studied
  const weakSubjects = [...state.subjects]
    .filter(s => (s.priorityScore || 0) > 50)
    .sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));

  weakSubjects.slice(0, 3).forEach(subj => {
    const daysSince = subj.lastStudiedDate ? daysBetween(subj.lastStudiedDate, today) : 999;
    if (daysSince >= 2) {
      recommendations.push({
        type: 'study',
        urgency: (subj.priorityScore || 0) + daysSince * 0.5,
        subjectId: subj.id,
        label: `Study: ${subj.shortName || subj.name}`,
        reason: subj.lastStudiedDate
          ? `Last studied ${daysSince} days ago | Priority: ${fmtScore(subj.priorityScore)}`
          : 'Not yet started — high priority',
        subjectName: subj.name,
        actionType: 'new_study'
      });
    }
  });

  // 3. Unresolved mistakes
  const mistakeItems = getMistakeQueue(state.mistakes, state.subjects);
  if (mistakeItems.length > 0) {
    const top = mistakeItems[0];
    recommendations.push({
      type: 'mistake_review',
      urgency: 80,
      subjectId: top.subjectId,
      topicId: top.topicId,
      label: `Error review: ${top.name}`,
      reason: `${top.mistakeCount} unresolved mistake${top.mistakeCount > 1 ? 's' : ''}`,
      subjectName: top.subjectName,
      actionType: 'error_review'
    });
  }

  // 4. Neglected topics
  const neglected = state.computed.neglectedSubtopics.slice(0, 2);
  neglected.forEach(sub => {
    const daysSince = sub.lastStudiedDate ? daysBetween(sub.lastStudiedDate, today) : 999;
    recommendations.push({
      type: 'neglect',
      urgency: 60 + daysSince,
      subjectId: sub.subjectId,
      topicId: sub.topicId,
      subtopicId: sub.id,
      label: `Neglected: ${sub.name}`,
      reason: `Not studied in ${daysSince} days`,
      subjectName: sub.subjectName || '',
      actionType: 'catch_up'
    });
  });

  // Sort by urgency desc
  recommendations.sort((a, b) => b.urgency - a.urgency);
  return recommendations.slice(0, 6); // return top 6
}

// ─── Today's Focus Plan ───────────────────────────────────────────────────────

/**
 * Build a suggested study schedule for today.
 * Respects planned hours, prioritizes weak subjects, interleaves revision.
 */
function buildTodayFocus(state) {
  const today = todayISO();
  const settings = state.settings;
  const plannedHours = plannedHoursForDate(today, settings);
  const totalMinutes = plannedHours * 60;

  const blocks = [];
  let remainingMinutes = totalMinutes;

  // Block 1: Overdue revisions (up to 20% of day)
  const revQueue = getDueToday(buildRevisionQueue(state.subjects, today), today);
  if (revQueue.length > 0) {
    const revMinutes = Math.min(remainingMinutes * 0.20, revQueue.length * 20);
    blocks.push({
      type: 'revision',
      durationMinutes: Math.round(revMinutes),
      items: revQueue.slice(0, Math.ceil(revMinutes / 20)),
      label: `Review ${Math.min(revQueue.length, Math.ceil(revMinutes / 20))} due topics`
    });
    remainingMinutes -= revMinutes;
  }

  // Block 2: Mistake review (up to 15% if mistakes exist)
  const mistakes = getMistakeQueue(state.mistakes, state.subjects);
  if (mistakes.length > 0 && remainingMinutes > 30) {
    const mistakeMinutes = Math.min(remainingMinutes * 0.15, 45);
    blocks.push({
      type: 'error_review',
      durationMinutes: Math.round(mistakeMinutes),
      label: `Error review: ${mistakes[0].name}`
    });
    remainingMinutes -= mistakeMinutes;
  }

  // Block 3: Primary study — weakest subjects first
  const prioritized = [...state.subjects]
    .sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));

  let studyBlockCount = 0;
  prioritized.forEach(subj => {
    if (remainingMinutes < 30 || studyBlockCount >= 3) return;
    // No single subject gets more than 40% of remaining time
    const cap = remainingMinutes * 0.40;
    const weight = getStudyWeightMultiplier(subj.id);
    const allocated = Math.min(Math.round(remainingMinutes / (3 - studyBlockCount) * (weight / 2)), cap);
    if (allocated >= 30) {
      blocks.push({
        type: 'study',
        subjectId: subj.id,
        subjectName: subj.shortName || subj.name,
        durationMinutes: Math.round(allocated),
        label: `Study: ${subj.shortName || subj.name}`
      });
      remainingMinutes -= allocated;
      studyBlockCount++;
    }
  });

  return { plannedHours, blocks, totalMinutes: totalMinutes - remainingMinutes };
}

// ─── Imbalance Detection ──────────────────────────────────────────────────────

/**
 * Detect subjects that have been over-studied relative to their exam weight.
 * Returns array of { subjectId, name, overStudied: true/false, ratio }
 */
function detectStudyImbalance(sessions, subjects) {
  const totalMinutes = sessions.reduce((s, sess) => s + (sess.durationMinutes || 0), 0);
  if (totalMinutes === 0) return [];

  return subjects.map(subj => {
    const subjMinutes = sessions
      .filter(s => s.subjectId === subj.id)
      .reduce((s, sess) => s + (sess.durationMinutes || 0), 0);
    const actualRatio = subjMinutes / totalMinutes;
    const targetRatio = subj.examWeight;
    const ratio = targetRatio > 0 ? actualRatio / targetRatio : 0;

    return {
      subjectId: subj.id,
      name: subj.shortName || subj.name,
      actualPct: roundTo(actualRatio * 100, 1),
      targetPct: roundTo(targetRatio * 100, 1),
      ratio: roundTo(ratio, 2),
      overStudied: ratio > 1.5,
      underStudied: ratio < 0.5 && subj.lastStudiedDate != null
    };
  });
}

// ─── Slow Solver Detection ────────────────────────────────────────────────────

/**
 * FE Civil target: ~2.5 minutes per question (110 questions in ~5 hours)
 * Returns sessions where solving was significantly slow.
 */
const TARGET_SECONDS_PER_Q = 150; // 2.5 minutes

function detectSlowSolving(sessions) {
  return sessions
    .filter(s => s.questionsAttempted > 0 && s.durationMinutes > 0)
    .map(s => {
      const secPerQ = avgTimePerQuestion(s.durationMinutes, s.questionsAttempted);
      return { ...s, secPerQ, isSlowTarget: secPerQ != null && secPerQ > TARGET_SECONDS_PER_Q * 1.5 };
    })
    .filter(s => s.isSlowTarget);
}

// ─── Recovery Check ───────────────────────────────────────────────────────────

/**
 * Check if the user is significantly behind schedule.
 * Returns { isBehind, deficitHours, consecutiveMissedDays, suggestion }
 */
function checkScheduleRecovery(plan, sessions, settings) {
  const today = todayISO();
  const pastDays = plan.filter(d => d.date < today);

  let deficitHours = 0;
  let consecutiveMissed = 0;
  let streakBroken = false;

  const sessionMap = {};
  sessions.forEach(s => {
    sessionMap[s.date] = (sessionMap[s.date] || 0) + (s.durationMinutes || 0) / 60;
  });

  // Iterate most-recent first to find the current trailing streak of missed days
  [...pastDays].reverse().forEach(day => {
    const actual = sessionMap[day.date] || 0;
    const planned = day.plannedHours || 0;
    const dayDeficit = planned - actual;
    deficitHours += Math.max(0, dayDeficit);

    if (!streakBroken) {
      if (dayDeficit > 1) { // missed if >1 hour short
        consecutiveMissed++;
      } else {
        streakBroken = true; // stop counting once we hit a non-missed day
      }
    }
  });

  const isBehind = deficitHours > 6; // >6 hours deficit = behind
  const remainingDays = daysBetween(today, settings.examDate);
  const catchUpPerDay = computeCatchUpPerDay(deficitHours, Math.min(7, remainingDays));

  let suggestion = '';
  if (!isBehind) {
    suggestion = 'You are on track. Keep up the great work!';
  } else if (consecutiveMissed >= 3) {
    suggestion = `You've missed ${consecutiveMissed} consecutive days. Add ${fmtHours(catchUpPerDay)} extra per day for the next 7 days to recover.`;
  } else {
    suggestion = `${fmtHours(deficitHours)} behind schedule. Add ~${fmtHours(catchUpPerDay)} extra per day this week.`;
  }

  return { isBehind, deficitHours: roundTo(deficitHours, 1), consecutiveMissed, suggestion };
}
