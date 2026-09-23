// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { ReleaseJobStatus, ReleaseJobStepSchema, administeredProductIds, bumpPatchVersion, canAdministerProduct } from '@lfx-changelog/shared';
import { z } from 'zod';

import { ConflictError, GitHubApiError, NotFoundError } from '../errors';
import { serverLogger } from '../server-logger';
import { GitHubService } from './github.service';
import { getPrismaClient } from './prisma.service';

import type {
  CreateReleaseRequest,
  DeploymentType,
  GeneratedReleaseNotes,
  GitHubRelease,
  ReleasableService,
  ReleaseChanges,
  ReleaseJobStep,
  ReleaseTarget,
} from '@lfx-changelog/shared';
import type { ProductRepository as PrismaProductRepository, UserRoleAssignment } from '@prisma/client';
import type { WorkflowJobPayload, WorkflowRunPayload } from '../interfaces/release.interface';

/**
 * Everything a release is: publishing one, the catalog of services that can be released, and the
 * job that follows a published tag through its repository's CI.
 *
 * The first two sections are reached from a request and take the caller's roles — every one of
 * them goes through `requireReleasableRepository` or filters by administered product. The release
 * job section is reached from the GitHub webhook, which has no caller, so those methods
 * authorize nothing and must not be called on a user's behalf without a check in front of them.
 */
export class ReleaseService {
  private readonly githubService = new GitHubService();

  public async getReleaseTarget(repositoryId: string, userRoles: UserRoleAssignment[]): Promise<ReleaseTarget> {
    const repository = await this.requireReleasableRepository(repositoryId, userRoles);

    const [defaultBranch, branches, latest] = await Promise.all([
      this.githubService.getRepositoryDefaultBranch(repository.githubInstallationId, repository.owner, repository.name),
      this.githubService.listBranches(repository.githubInstallationId, repository.owner, repository.name),
      this.findLatestRelease(repository.id),
    ]);

    return {
      repositoryId: repository.id,
      fullName: repository.fullName,
      defaultBranch,
      latestTag: latest?.tagName ?? null,
      latestReleaseUrl: latest?.htmlUrl ?? null,
      suggestedTag: this.suggestNextTag(latest?.tagName ?? null),
      branches,
    };
  }

  public async previewNotes(repositoryId: string, tagName: string, targetCommitish: string, userRoles: UserRoleAssignment[]): Promise<GeneratedReleaseNotes> {
    const repository = await this.requireReleasableRepository(repositoryId, userRoles);
    const previousTagName = (await this.findLatestRelease(repository.id))?.tagName ?? null;

    return this.githubService.generateReleaseNotes(repository.githubInstallationId, repository.owner, repository.name, {
      tagName,
      targetCommitish,
      ...(previousTagName ? { previousTagName } : {}),
    });
  }

  // The release row is not written here — the `release.published` webhook stores it, which keeps
  // a release published from the UI and one published on GitHub itself on the same path. The
  // release job is, because only this path knows who asked for it.
  public async createRelease(repositoryId: string, data: CreateReleaseRequest, userRoles: UserRoleAssignment[], userId: string): Promise<GitHubRelease> {
    const repository = await this.requireReleasableRepository(repositoryId, userRoles);

    // GitHub ignores `target_commitish` when the tag already exists, so it would publish at
    // whatever commit the old tag points to rather than the branch the author chose.
    const exists = await this.githubService.tagExists(repository.githubInstallationId, repository.owner, repository.name, data.tagName);
    if (exists) {
      throw new ConflictError(`Tag already exists: ${data.tagName}`, { operation: 'createRelease', service: 'release' });
    }

    let release: GitHubRelease;
    try {
      release = await this.githubService.createRelease(repository.githubInstallationId, repository.owner, repository.name, data);
    } catch (error) {
      // A tag created between the check above and this call still reaches GitHub, which answers
      // 422. Reported as the same conflict so the race cannot produce a different status.
      if (error instanceof GitHubApiError && error.upstreamStatus === 422 && error.upstreamBody?.includes('already_exists')) {
        throw new ConflictError(`Tag already exists: ${data.tagName}`, { operation: 'createRelease', service: 'release' });
      }
      throw error;
    }

    // Opened here rather than waiting for the release webhook, which cannot know who asked.
    // Failing to open it must not fail the publish: the release exists on GitHub either way, and
    // the webhook opens the job a moment later without the attribution.
    await this.openReleaseJob(repositoryId, data.tagName, userId).catch((err) =>
      serverLogger.warn({ err, repositoryId, tagName: data.tagName }, 'Failed to open release job for published release')
    );

    serverLogger.info({ repositoryId, repo: repository.fullName, tagName: data.tagName, requestedBy: userId }, 'Release published from the admin UI');
    return release;
  }

