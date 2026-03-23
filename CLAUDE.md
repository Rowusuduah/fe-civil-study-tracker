# FE Civil Study Tracker — Project Intelligence

## Purpose
Complete FE Civil exam study tracker. Exam date: **April 22, 2026**.
User previously failed; app uses prior score profile as adaptive baseline.
Built on a vanilla JS PWA starter — no build tools, no frameworks, runs by opening index.html.

---

## Architecture

```
index.html                     # 9-tab SPA shell
css/styles.css                 # Full design system (dark/light, components)
js/app.js                      # Entry point: init, tab control, event wiring
js/state.js                    # Central in-memory state (single source of truth)
js/storage.js                  # All localStorage keys + load/save + backup/restore
js/utils.js                    # escapeHTML, date helpers, UUID, formatters
js/data/
  subjects.js                  # FE Civil syllabus: 14 subjects → topics → subtopics
  baseline.js                  # Prior exam score seeds (weakness profile)
js/engine/
  calculations.js              # ALL formulas: mastery, weakness, priority, readiness, intervals
  spacedRepetition.js          # Review queue, interval logic, forgetting curve
  adaptive.js                  # Priority scoring, recommendations, neglect detection
  scheduler.js                 # Study plan generation, phase logic, catch-up
js/ui/
  ui-dashboard.js              # Dashboard tab renderer
  ui-plan.js                   # Study plan + calendar renderer
  ui-sessions.js               # Session logger forms and list
  ui-subjects.js               # Subject tree with mastery/weakness indicators
  ui-revision.js               # Revision queue, mistake notebook
  ui-resources.js              # Video/book/resource tracker
  ui-assessments.js            # Mock exam logger and trend view
  ui-analytics.js              # Charts, heatmap, analytics views
  ui-settings.js               # Settings forms and controls
sw.js                          # Service Worker (cache-first PWA)
manifest.json                  # PWA metadata
README.md                      # Full project documentation
.gitignore
```

---

## Data Model

### Storage Keys (all `fe_civil_*`)
| Key | Type | Description |
|-----|------|-------------|
| `fe_civil_theme` | string | "dark" or "light" |
| `fe_civil_settings` | object | Exam date, hours, phase dates, intervals |
| `fe_civil_subjects` | array | Full syllabus tree with progress state |
| `fe_civil_sessions` | array | All logged study sessions |
| `fe_civil_plan` | array | Generated study plan days |
| `fe_civil_resources` | array | Videos, books, problem sets |
| `fe_civil_assessments` | array | Mock exam records |
| `fe_civil_revisions` | array | Spaced repetition queue |
| `fe_civil_mistakes` | array | Mistake notebook entries |
| `fe_civil_gdrive_file` | string | Google Drive file ID |
| `fe_civil_gdrive_ok` | bool | Drive connected flag |

---

## Key Formulas (see calculations.js for full implementations)

### Mastery Score (0–100)
```
mastery = (accuracy×0.35 + confidence/5×0.25 + (1-difficulty/5)×0.15 + coverage×0.15 + recency×0.10) × 100
```

### Weakness Score (0–100)
```
weakness = ((1-accuracy)×0.30 + (1-conf/5)×0.20 + diff/5×0.15 + recencyDecay×0.15 + mistakeRatio×0.10 + baselineWeak×0.10) × 100
```

### Priority Score (0–100)
```
priority = weakness×0.40 + urgency×0.25 + examWeight×0.15 + foundational×0.10 + neglect×0.10
```

### Readiness Score (0–100)
```
readiness = Σ(mastery[i] × examWeight[i])   // weighted average across all 14 subjects
```

### Review Intervals (days)
Base: [1, 3, 7, 14, 30] — shortened by modifiers for weak/difficult topics. Reset to 0 on failure (accuracy < 40%).

### Planned Hours per Day
- Normal phase (until April 10): weekday=6h, weekend=12h
- Intense phase (April 10+): 14h/day

---

## Study Logic Principles
- Weakest subjects (low prior score + low accuracy) get earliest daily slot
- No subject > 40% of any single day except final sprint
- Spaced repetition: base intervals shortened by difficulty/confidence/mistake modifiers
- Catch-up: deficit spread over next 7 days, capped at daily max
- Final 12 days before exam: revision + mock + error review only
- Confidence mismatch: flag if confidence≥4 but accuracy<50% (overconfidence)
- Neglect detection: any subtopic not studied in >14 days gets flagged

---

## Prior Exam Baseline (weakness profile)
| Subject | Score | Tier |
|---------|-------|------|
| Mathematics & Stats | 5.1 | WEAK |
| Engineering Economics | 5.8 | WEAK |
| Surveying | 5.9 | WEAK |
| Statics | 6.5 | WEAK |
| Dynamics | 6.8 | WEAK |
| Structural Engineering | 6.7 | WEAK |
| Geotechnical Engineering | 6.6 | WEAK |
| Water Resources & Env | 7.6 | MID |
| Fluid Mechanics | 8.0 | MID |
| Construction Engineering | 8.0 | MID |
| Mechanics of Materials | 8.4 | MID |
| Transportation Engineering | 9.5 | STRONG |
| Materials | 10.1 | STRONG |
| Ethics & Professional Practice | 15.0 | STRONG |

---

## Agent Responsibilities
All agent specs in `.claude/agents/`. Key agents:
- **calculations.js** is owned by the Calculation Auditor — every formula is documented and audited there
- **scheduler.js** is owned by the Schedule Planning Agent + Learning Science Agent
- **adaptive.js** is owned by the Learning Science Agent + Learning Psychologist Agent
- **ui-dashboard.js** is owned by Dashboard & Analytics Agent

---

## Non-Negotiables
- No divide-by-zero: always check denominator before dividing
- All mastery/weakness/priority scores bounded 0–100
- All JSON.parse wrapped in try/catch
- No innerHTML with unescaped user content (use escapeHTML from utils.js)
- Date math uses consistent local-time (no UTC mixing)
- Empty states required on every list/table
- Mobile-responsive: all 9 tabs accessible on 375px width
- No console.log in production code (use utils.log in dev only)
