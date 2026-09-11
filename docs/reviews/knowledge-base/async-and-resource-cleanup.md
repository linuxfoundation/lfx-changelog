<!-- Copyright The Linux Foundation and each contributor to LFX. -->
<!-- SPDX-License-Identifier: MIT -->

# Async and resource cleanup patterns

Patterns extracted from past PR review comments about timers, health-check
handlers, and idempotency of side-effecting recorders.

## `Promise.race` with a `setTimeout` needs the timer cleared on the fast path

A readiness/health-check handler racing a real check against a
`setTimeout` promise must clear the timeout when the real check wins, or
every successful probe leaks a pending timer. Since these handlers are hit
continuously by Kubernetes probes, this compounds. Store the timer handle
before the `try`, and `clearTimeout` it in both the success path and the
`catch`.

- Source: PR #101, `apps/lfx-changelog/src/server/setup/routes.ts` — the
  `/readyz` handler's `Promise.race` never cleared its `setTimeout`; fixed
  by storing `timerId` and calling `clearTimeout(timerId)` on both paths.

## Verify async assumptions against the actual installed version before adding await/top-level-await

Don't assume a library's method is async because it "does async work
internally" — check the actual shipped types/build output for the pinned
version. A claim that `sdk.start()` needs awaiting was checked against
`@opentelemetry/sdk-node@0.219.0`'s build output and found to be
synchronous (`void`, not `Promise`); no change was made.

- Source: PR #162, `apps/lfx-changelog/otel.mjs` — reviewer initially
  flagged unawaited `sdk.start()`; verified against the installed package's
  build artifact and closed with no code change.

## Recording side effects (scores, audit entries) per job must be idempotent when the same job can trigger multiple recordings

If a job's quality/validation logic can run more than once per `jobId`
(e.g. up to N validation rounds, plus a completion-time fallback recorder),
recording a score by simple `push()` produces duplicate entries for the same
job and skews any trend/analytics reading of that data. Recording logic
needs to key on `jobId` and replace rather than append, or one of the
recording paths needs to be made mutually exclusive with the other.

- Source: PR #89, `apps/lfx-changelog/src/server/services/changelog-agent.service.ts` —
  `validate_changelog_draft` and `recordScoresFromProgressLog` could both
  append a `QualityScoreEntry` for the same `jobId`.
