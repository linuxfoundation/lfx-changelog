<!-- Copyright The Linux Foundation and each contributor to LFX. -->
<!-- SPDX-License-Identifier: MIT -->
<!-- markdownlint-disable MD013 -->

# UI releases

Authorized Changelog admins can start the existing LFX service release
from **Create a new release** (`/admin/release-jobs`). This is not the
Repositories page and it does not use `/api/releases`. That path still
only syncs stored GitHub release records.

## Who can use it

- Super admin: every service in `api_release_services.json`
- Product admin: services mapped to a product they administer
- Editor: no catalog, no start, no cancel, no retry

Start, confirm, cancel, and retry need a signed-in browser session.
API keys are rejected on those writes.

## Flow

1. Open **Create a new release**. Zero-pending rows cannot start.
2. Review the plan. Generate, edit, or regenerate notes.
3. Confirm. That creates one `ReleaseJob` and returns immediately.
   The image-build wait (about 6-7 minutes) continues on the job.
4. Watch the console. Closing the browser does not stop the job.
5. After image CI, Changelog watches for the GitOps version-bump job
   and Slack-notifies when that job is running.
6. The autonomous job opens the version-bump PR. Changelog attaches
   and Slack-notifies with the PR link. Changelog does not edit
   GitOps files.
7. After `@lfx-one` approves, Changelog Slack-notifies, adds the PR
   to the GitHub merge queue, and waits. It does not squash-merge.
   Other approvals do not enqueue. An authorized user can cancel.
8. When the merge queue finishes, Changelog Slack-notifies and
   finishes. It does not request an Argo CD sync. The cluster
   webhook applies the merged pins when platform enables that.

Creating a software release does not publish a Changelog entry. The
existing draft agent may still run from the GitHub release webhook.

## Secrets

Set these in the server environment (see `.env.example`):

- Dedicated GitHub App: `RELEASE_GITHUB_APP_ID`,
  `RELEASE_GITHUB_PRIVATE_KEY`, `RELEASE_GITHUB_INSTALLATION_ID`
  (create the service release, watch CI, read the GitOps PR, enqueue
  the merge queue)
- Slack (optional): `RELEASE_SLACK_BOT_TOKEN`, `RELEASE_SLACK_CHANNEL`
- Argo CD sync is off (`RELEASE_ARGOCD_SYNC_ENABLED=false`). Deploy
  apply is left to the cluster webhook. Do not set
  `ARGOCD_STAGING_*` / `ARGOCD_PROD_*` until platform is ready and
  this flag is turned on.
- Laptop collision token: `RELEASE_LOCK_TOKEN`

Changelog does not need a GPG key or GitOps opener token. Pin commits
are created in `lfx-v2-argocd`. If no bump PR appears after CI, the
job fails and does not push a fallback commit.

## Laptop scripts

`lfx_api_release.py` and `lfx_self_serve_release.py` stay as
break-glass. Before they create a GitHub release they call
`GET {CHANGELOG_URL}/internal/release-lock/{serviceKey}` with
`X-Release-Lock-Token: {CHANGELOG_RELEASE_LOCK_TOKEN}`. If Changelog
already has an active job, the script aborts.

Copy `api_release_services.json` into Changelog when the registry
changes. Changelog does not exec the laptop Python scripts.

## Quickstart gaps (2026-08-25)

Walked `specs/003-changelog-ui-releases/quickstart.md` against this
implementation. These still need a live non-prod run before the first
real ship:

- Dedicated GitHub App in a running Changelog
- Self Serve notify job and ArgoCD `create-version-bump-pr.yml`
- A real confirm through CI, bump PR attach, `@lfx-one` enqueue,
  merge-queue finish, and sync
- Slack thread and summary in `#lfx-one-app-dev`
- Laptop script abort while a UI job is `waiting_for_approval`

Do not start a production service from local until the bot identity
is reviewed.
