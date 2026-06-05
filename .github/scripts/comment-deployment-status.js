// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

/**
 * Posts a deployment status comment on the pull request, or updates the
 * existing one in place if a previous run already commented. The prior
 * comment is identified by matching the bot user type and a sentinel
 * header string in the comment body.
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

  const HEADER = '## 🚀 Deployment Status';
  const deploymentUrl = `https://changelog-pr-${prNumber}.dev.v2.cluster.linuxfound.info`;
  const body = `${HEADER}

Your branch has been deployed to: ${deploymentUrl}

**Deployment Details:**
- Environment: Development
- Namespace: changelog-pr-${prNumber}
- ArgoCD App: changelog-pr-${prNumber}

The deployment will be automatically removed when this PR is closed.`;

  const comments = await github.paginate(github.rest.issues.listComments, {
    issue_number: context.issue.number,
    owner: context.repo.owner,
    repo: context.repo.repo,
    per_page: 100,
  });

  const existing = comments.find((c) => c.user.type === 'Bot' && c.body.includes(HEADER));

  if (existing) {
    await github.rest.issues.updateComment({
      comment_id: existing.id,
      owner: context.repo.owner,
      repo: context.repo.repo,
      body,
    });
  } else {
    await github.rest.issues.createComment({
      issue_number: context.issue.number,
      owner: context.repo.owner,
      repo: context.repo.repo,
      body,
    });
  }
};
