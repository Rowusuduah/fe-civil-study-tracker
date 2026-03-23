/**
 * state.js — Central in-memory state.
 * All UI modules read from STATE. All mutations go through update functions.
 * This prevents scattered localStorage reads and keeps state in sync.
 */

const STATE = {
  settings:    null,  // object
  subjects:    [],    // array of subject progress nodes
  sessions:    [],    // array of session records
  plan:        [],    // array of plan day objects
  resources:   [],    // array of resource records
  assessments: [],    // array of mock exam records
  revisions:   [],    // array of revision queue items
  mistakes:    [],    // array of mistake entries
  theme:       'dark',

  // Computed / derived (refreshed by refreshDerived())
  computed: {
    subjectMap:      {},  // subjectId → subject node
    subtopicMap:     {},  // subtopicId → subtopic node
    todaySessionMinutes: 0,
    totalSessionMinutes: 0,
    totalQuestionsAttempted: 0,
    totalQuestionsCorrect: 0,
    totalVideosWatched: 0,
    studyStreak: 0,
    longestStreak: 0,
    lastStudyDate: null,
    daysUntilExam: 0,
    examDate: '2026-04-22',
    readinessScore: null,
    weeklyPlannedHours: 0,
    weeklyActualHours: 0,
    overdueRevisionCount: 0,
    weakSubjects: [],   // sorted by priority
    strongSubjects: [], // sorted by mastery desc
    neglectedSubtopics: []
  }
};

// ─── Init ────────────────────────────────────────────────────────────────────

/**
 * Load all data from localStorage into STATE.
 * Must be called once on app startup before any rendering.
 */
function initState() {
  STATE.theme     = loadTheme();
  STATE.settings  = { ...DEFAULT_SETTINGS, ...loadSettings() };
  STATE.sessions  = loadSessions();
  STATE.plan      = loadPlan();
  STATE.resources = loadResources();
  STATE.assessments = loadAssessments();
  STATE.revisions = loadRevisions();
  STATE.mistakes  = loadMistakes();

  // Subjects: merge saved progress onto fresh syllabus scaffold
  const savedSubjects = loadSubjects();
  STATE.subjects = buildSubjectTree(savedSubjects);

  refreshDerived();
}

// ─── Subject Tree Builder ─────────────────────────────────────────────────────

/**
 * Merge saved progress data onto the canonical FE_CIVIL_SUBJECTS structure.
 * Always uses the canonical syllabus as the source of truth for structure;
 * saved data only provides progress fields.
 */
function buildSubjectTree(savedSubjects) {
  const savedMap = {};
  savedSubjects.forEach(s => { savedMap[s.id] = s; });

  return FE_CIVIL_SUBJECTS.map(subject => {
    const saved = savedMap[subject.id] || {};
    return {
      ...subject,
      // Progress fields (merged from saved, defaults to zero)
      coverageStatus: saved.coverageStatus || 'not_started',
      totalTimeMinutes: saved.totalTimeMinutes || 0,
      lastStudiedDate: saved.lastStudiedDate || null,
      lastRevisedDate: saved.lastRevisedDate || null,
      avgConfidence: saved.avgConfidence || null,
      avgAccuracy: saved.avgAccuracy || null,
      avgDifficulty: saved.avgDifficulty || null,
      weaknessScore: saved.weaknessScore || null,
      masteryScore: saved.masteryScore || null,
      priorityScore: saved.priorityScore || null,
      reviewInterval: saved.reviewInterval || 1,
      reviewCount: saved.reviewCount || 0,
      nextReviewDate: saved.nextReviewDate || null,
      topics: subject.topics.map(topic => {
        const savedTopic = (saved.topics || []).find(t => t.id === topic.id) || {};
        return {
          ...topic,
          coverageStatus: savedTopic.coverageStatus || 'not_started',
          totalTimeMinutes: savedTopic.totalTimeMinutes || 0,
          lastStudiedDate: savedTopic.lastStudiedDate || null,
          masteryScore: savedTopic.masteryScore || null,
          subtopics: topic.subtopics.map(sub => {
            const savedSub = (savedTopic.subtopics || []).find(s => s.id === sub.id) || {};
            return {
              ...sub,
              subjectId: subject.id,
              topicId: topic.id,
              coverageStatus: savedSub.coverageStatus || 'not_started',
              totalTimeMinutes: savedSub.totalTimeMinutes || 0,
              lastStudiedDate: savedSub.lastStudiedDate || null,
              lastRevisedDate: savedSub.lastRevisedDate || null,
              avgConfidence: savedSub.avgConfidence || null,
              avgAccuracy: savedSub.avgAccuracy || null,
              avgDifficulty: savedSub.avgDifficulty || null,
              weaknessScore: savedSub.weaknessScore || null,
              masteryScore: savedSub.masteryScore || null,
              priorityScore: savedSub.priorityScore || null,
              reviewInterval: savedSub.reviewInterval || 1,
              reviewCount: savedSub.reviewCount || 0,
              nextReviewDate: savedSub.nextReviewDate || null,
              mistakeCount: savedSub.mistakeCount || 0
            };
          })
        };
      })
    };
  });
}

