# UI/UX Redesign Execution Spec

Date: March 20, 2026
Project: The Eye Opener
Scope: Full frontend redesign with complete functional parity

## 1. Execution Summary

1. Scope: Full frontend redesign only, no backend contract changes.
2. Functional parity: Must retain streaming flow, result rendering, settings save/load, theme persistence, keyboard shortcuts, and error handling currently wired in static/js/main.js, static/js/settings.js, and API routes in app.py.
3. Delivery mode: Incremental rollout in phases with acceptance checks after each phase.
4. Constraint: No backend API changes required.

## 2. Non-Negotiables

1. Keep SSE lifecycle behavior from static/js/main.js (startStream, complete, error handling).
2. Keep settings contracts and keys from static/js/settings.js and app.py.
3. Keep Ollama model refresh path from static/js/settings.js and app.py.
4. Keep all output sections: result snapshot, sources list, explanation cards in static/index.html.
5. Preserve accessibility semantics already present (dialog, aria-live, labels) and improve them.

## 3. Target UX Blueprint

1. Top Layer: Command Bar
2. Claim composer with helper chips, analyze button, quick status.
3. Secondary actions: clear input, sample claim, shortcut hint.
4. Center Layer: Pipeline Theater
5. Interactive stage graph with animated connectors and active stage metadata.
6. Unified observer timeline showing structured events.
7. Bottom Layer: Evidence Workspace
8. Tabbed panels: Verdict, Sources, Explanation, Raw Stream.
9. Progressive disclosure so users see summary first and details on demand.
10. Settings Layer: Slide-over drawer with grouped provider cards, validation, test status, save state.

## 4. Component Inventory

1. App Shell
2. HeaderBrand
3. StatusPill
4. ClaimComposer
5. QuickActions
6. PipelineTheater
7. StageNode (Claim, Architect, Preprocessor, Surgeon, Diver, Skeptic, Scorer, Error)
8. StageConnector
9. ObserverTimeline
10. VerdictHero
11. MetricCard (retrieval method, truth score, confidence)
12. SourcesBoard
13. SourceCard
14. ExplanationAccordion
15. SettingsDrawer
16. ProviderSelector
17. ProviderFieldsPanel
18. ToastSystem
19. EmptyState and ErrorState blocks
20. MobileBottomActions

## 5. Interaction Model

1. Analyze action
2. Validate input.
3. Lock composer actions except cancel/reset.
4. Animate stage reset then begin streaming.
5. SSE events
6. active_agent updates stage highlight and connector progress.
7. event_type error shows inline + toast + keeps observer logs.
8. event_type complete triggers final reveal sequence and unlocks composer.
9. Post-complete
10. Auto-focus Verdict tab.
11. Sources and explanation remain collapsible.
12. Settings interaction
13. Dirty-state detection.
14. Save button states: idle, saving, success, error.
15. Optional test connection per provider before save.

## 6. Motion and Animation Spec

1. Motion tokens
2. duration-fast: 140ms
3. duration-base: 240ms
4. duration-slow: 360ms
5. easing-standard: cubic-bezier(0.2, 0.8, 0.2, 1)
6. easing-emphasis: cubic-bezier(0.34, 1.56, 0.64, 1)
7. Entry choreography
8. Page load: staggered panel reveal, 40ms stagger.
9. Pipeline start: all nodes dim to idle, active node pulses.
10. Stage transitions
11. Previous node settles to complete state.
12. Connector animates forward 180ms.
13. Next node elevates with glow ring.
14. Completion
15. Score count-up animation 500ms.
16. Result cards slide-up stagger 60ms.
17. Observer pulse stops and status changes to complete.
18. Error state
19. Active node turns warning color.
20. Shake animation only once, max 320ms.
21. Reduced motion
22. Disable transform-heavy animations when prefers-reduced-motion is set.
23. Retain opacity-only transitions.

## 7. Visual System Direction

1. Keep current warm/earthy identity but sharpen with stronger contrast and typographic hierarchy.
2. Replace flat badges with semantic color system for True/False/Misleading/Error.
3. Standardize panel elevations and border strengths.
4. Introduce subtle textured background layers without heavy blur overuse.
5. Ensure mobile typography scales are legible and compact.

