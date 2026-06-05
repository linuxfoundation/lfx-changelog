// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

/**
 * Posts a "deployment removed" comment on the pull request when the
 * preview deployment is torn down (PR closed or deploy-preview label
 * removed).
 *
 * Invoked from .github/workflows/docker-build-pr.yml via
 * actions/github-script.
 *
 * Required env vars:
 *   PR_NUMBER - The pull request number.
 *
 * @param {object} ctx
 * @param {ReturnType<typeof import('@actions/github').getOctokit>} ctx.github
 * @param {typeof import('@actions/github').context} ctx.context
 * @returns {Promise<void>}
 */
module.exports = async ({ github, context }) => {
  const prNumber = process.env.PR_NUMBER;
  if (!prNumber) {
    throw new Error('PR_NUMBER env var is required');
  }

  const body = `## 🧹 Deployment Removed

The deployment for PR #${prNumber} has been removed.`;

  await github.rest.issues.createComment({
    issue_number: context.issue.number,
    owner: context.repo.owner,
    repo: context.repo.repo,
    body,
  });
};