// ─── Derived / Computed ──────────────────────────────────────────────────────

/**
 * Recompute all derived values from raw STATE data.
 * Call after any mutation.
 */
function refreshDerived() {
  const c = STATE.computed;
  const today = todayISO();
  const settings = STATE.settings;

  // Exam info
  c.examDate = settings.examDate;
  c.daysUntilExam = daysUntilExam(settings.examDate);

  // Build fast lookup maps
  c.subjectMap = {};
  c.subtopicMap = {};
  STATE.subjects.forEach(subj => {
    c.subjectMap[subj.id] = subj;
    subj.topics.forEach(topic => {
      topic.subtopics.forEach(sub => {
        c.subtopicMap[sub.id] = sub;
      });
    });
  });

  // Session aggregates
  c.totalSessionMinutes = STATE.sessions.reduce((s, sess) => s + (sess.durationMinutes || 0), 0);
  c.totalQuestionsAttempted = STATE.sessions.reduce((s, sess) => s + (sess.questionsAttempted || 0), 0);
  c.totalQuestionsCorrect   = STATE.sessions.reduce((s, sess) => s + (sess.questionsCorrect || 0), 0);
  c.totalVideosWatched = STATE.sessions.filter(s => s.type === 'video' && s.rewatchNeeded !== true).length;

  // Today's session minutes
  c.todaySessionMinutes = STATE.sessions
    .filter(s => s.date === today)
    .reduce((sum, s) => sum + (s.durationMinutes || 0), 0);

  // Study streak
  const streakData = computeStreak(STATE.sessions, today);
  c.studyStreak   = streakData.current;
  c.longestStreak = streakData.longest;
  c.lastStudyDate = streakData.lastDate;

  // Weekly hours (current week Mon–Sun)
  const monday = getMondayOfWeek(today);
  const sunday = addDays(monday, 6);
  c.weeklyPlannedHours = STATE.plan
    .filter(d => d.date >= monday && d.date <= sunday)
    .reduce((s, d) => s + (d.plannedHours || 0), 0);
  c.weeklyActualHours = STATE.sessions
    .filter(s => s.date >= monday && s.date <= sunday)
    .reduce((sum, s) => sum + (s.durationMinutes || 0) / 60, 0);

  // Overdue revisions
  c.overdueRevisionCount = STATE.revisions.filter(r => r.nextReviewDate <= today).length;

  // Readiness score (weighted mastery)
  c.readinessScore = computeReadiness(STATE.subjects);

  // Weak / strong subjects
  const scored = STATE.subjects
    .filter(s => s.masteryScore != null)
    .sort((a, b) => (a.masteryScore || 0) - (b.masteryScore || 0));
  c.weakSubjects   = scored.slice(0, 5);
  c.strongSubjects = [...scored].reverse().slice(0, 5);

  // Neglected subtopics
  c.neglectedSubtopics = [];
  const neglectCutoff = addDays(today, -settings.neglectDays);
  STATE.subjects.forEach(subj => {
    subj.topics.forEach(topic => {
      topic.subtopics.forEach(sub => {
        const lastStudied = sub.lastStudiedDate;
        if (sub.coverageStatus !== 'not_started' &&
            (!lastStudied || lastStudied < neglectCutoff)) {
          c.neglectedSubtopics.push(sub);
        }
      });
    });
  });
  c.neglectedSubtopics.sort((a, b) => (a.lastStudiedDate || '1970-01-01').localeCompare(b.lastStudiedDate || '1970-01-01'));
}

