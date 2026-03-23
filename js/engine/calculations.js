/**
 * calculations.js — All scoring formulas.
 * Every formula is documented, audited, and centralized here.
 * No UI logic. No side effects. Pure functions.
 *
 * AUDIT NOTES (Calculation Auditor Agent):
 *   - All scores bounded 0–100 via clamp()
 *   - Divide-by-zero protected with null guards
 *   - Date math uses daysBetween() from utils.js (consistent local-time)
 *   - Exam weight array in subjects.js sums to 1.0 (verified)
 *   - Review intervals clamped to minimum 1 day
 */

// ─── Mastery Score (0–100) ───────────────────────────────────────────────────
/**
 * Measures how well a topic is learned.
 *
 * Formula:
 *   mastery = (
 *     accuracy     × 0.35   // most important: did I get answers right?
 *     + conf/5     × 0.25   // how confident do I feel?
 *     + (1-diff/5) × 0.15   // lower difficulty = closer to mastery
 *     + coverage   × 0.15   // how much of the syllabus is covered?
 *     + recency    × 0.10   // recently studied = higher retention
 *   ) × 100
 *
 * All inputs normalized to 0–1 before weighting.
 * Returns null if no data is available yet.
 */
function computeMasteryScore({ accuracy, confidence, difficulty, lastStudiedDate, coverageRatio }) {
  // If zero sessions recorded, return null (not zero — there's a difference)
  if (accuracy == null && confidence == null) return null;

  const acc    = accuracy   != null ? clamp(accuracy, 0, 1)   : 0.5; // assume mid if unknown
  const conf   = confidence != null ? clamp(confidence, 1, 5) : 3;
  const diff   = difficulty != null ? clamp(difficulty, 1, 5) : 3;
  const cov    = coverageRatio != null ? clamp(coverageRatio, 0, 1) : 0;

  // Recency: decay over 30 days. 0 days since study → recency=1. 30+ days → recency=0.
  let recency = 0;
  if (lastStudiedDate) {
    const daysSince = daysBetween(lastStudiedDate, todayISO());
    recency = clamp(1 - daysSince / 30, 0, 1);
  }

  const raw =
    acc              * 0.35 +
    (conf / 5)       * 0.25 +
    (1 - diff / 5)   * 0.15 +
    cov              * 0.15 +
    recency          * 0.10;

  return clamp(roundTo(raw * 100, 1), 0, 100);
}

// ─── Weakness Score (0–100) ──────────────────────────────────────────────────
/**
 * Measures how problematic a topic is — drives priority and review urgency.
 *
 * Formula:
 *   weakness = (
 *     (1 - accuracy)       × 0.30   // low accuracy = high weakness
 *     + (1 - conf/5)       × 0.20   // low confidence = weakness signal
 *     + diff/5             × 0.15   // high difficulty = harder to master
 *     + recencyDecay       × 0.15   // not studied recently = decaying
 *     + mistakeRatio       × 0.10   // repeated mistakes
 *     + baselineWeakness   × 0.10   // prior exam weakness seeded baseline
 *   ) × 100
 */
function computeWeaknessScore({ accuracy, confidence, difficulty, lastStudiedDate, mistakeCount, baselineWeakness }) {
  const acc    = accuracy         != null ? clamp(accuracy, 0, 1)         : 0.5;
  const conf   = confidence       != null ? clamp(confidence, 1, 5)       : 3;
  const diff   = difficulty       != null ? clamp(difficulty, 1, 5)       : 3;
  const bw     = baselineWeakness != null ? clamp(baselineWeakness, 0, 1) : 0.5;

  // Recency decay: 0 days since study → decay=0. 30+ days → decay=1.
  let decay = 0.5; // default: assume moderate decay if never studied
  if (lastStudiedDate) {
    const daysSince = daysBetween(lastStudiedDate, todayISO());
    decay = clamp(daysSince / 30, 0, 1);
  }

  // Mistake ratio: normalized against a "high" threshold of 10 mistakes
  const maxMistakes = 10;
  const mistakeRatio = clamp((mistakeCount || 0) / maxMistakes, 0, 1);

  const raw =
    (1 - acc)        * 0.30 +
    (1 - conf / 5)   * 0.20 +
    (diff / 5)       * 0.15 +
    decay            * 0.15 +
    mistakeRatio     * 0.10 +
    bw               * 0.10;

  return clamp(roundTo(raw * 100, 1), 0, 100);
}

