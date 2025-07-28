# AGENTS.md

> You are an AI agent working on this repository. Follow the rules below to ensure clean, safe, and consistent contributions.

---

## @RULE: WORKFLOW
- Never commit directly to `main` — use a feature branch and submit a pull request.
- Rebase or merge the latest `main` before opening a PR.
- Write clear, descriptive commit messages summarizing what and why.
- Ensure all necessary files are tracked and committed.

---

## @RULE: FILES
- ✅ You may modify or create files in:
  - `src/`
  - `test-vite-react/`
  - Config files (`*.json`, `.env`, `.gitignore`, etc.)
- ❌ Do not modify:
  - `index.html`
  - `public/` folder
  - Any unlisted top-level files or directories

---

## @RULE: TESTING
- Run `npm test` after all code or UI changes.
- Do not proceed if tests fail.
- 🧪 **When adding new logic or UI, write a new test.**
- 🔁 **When changing existing logic or UI, update the matching test.**
- Prefer colocated tests in `test-vite-react/tests/`.

---

## @RULE: DESIGN STYLE
- Follow the current dark theme and UI spacing conventions.
- Reuse existing components and layouts when possible.

---

## @RULE: SAFETY
- Avoid large dependencies unless approved.
- Don’t change exports or public APIs without test coverage.
- Ask for clarification if requirements are unclear.

---

## @RULE: LLM USAGE
- Only use OpenAI endpoints specified in `.env`.
- Place prompt templates in `src/prompts/`, with clear I/O expectations.
- Validate and sanitize all LLM output before writing to disk.

---

## @RULE: OBSIDIAN FILE SYSTEM
- Read only from `vault/` via the Obsidian API.
- Never delete or modify user notes unless explicitly confirmed.
- Write outputs to a user-defined folder (default: `Summaries/`).

---

## @RULE: PLUGIN SETTINGS
- Fail gracefully if no OpenAI key is provided.
- Store settings using Obsidian’s `PluginSettings` API.

---

## ✅ RELEASE READINESS
- [ ] All tests pass
- [ ] New logic includes matching tests
- [ ] UI updates include matching UI tests
- [ ] LLM prompts tested manually on real notes
- [ ] Output format is clean markdown
- [ ] Filters work as intended
- [ ] Plugin settings are documented and usable in the UI
