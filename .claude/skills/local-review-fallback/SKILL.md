---
name: local-review-fallback
description: >
  Claude Opus fallback orchestrator for lfx-changelog's local pre-PR review,
  used when Pi is unavailable. Launches exactly three generic subagents in
  one parallel batch, all model opus, each loading a named reviewer skill.
  Launch table only — no reviewer substance lives here.
---

<!-- Copyright The Linux Foundation and each contributor to LFX. -->
<!-- SPDX-License-Identifier: MIT -->

# local-review-fallback — lfx-changelog

Launch exactly three generic subagents in one parallel batch, **all three
using model `opus`**, each told which skill to load and which range to
review. This is a launch table. It contains no criteria, no severities, no
floor rules, no knowledge-base awareness — all of that lives in the three
named skills below.

| Role             | Model  | Skill to load                        |
| ---------------- | ------ | ------------------------------------ |
| `general`        | `opus` | `lfx-skills:lfx-general-code-review` |
| `repo_code`      | `opus` | `local-code-review`                  |
| `repo_learnings` | `opus` | `local-learnings-review`             |

One model requirement for the whole batch, not per role.

## What you pass to each subagent

`target repo`, `target_sha`, `base_sha` (or `none`), the explicit
`review exactly:` range, and any `extra` hint — unchanged from what the
host gave you. Tell each subagent: load the named skill and follow it
exactly, review only the supplied range, and return an ordinary Markdown
review.

## Failure

A subagent that errors, returns nothing, or returns Markdown that is not a
review is a role-labelled host failure of the all-Claude cycle. Never
render it as "no findings", never write an `INCOMPLETE` line on a
subagent's behalf, and rerun all three rather than the failed one alone.
Never combine Pi and Claude roles in one cycle.