// ─── Priority Score (0–100) ──────────────────────────────────────────────────
/**
 * How urgently this topic should be studied next.
 * Combines weakness, schedule urgency, exam importance, dependency, and neglect.
 *
 * Formula:
 *   priority = (
 *     weaknessScore   × 0.40   // primary driver
 *     + urgency       × 0.25   // how overdue for review?
 *     + examWeight    × 0.15   // how much does it count on the exam?
 *     + foundational  × 0.10   // do other topics depend on this?
 *     + neglect       × 0.10   // not touched in a long time?
 *   )
 */
function computePriorityScore({ weaknessScore, nextReviewDate, examWeight, isFoundational, lastStudiedDate, neglectDays = 14 }) {
  const ws = weaknessScore != null ? clamp(weaknessScore / 100, 0, 1) : 0.5;

  // Urgency: how many days overdue? Cap at 30 days overdue.
  let urgency = 0;
  if (nextReviewDate) {
    const overdue = daysBetween(nextReviewDate, todayISO()); // positive = overdue
    urgency = overdue > 0 ? clamp(overdue / 30, 0, 1) : 0;
  }

  // Exam weight normalized (max exam weight is ~0.09, min ~0.03)
  const examW = clamp(examWeight / 0.09, 0, 1);

  // Foundational bonus (binary)
  const foundBonus = isFoundational ? 1.0 : 0.0;

  // Neglect: days since last study vs neglect threshold
  let neglect = 0;
  if (lastStudiedDate) {
    const daysSince = daysBetween(lastStudiedDate, todayISO());
    neglect = clamp(daysSince / (neglectDays * 2), 0, 1);
  } else {
    neglect = 1.0; // never studied → maximum neglect
  }

  const raw =
    ws         * 0.40 +
    urgency    * 0.25 +
    examW      * 0.15 +
    foundBonus * 0.10 +
    neglect    * 0.10;

  return clamp(roundTo(raw * 100, 1), 0, 100);
}

// ─── Readiness Score (0–100) ─────────────────────────────────────────────────
/**
 * Overall exam readiness — weighted average of subject mastery scores
 * using NCEES exam weight allocations.
 *
 * Formula: Σ(masteryScore[i] × examWeight[i])
 * Exam weights sum to 1.0, so this is a proper weighted average.
 */
function computeReadinessScore(subjects) {
  const items = subjects
    .filter(s => s.masteryScore != null)
    .map(s => ({ value: s.masteryScore, weight: s.examWeight }));

  if (items.length === 0) return null;

  const totalWeight = items.reduce((s, i) => s + i.weight, 0);
  if (totalWeight === 0) return null;

  // Scale to full weight (if some subjects have no mastery yet, readiness is proportionally lower)
  const fullWeight = subjects.reduce((s, sub) => s + sub.examWeight, 0); // should be ~1.0
  const weightedSum = items.reduce((s, i) => s + i.value * i.weight, 0);

  // Readiness is the weighted sum divided by total possible weight
  return clamp(roundTo(weightedSum / fullWeight, 1), 0, 100);
}

// ─── Accuracy ────────────────────────────────────────────────────────────────
/**
 * accuracy = correct / attempted
 * Returns null if attempted = 0 (no divide-by-zero)
 */
function computeAccuracy(correct, attempted) {
  return safeAccuracy(correct, attempted);
}

// ─── Session Duration ─────────────────────────────────────────────────────────
/**
 * Parse start/end time strings "HH:MM" and compute duration in minutes.
 * Returns null if times are invalid or end < start (cross-midnight not supported).
 */
function computeSessionDuration(startTime, endTime) {
  if (!startTime || !endTime) return null;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  if ([sh, sm, eh, em].some(isNaN)) return null;
  const startMin = sh * 60 + sm;
  const endMin   = eh * 60 + em;
  const diff = endMin - startMin;
  return diff > 0 ? diff : null; // disallow negative durations
}

