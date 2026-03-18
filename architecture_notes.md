# Architecture Notes: Current State vs Documentation

## What is actually implemented right now
- Architect orchestrator is real and in use.
- Graph is built and compiled in `architect.py:26`, with nodes added in `architect.py:28`, `architect.py:29`, `architect.py:30`, `architect.py:31`, `architect.py:32`, `architect.py:33`, and compiled in `architect.py:64`.
- Runner imports and executes that compiled graph in `runner.py:4`, `runner.py:17`, and `runner.py:50`.
- Worker count is 4.
- The worker functions are surgeon/diver/skeptic/scorer in `agents.py`.
- Preprocessor is separate in `preprocessor.py`.
- Architect is orchestration logic, not a streamed worker step.
- Streamed steps come from graph node events in `runner.py:17`.
- Architect appears as a fallback label only if needed in final payload defaulting logic at `runner.py:33` and `runner.py:63`.

## Where the wording clash comes from
- Planning doc says 4 workers + 1 Architect = 5 total nodes.
  - `implementation_plan.md:8`
  - `implementation_plan.md:65`
- README says 5-agent chain and shows only preprocessor→surgeon→diver→skeptic→scorer in the text diagram.
  - `README.md:13`
  - `README.md:18`
- UI has mixed representation.
  - Timeline lists only 5 processing stages in `index.html:39`, `index.html:40`, `index.html:41`, `index.html:42`, `index.html:43`.
  - D3 graph includes Architect as a separate visual node in `truth-graph.js:9`, with links from architect to workers in `truth-graph.js:16`, `truth-graph.js:17`, `truth-graph.js:18`, `truth-graph.js:19`, `truth-graph.js:20`.

## Canonical truth you can use going forward
- 4 worker agents: surgeon, diver, skeptic, scorer.
- 1 preprocessing node before workers.
- Architect orchestrator exists and is used to wire/execute the graph.
- Error handler node exists for terminal failures.

**So:**
- Worker agents = 4
- Main pipeline stages = 5
- Graph nodes including error handler = 6
- If counting Architect as conceptual orchestrator plus 5 stages, people may say 6 conceptual components
