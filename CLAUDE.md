# Standard Interiors - Estimator Workflow Tool

Commercial flooring estimator workflow automation. Uses GPT-5.4 to process bid invites, classify drawings, and extract specs.

## Workflow Orchestration

### 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately - don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes - don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests - then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

## Task Management
1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections

## Testing
- **All tests must be run using Chrome MCP** (browser automation via Claude in Chrome)
- Navigate to the live app and interact through the actual UI
- No curl/httpie/programmatic testing — everything through the browser

## Git Commits
- **Always make the user the author** — use the configured git identity, never override with Co-Authored-By or --author flags
- Commit messages should be concise and descriptive

## Core Principles
- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.
- **NEVER ignore warnings or errors** — fix them immediately. No "harmless" warnings.

## Tech Stack
- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- OpenAI GPT-5.4 for AI processing
- SQLite (better-sqlite3) for persistence
- Fly.io for deployment (sjc region, port 8080)
- pdf2pic + Ghostscript for PDF rasterization
- sharp for image processing
- pdf-parse for text extraction

## Key Architecture Decisions
- Project-centric UI (not feature-centric)
- In-memory PDF processing (no object storage)
- SSE for real-time processing progress
- Confidence tiers on all AI output (high/medium/needs-review)
- PDF export is the primary deliverable format