// ─── Planned Hours ────────────────────────────────────────────────────────────
/**
 * Planned study hours for a given date.
 * Normal phase (before intensePhaseDate): weekday or weekend hours
 * Intense phase (intensePhaseDate onward): intenseHours
 */
function plannedHoursForDate(isoDate, settings) {
  const { intensePhaseDate, weekdayHours, weekendHours, intenseHours } = settings;
  if (isoDate >= intensePhaseDate) return intenseHours;
  return isWeekend(isoDate) ? weekendHours : weekdayHours;
}

/**
 * Compute total planned study hours across a date range (inclusive).
 */
function totalPlannedHours(startISO, endISO, settings) {
  const days = dateRange(startISO, endISO);
  return days.reduce((sum, d) => sum + plannedHoursForDate(d, settings), 0);
}

// ─── Catch-up Calculation ─────────────────────────────────────────────────────
/**
 * Compute daily catch-up adjustment.
 * deficit: total missed hours from past days
 * remainingDays: how many days left to spread the catch-up
 * maxExtraPerDay: additional hours allowed per day above normal plan
 *
 * Returns hours to add per day (0 if no deficit).
 */
function computeCatchUpPerDay(deficit, remainingDays, maxExtraPerDay = 4) {
  if (deficit <= 0 || remainingDays <= 0) return 0;
  const raw = deficit / remainingDays;
  return clamp(roundTo(raw, 1), 0, maxExtraPerDay);
}

// ─── Schedule Progress ────────────────────────────────────────────────────────
/**
 * Progress percentage: actual / planned (0–1)
 * Returns null if planned = 0.
 */
function scheduleProgress(actualHours, plannedHours) {
  if (!plannedHours || plannedHours <= 0) return null;
  return clamp(actualHours / plannedHours, 0, 1);
}

// ─── Subject Completion ───────────────────────────────────────────────────────
/**
 * Fraction of subtopics in a subject that are marked complete (0–1).
 */
function subjectCompletionRatio(subject) {
  let total = 0, done = 0;
  subject.topics.forEach(t => {
    t.subtopics.forEach(sub => {
      total++;
      if (sub.coverageStatus === 'complete') done++;
    });
  });
  return total > 0 ? done / total : 0;
}

/**
 * Weighted overall coverage: Σ(completionRatio[i] × examWeight[i])
 */
function overallCoverageScore(subjects) {
  const items = subjects.map(s => ({
    value: subjectCompletionRatio(s) * 100,
    weight: s.examWeight
  }));
  return weightedAverage(items);
}

// ─── Confidence Mismatch Detection ───────────────────────────────────────────
/**
 * Returns 'overconfident' | 'underconfident' | null
 */
function detectConfidenceMismatch(confidenceAfter, accuracy) {
  if (confidenceAfter == null || accuracy == null) return null;
  if (confidenceAfter >= 4 && accuracy < 0.5) return 'overconfident';
  if (confidenceAfter <= 2 && accuracy >= 0.8) return 'underconfident';
  return null;
}

// ─── Average Time per Question ───────────────────────────────────────────────
/**
 * Returns seconds per question, or null if no data.
 */
function avgTimePerQuestion(durationMinutes, questionsAttempted) {
  if (!questionsAttempted || questionsAttempted <= 0) return null;
  if (!durationMinutes || durationMinutes <= 0) return null;
  return roundTo((durationMinutes * 60) / questionsAttempted, 1);
}

// ─── Burnout Detection ────────────────────────────────────────────────────────
/**
 * Detect if user is at risk of burnout based on recent fatigue ratings.
 * Returns true if average fatigue over last N sessions >= threshold.
 */
function detectBurnoutRisk(sessions, lastN = 5, threshold = 4.0) {
  const recent = sessions.slice(-lastN);
  const fatigue = recent.map(s => s.mentalFatigue).filter(f => f != null);
  if (fatigue.length === 0) return false;
  const avg = fatigue.reduce((s, v) => s + v, 0) / fatigue.length;
  return avg >= threshold;
}
