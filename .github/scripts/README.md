<!--
Copyright The Linux Foundation and each contributor to LFX.
SPDX-License-Identifier: MIT
-->

# GitHub Actions Helper Scripts

CommonJS modules invoked from `.github/workflows/*.yml` via the
[`actions/github-script`](https://github.com/actions/github-script) action.

## Why extract?

Inline JavaScript inside YAML strings loses:

- Syntax highlighting in most editors
- ESLint coverage
- JSDoc type hints from `@actions/github`
- Reasonable diff output when the comment template changes
- The ability to lint or run the code outside the workflow

Keeping these scripts in standalone `.js` files lets editors and tooling
treat them as first-class JavaScript.

## How they're invoked

Each script exports an `async` function taking `{ github, context, core }`
from `actions/github-script`. Inputs come from `process.env`, populated by
the workflow's `env:` block:

```yaml
- name: Comment on the PR
  uses: actions/github-script@<sha> # vX.Y.Z
  env:
    PR_NUMBER: ${{ github.event.pull_request.number }}
  with:
    script: |
      const script = require('./.github/scripts/comment-deployment-status.js');
      await script({ github, context });
```

Requirements:

- The workflow must run `actions/checkout` (full or sparse) before the
  script step so the file is present on disk.
- `require()` paths are relative to `GITHUB_WORKSPACE`, which is where
  `actions/checkout` writes the repo.

## Available scripts

| Script                          | Workflow              | Purpose                                                            |
| ------------------------------- | --------------------- | ------------------------------------------------------------------ |
| `comment-deployment-status.js`  | `docker-build-pr.yml` | Upserts the preview-deployment status comment on a PR              |
| `comment-deployment-removed.js` | `docker-build-pr.yml` | Posts a removal notice when a PR's preview deployment is torn down |

## Linting

Linted by the root `eslint.config.js` (flat config). Run locally with:

```bash
yarn lint:scripts
```

The same command runs in CI via the `scripts-lint` job in
`.github/workflows/ci.yml`.