  /**
   * How much has landed on the chosen target since the newest stored release, for the form to
   * show before publishing. Returns nulls rather than failing when there is nothing to compare.
   */
  public async getChanges(repositoryId: string, targetCommitish: string, userRoles: UserRoleAssignment[]): Promise<ReleaseChanges> {
    const repository = await this.requireReleasableRepository(repositoryId, userRoles);
    const latest = await this.findLatestRelease(repository.id);

    if (!latest) {
      return { previousTag: null, previousReleaseUrl: null, totalCommits: null, compareUrl: null };
    }

    const comparison = await this.githubService.getComparison(
      repository.githubInstallationId,
      repository.owner,
      repository.name,
      latest.tagName,
      targetCommitish
    );

    return {
      previousTag: latest.tagName,
      previousReleaseUrl: latest.htmlUrl,
      totalCommits: comparison.totalCommits,
      compareUrl: comparison.compareUrl,
    };
  }

  /** Pulls the repository's releases from GitHub. Scoped the same way publishing is. */
  public async syncRepository(repositoryId: string, userRoles: UserRoleAssignment[]): Promise<number> {
    const repository = await this.requireReleasableRepository(repositoryId, userRoles);
    return this.githubService.syncReleasesForRepository(repository);
  }

  // ── The catalog of what can be released ─────

  /**
   * Services the caller may release, newest stored tag included so the list can show what each
   * is currently on. Scoped by the product that owns the repository, the same way publishing is,
   * so a product admin sees only their own and the list cannot be used to enumerate the rest.
   */
  public async findReleasable(userRoles: UserRoleAssignment[]): Promise<ReleasableService[]> {
    const prisma = getPrismaClient();
    const productIds = administeredProductIds(userRoles);

    const services = await prisma.releasableService.findMany({
      where: {
        isActive: true,
        ...(productIds && { repository: { productId: { in: productIds } } }),
      },
      include: {
        repository: {
          include: {
            product: { select: { id: true, name: true } },
            releases: {
              where: { isDraft: false },
              orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
              take: 1,
              select: { tagName: true },
            },
          },
        },
      },
      orderBy: { displayName: 'asc' },
    });

    return services.map((service) => ({
      id: service.id,
      repositoryId: service.repositoryId,
      displayName: service.displayName,
      aliases: service.aliases,
      // Prisma generates its own string-literal union for the enum; cast at the boundary,
      // as contributor.service.ts does for ContributorSlackLinkSource.
      deploymentType: service.deploymentType as DeploymentType,
      appName: service.appName,
      argocdRepo: service.argocdRepo,
      environments: service.environments,
      isActive: service.isActive,
      repositoryFullName: service.repository.fullName,
      repositoryHtmlUrl: service.repository.htmlUrl,
      productId: service.repository.product.id,
      productName: service.repository.product.name,
      latestTag: service.repository.releases[0]?.tagName ?? null,
    }));
  }

  // ── Release jobs: what CI did with a published tag ─────

  /**
   * Opens a job for a released tag. Repositories with no active releasable service are ignored —
   * most tracked repositories are not deployable, so there is nothing to follow, and a service
   * that has been retired should stop accruing jobs.
   *
   * Called twice for a release published here: once by the publish endpoint, which knows who
   * asked, and once by the webhook, which does not. Either may arrive first — GitHub dispatches
   * the webhook independently of our own round-trip — so the publish path fills the attribution
   * in whether it created the row or found one. The webhook passes none and so cannot clear it.
   */
  public async openReleaseJob(repositoryId: string, tagName: string, requestedById?: string): Promise<void> {
    const prisma = getPrismaClient();
    const service = await prisma.releasableService.findFirst({ where: { repositoryId, isActive: true }, select: { id: true } });
    if (!service) return;

    await prisma.releaseJob.upsert({
      where: { releasableServiceId_tagName: { releasableServiceId: service.id, tagName } },
      create: { releasableServiceId: service.id, tagName, requestedById: requestedById ?? null },
      update: requestedById ? { requestedById } : {},
    });

    serverLogger.info({ repositoryId, tagName, requestedById: requestedById ?? null }, 'Opened release job for released tag');
  }