## 8. Phase-Wise Implementation Plan

### Phase 1: Foundation and Tokens

1. static/css/style.css
2. Add structured design tokens (color roles, spacing, radius, motion).
3. Define component-level utility classes for states: idle, active, complete, error.
4. Add reduced-motion media handling.
5. static/index.html
6. Introduce semantic wrappers for command bar, theater, workspace.
7. Keep existing IDs used by JS to prevent breakage.
8. static/js/main.js
9. No behavior changes yet, only class hooks for new state names.
10. Acceptance
11. Existing functionality unchanged.
12. No visual regressions in core flow.

### Phase 2: Command Bar and Pipeline Theater

1. static/index.html
2. Rework input section into ClaimComposer with action cluster and shortcut hint.
3. Rebuild stream area into PipelineTheater + ObserverTimeline containers.
4. static/css/style.css
5. Implement node, connector, and timeline visual states with transition rules.
6. static/js/main.js
7. Map active_agent and event_type updates to new class/state architecture.
8. Add deterministic resetFlowState and finalizeFlowState functions.
9. Acceptance
10. Stage highlights and live logs still work.
11. Analyze and Ctrl/Cmd+Enter still work.

### Phase 3: Evidence Workspace

1. static/index.html
2. Convert result, sources, explanation into tabbed EvidenceWorkspace layout.
3. Add Raw Stream tab bound to observer data.
4. static/css/style.css
5. Add tab system styles, card patterns, and responsive stacks.
6. static/js/main.js
7. Add tab switching, active panel handling, and auto-focus on completion.
8. Keep existing render functions, adapt output targets.
9. Acceptance
10. Retrieval method, truth score, verdict, sources, explanation all still render correctly.

### Phase 4: Settings UX Modernization

1. static/index.html
2. Restructure drawer sections for clarity: Appearance, Provider, Runtime, Actions.
3. Keep existing field IDs and names for compatibility.
4. static/css/style.css
5. Refresh provider cards, input validation visuals, and save footer behavior.
6. static/js/settings.js
7. Add dirty-state tracking, inline validation, and optional connection-test action.
8. Keep load/save payload contract exactly as is.
9. Acceptance
10. Save and load flows unchanged from API perspective.
11. Theme and provider selection remain persistent and stable.

### Phase 5: Accessibility, Mobile, and Polish

1. static/css/style.css
2. Tighten breakpoints for 390px and 768px targets.
3. Optimize touch targets and sticky action placement.
4. static/js/main.js
5. Improve focus management after complete/error transitions.
6. Add aria-live tone separation for status and observer updates.
7. static/index.html
8. Add missing aria labels, landmarks, and keyboard affordances.
9. Acceptance
10. Keyboard-only operation works for analyze, tabs, settings open/close/save.
11. Mobile flow remains readable and non-cluttered.

### Phase 6: Regression and Stability

1. static/js/main.js
2. Preserve all endpoint assumptions and payload parsing.
3. Harden null checks for optional fields in streamed state.
4. static/js/settings.js
5. Preserve fallback paths when model fetch fails.
6. app.py
7. No endpoint changes required; verify behavior compatibility only.
8. Acceptance
9. Full end-to-end run: input to complete event to rendered outputs.
10. Error scenario run: displays error state and recovers on next analyze.

## 9. Acceptance Checklist

### Core parity checklist

1. Analyze button and keyboard shortcut.
2. Stage updates for each agent.
3. Observer logs for claims/research/critiques/verdicts.
4. Completion render for score/verdict/sources/explanation.
5. Settings save/load across all providers.
6. Theme persistence and no flash at load.

### UX quality checklist

1. Visual hierarchy clear in under 3 seconds of scan.
2. Interactions feel responsive under stream updates.
3. Mobile layout avoids long-scroll overwhelm with tabs/accordions.

### Accessibility checklist

1. Focus visible on all controls.
2. Sufficient contrast in both themes.
3. Reduced-motion mode respected.

## 10. Recommended Implementation Sequence

1. Execute Phase 1 and Phase 2 together in one PR for immediate visible value.
2. Phase 3 in a second PR focused on information architecture and readability.
3. Phase 4 and Phase 5 in a third PR for settings and accessibility polish.
4. Phase 6 as final stabilization pass before release.
