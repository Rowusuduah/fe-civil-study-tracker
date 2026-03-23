/**
 * Prior FE Civil Exam Score Baseline
 * Used to seed weakness scores and initial priority rankings.
 * Score scale: NCEES diagnostic scoring (higher = better relative performance)
 *
 * Interpretation tiers:
 *   STRONG  >= 9.0
 *   MID     7.0 – 8.9
 *   WEAK    < 7.0  ← Requires aggressive targeting
 */

const PRIOR_EXAM_BASELINE = {
  mathematics:    { score: 5.1,  tier: 'WEAK',   priority: 1, studyWeightMultiplier: 2.0 },
  economics:      { score: 5.8,  tier: 'WEAK',   priority: 2, studyWeightMultiplier: 1.9 },
  surveying:      { score: 5.9,  tier: 'WEAK',   priority: 3, studyWeightMultiplier: 1.8 },
  statics:        { score: 6.5,  tier: 'WEAK',   priority: 4, studyWeightMultiplier: 1.7 },
  structural:     { score: 6.7,  tier: 'WEAK',   priority: 5, studyWeightMultiplier: 1.7 },
  dynamics:       { score: 6.8,  tier: 'WEAK',   priority: 6, studyWeightMultiplier: 1.6 },
  geotechnical:   { score: 6.6,  tier: 'WEAK',   priority: 7, studyWeightMultiplier: 1.6 },
  water:          { score: 7.6,  tier: 'MID',    priority: 8, studyWeightMultiplier: 1.3 },
  fluid:          { score: 8.0,  tier: 'MID',    priority: 9, studyWeightMultiplier: 1.2 },
  construction:   { score: 8.0,  tier: 'MID',    priority: 10, studyWeightMultiplier: 1.2 },
  mechanics:      { score: 8.4,  tier: 'MID',    priority: 11, studyWeightMultiplier: 1.1 },
  transportation: { score: 9.5,  tier: 'STRONG', priority: 12, studyWeightMultiplier: 0.8 },
  materials:      { score: 10.1, tier: 'STRONG', priority: 13, studyWeightMultiplier: 0.7 },
  ethics:         { score: 15.0, tier: 'STRONG', priority: 14, studyWeightMultiplier: 0.5 }
};

/**
 * Max possible score (used for normalization to 0-1)
 * Ethics outlier at 15.0; we cap normalization at 15.0
 */
const BASELINE_MAX_SCORE = 15.0;
const BASELINE_MIN_SCORE = 5.0; // approximate floor seen in data

/**
 * Convert a raw score to a baseline weakness value (0–1)
 * Higher weakness = lower raw score
 */
function scoreToWeakness(score) {
  const clampedScore = Math.max(BASELINE_MIN_SCORE, Math.min(BASELINE_MAX_SCORE, score));
  return 1 - (clampedScore - BASELINE_MIN_SCORE) / (BASELINE_MAX_SCORE - BASELINE_MIN_SCORE);
}

/**
 * Get baseline weakness for a subject ID (0–1)
 */
function getBaselineWeakness(subjectId) {
  const b = PRIOR_EXAM_BASELINE[subjectId];
  if (!b) return 0.5; // default mid weakness if unknown
  return scoreToWeakness(b.score);
}

/**
 * Get ordered list of subjects by priority (weakest first)
 */
function getSubjectsByPriority() {
  return Object.entries(PRIOR_EXAM_BASELINE)
    .sort((a, b) => a[1].priority - b[1].priority)
    .map(([id, data]) => ({ id, ...data }));
}

/**
 * Get study weight for a subject relative to others
 * Used in plan generation to allocate more time to weak subjects
 */
function getStudyWeightMultiplier(subjectId) {
  return PRIOR_EXAM_BASELINE[subjectId]?.studyWeightMultiplier ?? 1.0;
}

if (typeof module !== 'undefined') {
  module.exports = {
    PRIOR_EXAM_BASELINE,
    BASELINE_MAX_SCORE,
    scoreToWeakness,
    getBaselineWeakness,
    getSubjectsByPriority,
    getStudyWeightMultiplier
  };
}
