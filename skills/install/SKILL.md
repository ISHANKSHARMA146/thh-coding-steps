---
name: install
description: One-time workspace setup for thh-coding-steps. Run from the workspace root that holds thh-backend and thh-frontend. Adds the standards pointer to each repo's CLAUDE.md, gitignores .thh/ and worktrees/, creates the folders.
disable-model-invocation: true
allowed-tools: Bash(node *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/install.js"`

Relay the output above verbatim. If it says the standards file is MISSING, tell the user the plugin copy is incomplete and to reinstall. Add nothing else.