// ─── Streak Computation ───────────────────────────────────────────────────────

function computeStreak(sessions, today) {
  if (!sessions.length) return { current: 0, longest: 0, lastDate: null };

  const studyDays = new Set(sessions.map(s => s.date));
  let current = 0;
  let date = today;

  // Count backwards from today
  while (studyDays.has(date)) {
    current++;
    date = addDays(date, -1);
  }

  // If no study today but studied yesterday, still show streak from yesterday
  if (current === 0 && studyDays.has(addDays(today, -1))) {
    date = addDays(today, -1);
    while (studyDays.has(date)) {
      current++;
      date = addDays(date, -1);
    }
  }

  // Longest streak
  let longest = 0;
  let run = 0;
  const sortedDays = [...studyDays].sort();
  sortedDays.forEach((d, i) => {
    if (i === 0 || daysBetween(sortedDays[i - 1], d) !== 1) {
      run = 1;
    } else {
      run++;
    }
    if (run > longest) longest = run;
  });

  const lastDate = sortedDays[sortedDays.length - 1] || null;
  return { current, longest, lastDate };
}

// ─── Readiness Score ─────────────────────────────────────────────────────────

function computeReadiness(subjects) {
  const items = subjects.map(s => ({
    value: s.masteryScore,
    weight: s.examWeight
  }));
  return weightedAverage(items);
}

// ─── State Mutation Helpers ──────────────────────────────────────────────────

function persistSubjects() {
  saveSubjects(STATE.subjects);
  refreshDerived();
}

function persistSessions() {
  saveSessions(STATE.sessions);
  refreshDerived();
}

function persistPlan() {
  savePlan(STATE.plan);
  refreshDerived();
}

function persistResources() {
  saveResources(STATE.resources);
}

function persistAssessments() {
  saveAssessments(STATE.assessments);
}

function persistRevisions() {
  saveRevisions(STATE.revisions);
}

function persistMistakes() {
  saveMistakes(STATE.mistakes);
}

function persistSettings() {
  saveSettings(STATE.settings);
  refreshDerived();
}

/**
 * Update subject-level mastery/weakness/priority after a session.
 * Computes fresh scores from all sessions for that subject.
 */
function recomputeSubjectScores(subjectId) {
  const subj = STATE.computed.subjectMap[subjectId];
  if (!subj) return;

  const subjSessions = STATE.sessions.filter(s => s.subjectId === subjectId);

  if (subjSessions.length === 0) return;

  const accuracy = safeAccuracy(
    subjSessions.reduce((s, x) => s + (x.questionsCorrect || 0), 0),
    subjSessions.reduce((s, x) => s + (x.questionsAttempted || 0), 0)
  );
  const avgConf = average(subjSessions.map(s => s.confidenceAfter).filter(Boolean));
  const avgDiff = average(subjSessions.map(s => s.perceivedDifficulty).filter(Boolean));

  subj.avgAccuracy   = accuracy;
  subj.avgConfidence = avgConf;
  subj.avgDifficulty = avgDiff;

  subj.masteryScore  = computeMasteryScore({
    accuracy,
    confidence: avgConf,
    difficulty: avgDiff,
    lastStudiedDate: subj.lastStudiedDate,
    coverageRatio: getSubjectCoverageRatio(subj)
  });

  subj.weaknessScore = computeWeaknessScore({
    accuracy,
    confidence: avgConf,
    difficulty: avgDiff,
    lastStudiedDate: subj.lastStudiedDate,
    mistakeCount: subj.topics.reduce((s, t) => s + t.subtopics.reduce((ss, sub) => ss + (sub.mistakeCount || 0), 0), 0),
    baselineWeakness: getBaselineWeakness(subjectId)
  });

  subj.priorityScore = computePriorityScore({
    weaknessScore: subj.weaknessScore,
    nextReviewDate: subj.nextReviewDate,
    examWeight: subj.examWeight,
    isFoundational: subj.topics.some(t => t.isFoundational),
    lastStudiedDate: subj.lastStudiedDate,
    neglectDays: STATE.settings.neglectDays
  });
}

function getSubjectCoverageRatio(subj) {
  let total = 0, done = 0;
  subj.topics.forEach(t => {
    t.subtopics.forEach(sub => {
      total++;
      if (sub.coverageStatus === 'complete') done++;
    });
  });
  return total > 0 ? done / total : 0;
}