  /**
   * Attaches a workflow run to the job for its tag and moves the job to the run's state.
   *
   * The run is matched by `head_branch`, which carries the tag name for a tag-triggered push.
   * A tag with no job and no published release is not one of ours, so ordinary branch and pull
   * request builds pass straight through without inventing a job for them.
   */
  public async recordWorkflowRun(repositoryId: string, run: WorkflowRunPayload): Promise<void> {
    const tagName = run.head_branch;
    // Without a usable id the row would store the string "undefined", which the job lookup then
    // treats as a real run and matches against every other row that stored it.
    if (!tagName || typeof run.id !== 'number') return;

    const prisma = getPrismaClient();
    const releasableServiceId = await this.resolveReleasedTag(repositoryId, tagName);
    if (!releasableServiceId) {
      serverLogger.debug({ repositoryId, tagName, runId: run.id }, 'Workflow run is not for a released tag — ignoring');
      return;
    }

    const workflowRunId = String(run.id);
    const status = this.statusFor(run);
    const isFinished = status === ReleaseJobStatus.SUCCEEDED || status === ReleaseJobStatus.FAILED;
    // GitHub advances this on every state change, so it orders the deliveries for one run.
    const runUpdatedAt = run.updated_at ? new Date(run.updated_at) : new Date();

    const existing = await prisma.releaseJob.findUnique({
      where: { releasableServiceId_tagName: { releasableServiceId, tagName } },
      select: { workflowRunId: true },
    });

    // A different run supersedes this tag's previous one, and the steps recorded against that
    // run are not this one's, so they start again rather than merging by job name across runs.
    // A re-run is not a different run — GitHub reuses the id — so its steps overwrite by name.
    const supersedes = Boolean(existing?.workflowRunId) && existing?.workflowRunId !== workflowRunId;

    const runFields = {
      status,
      workflowRunId,
      runUpdatedAt,
      ...(supersedes ? { steps: [] } : {}),
      workflowRunUrl: run.html_url ?? null,
      workflowName: run.name ?? null,
      conclusion: run.conclusion ?? null,
      startedAt: run.run_started_at ? new Date(run.run_started_at) : null,
      // Taken from the payload so that a redelivery of the same event writes the same row,
      // rather than moving the finish time to whenever the redelivery happened to arrive.
      completedAt: isFinished && run.updated_at ? new Date(run.updated_at) : null,
    };

    // The create branch serves a release this application did not publish and has not yet seen a
    // `published` event for — a manual sync, or an edit to a release created on github.com.
    if (!existing) {
      await prisma.releaseJob.upsert({
        where: { releasableServiceId_tagName: { releasableServiceId, tagName } },
        create: { releasableServiceId, tagName, ...runFields },
        update: {},
      });
      serverLogger.info({ repositoryId, tagName, runId: run.id, status }, 'Opened release job from a workflow run');
      return;
    }

    // Ordering is a condition on the write rather than a check before it. GitHub delivers
    // `in_progress` and `completed` closely enough to be in flight together, so a read followed
    // by an unconditional write would let the earlier delivery land last and report a finished
    // run as still running.
    const { count } = await prisma.releaseJob.updateMany({
      where: {
        releasableServiceId,
        tagName,
        OR: [{ runUpdatedAt: null }, { runUpdatedAt: { lte: runUpdatedAt } }],
      },
      data: runFields,
    });

    if (count === 0) {
      serverLogger.debug({ repositoryId, tagName, runId: run.id, status }, 'Workflow run delivery is older than the recorded state — ignoring');
      return;
    }

    serverLogger.info({ repositoryId, tagName, runId: run.id, status, conclusion: run.conclusion }, 'Recorded workflow run on release job');
  }

