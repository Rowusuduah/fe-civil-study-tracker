/**
 * Optional, browser-local exam baseline.
 * No personal scores are shipped with the public app. A user may import their
 * own profile in Settings; it is included in their private backups/Drive sync.
 */

const BASELINE_SUBJECT_IDS = new Set([
  'mathematics', 'economics', 'surveying', 'statics', 'structural',
  'dynamics', 'geotechnical', 'water', 'fluid', 'construction',
  'mechanics', 'transportation', 'materials', 'ethics'
]);
const BASELINE_MAX_SCORE = 15.0;
const BASELINE_MIN_SCORE = 5.0;

/** Reject malformed or unexpected profile data before it reaches the UI. */
function normalizeBaselineProfile(input) {
  const source = input?.subjects ?? input;
  if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
  const ids = Object.keys(source);
  if (!ids.length || ids.length > BASELINE_SUBJECT_IDS.size ||
      ids.some(id => !BASELINE_SUBJECT_IDS.has(id))) return null;

  const profile = Object.create(null);
  for (const id of ids) {
    const item = source[id];
    if (!item || typeof item !== 'object' || Array.isArray(item) ||
        !Number.isFinite(item.score) || item.score < 0 || item.score > BASELINE_MAX_SCORE ||
        !['WEAK', 'MID', 'STRONG'].includes(item.tier) ||
        !Number.isInteger(item.priority) || item.priority < 1 || item.priority > BASELINE_SUBJECT_IDS.size ||
        !Number.isFinite(item.studyWeightMultiplier) ||
        item.studyWeightMultiplier < 0.1 || item.studyWeightMultiplier > 3) return null;
    profile[id] = {
      score: item.score,
      tier: item.tier,
      priority: item.priority,
      studyWeightMultiplier: item.studyWeightMultiplier
    };
  }
  return profile;
}

function readBaselineProfile() {
  if (typeof loadJSON !== 'function') return Object.create(null);
  const stored = loadJSON(KEYS.BASELINE, null);
  return normalizeBaselineProfile(stored) || Object.create(null);
}

let PRIOR_EXAM_BASELINE = readBaselineProfile();

function reloadBaselineProfile() {
  PRIOR_EXAM_BASELINE = readBaselineProfile();
}

function saveBaselineProfile(input) {
  const profile = normalizeBaselineProfile(input);
  if (!profile) return false;
  try {
    localStorage.setItem(KEYS.BASELINE, JSON.stringify(profile));
    reloadBaselineProfile();
    queueDriveSync();
    return true;
  } catch (_) {
    return false;
  }
}

function scoreToWeakness(score) {
  const clampedScore = Math.max(BASELINE_MIN_SCORE, Math.min(BASELINE_MAX_SCORE, score));
  return 1 - (clampedScore - BASELINE_MIN_SCORE) / (BASELINE_MAX_SCORE - BASELINE_MIN_SCORE);
}

function getBaselineWeakness(subjectId) {
  const b = PRIOR_EXAM_BASELINE[subjectId];
  return b ? scoreToWeakness(b.score) : 0.5;
}

function getSubjectsByPriority() {
  return Object.entries(PRIOR_EXAM_BASELINE)
    .sort((a, b) => a[1].priority - b[1].priority)
    .map(([id, data]) => ({ id, ...data }));
}

function getStudyWeightMultiplier(subjectId) {
  return PRIOR_EXAM_BASELINE[subjectId]?.studyWeightMultiplier ?? 1.0;
}

if (typeof module !== 'undefined') {
  module.exports = {
    BASELINE_MAX_SCORE, scoreToWeakness, getBaselineWeakness,
    getSubjectsByPriority, getStudyWeightMultiplier, normalizeBaselineProfile,
    saveBaselineProfile, reloadBaselineProfile
  };
}
