/**
 * spacedRepetition.js — Spaced repetition and review scheduling.
 * Implements forgetting curve logic with adaptive interval modification.
 */

/** Base review intervals in days (index = review count) */
const BASE_INTERVALS = [1, 3, 7, 14, 30];
const MAX_INTERVAL = 30; // days — cap interval at 30 days

// ─── Interval Calculation ─────────────────────────────────────────────────────

/**
 * Compute next review interval in days.
 *
 * Base interval = BASE_INTERVALS[reviewCount] (or MAX_INTERVAL if beyond array)
 * Modifiers shorten the interval for weak topics:
 *   - accuracy < 0.5   → ×0.5  (needs frequent review)
 *   - confidence <= 2  → ×0.7  (low confidence = review sooner)
 *   - difficulty >= 4  → ×0.6  (hard topic = shorter gap)
 *   - mistakeCount > 2 → ×0.8  (repeated mistakes = review sooner)
 *
 * Minimum interval: 1 day (never same day review)
 */
function computeNextInterval({ reviewCount, accuracy, confidence, difficulty, mistakeCount }) {
  const baseIdx = Math.min(reviewCount, BASE_INTERVALS.length - 1);
  let interval = BASE_INTERVALS[baseIdx];

  let modifier = 1.0;
  if (accuracy  != null && accuracy < 0.5)   modifier *= 0.5;
  if (confidence != null && confidence <= 2)  modifier *= 0.7;
  if (difficulty  != null && difficulty >= 4) modifier *= 0.6;
  if ((mistakeCount || 0) > 2)                modifier *= 0.8;

  const adjusted = interval * modifier;
  return Math.max(1, Math.ceil(adjusted)); // minimum 1 day
}

/**
 * Compute next review date string (YYYY-MM-DD) given last review date.
 */
function computeNextReviewDate(lastReviewDate, interval) {
  const base = lastReviewDate || todayISO();
  return addDays(base, interval);
}

/**
 * Full review update after a session.
 * If accuracy < 0.4 (failure): reset reviewCount to 0 (relearn from scratch)
 * Otherwise: increment reviewCount, compute next interval and date.
 *
 * Returns updated { reviewCount, reviewInterval, nextReviewDate }
 */
function updateReviewSchedule({ reviewCount, accuracy, confidence, difficulty, mistakeCount, lastReviewDate }) {
  const isFailure = accuracy != null && accuracy < 0.4;

  const newReviewCount = isFailure ? 0 : (reviewCount || 0) + 1;
  const newInterval = computeNextInterval({
    reviewCount: newReviewCount,
    accuracy,
    confidence,
    difficulty,
    mistakeCount
  });
  const newNextReviewDate = computeNextReviewDate(lastReviewDate || todayISO(), newInterval);

  return {
    reviewCount: newReviewCount,
    reviewInterval: newInterval,
    nextReviewDate: newNextReviewDate,
    wasReset: isFailure
  };
}

// ─── Review Queue Management ─────────────────────────────────────────────────

/**
 * Build the full revision queue from all subtopics.
 * Returns sorted array: overdue first, then due today, then upcoming.
 *
 * Each item: { subtopicId, subjectId, topicId, name, nextReviewDate,
 *              intervalDays, reviewCount, lastPerformance, urgent, overdueDays }
 */
function buildRevisionQueue(subjects, today = todayISO()) {
  const queue = [];

  subjects.forEach(subject => {
    subject.topics.forEach(topic => {
      topic.subtopics.forEach(sub => {
        if (!sub.nextReviewDate) return; // never studied — not in queue yet
        if (sub.coverageStatus === 'not_started') return;

        const overdueDays = daysBetween(sub.nextReviewDate, today);
        if (overdueDays >= -7) { // include items due within 7 days
          queue.push({
            subtopicId:    sub.id,
            subjectId:     subject.id,
            subjectName:   subject.name,
            topicId:       topic.id,
            topicName:     topic.name,
            name:          sub.name,
            nextReviewDate: sub.nextReviewDate,
            intervalDays:  sub.reviewInterval,
            reviewCount:   sub.reviewCount,
            lastPerformance: sub.avgAccuracy,
            urgent:        overdueDays >= 3,
            overdueDays
          });
        }
      });
    });
  });

  // Sort: most overdue first, then by review priority, then by ID for determinism
  queue.sort((a, b) => {
    if (a.overdueDays !== b.overdueDays) return b.overdueDays - a.overdueDays;
    const perfDiff = (a.lastPerformance || 0.5) - (b.lastPerformance || 0.5);
    if (perfDiff !== 0) return perfDiff; // weaker first
    return (a.subtopicId || '').localeCompare(b.subtopicId || ''); // stable tie-break
  });

  return queue;
}

/**
 * Get only items due today or overdue.
 */
function getDueToday(revisionQueue, today = todayISO()) {
  return revisionQueue.filter(item => item.nextReviewDate <= today);
}

/**
 * Get upcoming items (due in next N days).
 */
function getUpcoming(revisionQueue, days = 7, today = todayISO()) {
  const cutoff = addDays(today, days);
  return revisionQueue.filter(item => item.nextReviewDate > today && item.nextReviewDate <= cutoff);
}

// ─── Mistake Resurfacing ──────────────────────────────────────────────────────

/**
 * Get subtopics that have unresolved mistakes, sorted by mistake frequency.
 */
function getMistakeQueue(mistakes, subjects) {
  const subtopicMistakeCounts = {};
  mistakes
    .filter(m => !m.resolved)
    .forEach(m => {
      const key = m.subtopicId || m.topicId;
      subtopicMistakeCounts[key] = (subtopicMistakeCounts[key] || 0) + 1;
    });

  const result = [];
  Object.entries(subtopicMistakeCounts).forEach(([id, count]) => {
    // Find the subtopic in the subject tree
    for (const subj of subjects) {
      for (const topic of subj.topics) {
        const sub = topic.subtopics.find(s => s.id === id);
        if (sub) {
          result.push({
            subtopicId: sub.id,
            subjectId: subj.id,
            topicId: topic.id,
            name: sub.name,
            subjectName: subj.name,
            mistakeCount: count,
            lastStudiedDate: sub.lastStudiedDate
          });
          break;
        }
      }
    }
  });

  return result.sort((a, b) => b.mistakeCount - a.mistakeCount);
}

/**
 * Topics I keep missing: subtopics with 2+ unresolved mistakes
 */
function getKeepMissingList(mistakes, subjects) {
  return getMistakeQueue(mistakes, subjects).filter(item => item.mistakeCount >= 2);
}

// ─── Schedule a New Topic for Review ─────────────────────────────────────────

/**
 * When a subtopic is studied for the first time, initialize its review schedule.
 * Returns { nextReviewDate, reviewInterval, reviewCount }
 */
function initializeReviewSchedule(accuracy, confidence, difficulty) {
  const interval = computeNextInterval({
    reviewCount: 0,
    accuracy,
    confidence,
    difficulty,
    mistakeCount: 0
  });
  return {
    reviewCount: 0,
    reviewInterval: interval,
    nextReviewDate: addDays(todayISO(), interval)
  };
}