  /**
   * Records one job's progress within a run, keyed by name so repeated deliveries overwrite.
   *
   * A repository tracked by several products has a release job per product, and the single run
   * reports to each of them.
   */
  public async recordWorkflowJob(job: WorkflowJobPayload): Promise<void> {
    if (typeof job.run_id !== 'number') return;

    const prisma = getPrismaClient();
    const releaseJobs = await prisma.releaseJob.findMany({
      where: { workflowRunId: String(job.run_id) },
      select: { id: true, steps: true },
    });

    if (releaseJobs.length === 0) {
      serverLogger.debug({ runId: job.run_id, jobName: job.name }, 'Workflow job belongs to no release job — ignoring');
      return;
    }

    const next: ReleaseJobStep = {
      name: job.name,
      status: job.status,
      conclusion: job.conclusion ?? null,
      startedAt: job.started_at ?? null,
      completedAt: job.completed_at ?? null,
    };

    for (const releaseJob of releaseJobs) {
      await prisma.releaseJob.update({
        where: { id: releaseJob.id },
        data: { steps: [...this.parseSteps(releaseJob.id, releaseJob.steps).filter((step) => step.name !== next.name), next] },
      });
    }

    serverLogger.debug({ runId: job.run_id, jobName: job.name, status: job.status, jobs: releaseJobs.length }, 'Recorded workflow job on release job');
  }

  // ── Private helpers ─────────────────────────

  /**
   * The active releasable service whose tag this is, or null when the repository has no active
   * service or the tag is not one we released.
   *
   * An open job counts as evidence on its own: the publish endpoint opens one before GitHub has
   * delivered anything, so a run can reach us while the release row is still in flight.
   */
  private async resolveReleasedTag(repositoryId: string, tagName: string): Promise<string | null> {
    const prisma = getPrismaClient();
    const service = await prisma.releasableService.findFirst({
      where: {
        repositoryId,
        OR: [
          // An open job is followed to the end even if the service is retired while CI is still
          // running — otherwise the delivery that would have finished it is dropped and the job
          // sits at `running` with nothing left to correct it.
          { jobs: { some: { tagName } } },
          // A job is only opened for a service still in service.
          { isActive: true, repository: { releases: { some: { tagName, isDraft: false } } } },
        ],
      },
      select: { id: true },
    });

    return service?.id ?? null;
  }

  /** Reads the stored steps, treating a shape this version cannot read as no steps at all. */
  private parseSteps(releaseJobId: string, steps: unknown): ReleaseJobStep[] {
    const parsed = z.array(ReleaseJobStepSchema).safeParse(steps);
    if (parsed.success) return parsed.data;

    // Loud, because the merge below then rebuilds the list from this one event and whatever was
    // already recorded is gone.
    serverLogger.warn({ releaseJobId, issues: parsed.error.issues }, 'Stored release job steps could not be read — restarting the list');
    return [];
  }

  /**
   * GitHub's conclusions are richer than the four states a job has, so the raw conclusion is kept
   * alongside: anything that completed without succeeding is a failure here, cancellations included.
   */
  private statusFor(run: WorkflowRunPayload): ReleaseJobStatus {
    if (run.status !== 'completed') return ReleaseJobStatus.RUNNING;
    return run.conclusion === 'success' ? ReleaseJobStatus.SUCCEEDED : ReleaseJobStatus.FAILED;
  }

  // A repository outside the caller's products reports 404 rather than 403, so the endpoint
  // cannot be used to discover which repositories exist.
  private async requireReleasableRepository(repositoryId: string, userRoles: UserRoleAssignment[]): Promise<PrismaProductRepository> {
    const prisma = getPrismaClient();
    const repository = await prisma.productRepository.findUnique({ where: { id: repositoryId } });

    if (!repository || !canAdministerProduct(userRoles, repository.productId)) {
      throw new NotFoundError(`Repository not found: ${repositoryId}`, { operation: 'requireReleasableRepository', service: 'release' });
    }

    return repository;
  }

  private async findLatestRelease(repositoryId: string): Promise<{ tagName: string; htmlUrl: string } | null> {
    const prisma = getPrismaClient();
    const latest = await prisma.gitHubRelease.findFirst({
      where: { repositoryId, isDraft: false },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      select: { tagName: true, htmlUrl: true },
    });

    return latest ?? null;
  }

  private suggestNextTag(latestTag: string | null): string {
    const next = bumpPatchVersion(latestTag);
    return latestTag?.trim().toLowerCase().startsWith('v') ? `v${next}` : next;
  }
}
