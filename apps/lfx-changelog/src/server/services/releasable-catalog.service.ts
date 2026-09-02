// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type DeploymentType = 'standalone' | 'platform-subchart';

export interface DeploymentConfig {
  type: DeploymentType;
  appName?: string;
  platformKey?: string;
}

export interface ReleasableServiceConfig {
  key: string;
  displayName: string;
  githubRepo: string;
  ciWorkflow: string;
  argocdRepo: string;
  environments: string[];
  aliases: string[];
  deployment: DeploymentConfig;
  releaseScript: string;
  argocdProductName?: string;
  ciSlackLabel: string;
  ciPlanNote?: string;
  showServiceInPlan: boolean;
}

interface RegistryJson {
  defaults?: {
    github_org?: string;
    argocd_repo?: string;
    ci_workflow?: string;
    environments?: string[];
  };
  services?: Record<
    string,
    {
      display_name: string;
      aliases?: string[];
      github_repo?: string;
      ci_workflow?: string;
      argocd_repo?: string;
      environments?: string[];
      release_script?: string;
      argocd_product_name?: string;
      ci_slack_label?: string;
      ci_plan_note?: string;
      show_service_in_plan?: boolean;
      deployment: {
        type: DeploymentType;
        app_name?: string;
        platform_key?: string;
      };
    }
  >;
}

const CATALOG_FILENAME = 'api_release_services.json';

function resolveCatalogPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, '../config', CATALOG_FILENAME),
    join(process.cwd(), 'src/server/config', CATALOG_FILENAME),
    join(process.cwd(), 'apps/lfx-changelog/src/server/config', CATALOG_FILENAME),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(`${CATALOG_FILENAME} not found. Expected a copy under src/server/config.`);
}

export class ReleasableCatalogService {
  private cached: Map<string, ReleasableServiceConfig> | null = null;

  public list(): ReleasableServiceConfig[] {
    return [...this.load().values()];
  }

  public get(key: string): ReleasableServiceConfig | undefined {
    return this.load().get(key);
  }

  public require(key: string): ReleasableServiceConfig {
    const service = this.get(key);
    if (!service) {
      throw new Error(`Unknown releasable service: ${key}`);
    }
    return service;
  }

  public argocdAppName(service: ReleasableServiceConfig): string {
    return service.deployment.appName || service.deployment.platformKey || service.key;
  }

  public shortName(service: ReleasableServiceConfig): string {
    return service.key.replace(/^lfx-v2-/, '').replace(/-service$/, '');
  }

  private load(): Map<string, ReleasableServiceConfig> {
    if (this.cached) {
      return this.cached;
    }

    const raw = JSON.parse(readFileSync(resolveCatalogPath(), 'utf-8')) as RegistryJson;
    const defaults = raw.defaults ?? {};
    const githubOrg = defaults.github_org ?? 'linuxfoundation';
    const defaultArgocd = defaults.argocd_repo ?? 'linuxfoundation/lfx-v2-argocd';
    const defaultCi = defaults.ci_workflow ?? 'Publish Tagged Release';
    const defaultEnvs = defaults.environments ?? ['staging', 'prod'];

    const services = new Map<string, ReleasableServiceConfig>();
    for (const [key, entry] of Object.entries(raw.services ?? {})) {
      if (entry.deployment.type === 'standalone' && !entry.deployment.app_name) {
        throw new Error(`standalone deployment requires app_name for ${key}`);
      }
      if (entry.deployment.type === 'platform-subchart' && !entry.deployment.platform_key) {
        throw new Error(`platform-subchart deployment requires platform_key for ${key}`);
      }
      services.set(key, {
        key,
        displayName: entry.display_name,
        githubRepo: entry.github_repo ?? `${githubOrg}/${key}`,
        ciWorkflow: entry.ci_workflow ?? defaultCi,
        argocdRepo: entry.argocd_repo ?? defaultArgocd,
        environments: entry.environments ?? defaultEnvs,
        aliases: entry.aliases ?? [],
        deployment: {
          type: entry.deployment.type,
          appName: entry.deployment.app_name,
          platformKey: entry.deployment.platform_key,
        },
        releaseScript: entry.release_script ?? 'api',
        argocdProductName: entry.argocd_product_name,
        ciSlackLabel: entry.ci_slack_label ?? 'CI Build',
        ciPlanNote: entry.ci_plan_note,
        showServiceInPlan: entry.show_service_in_plan ?? true,
      });
    }

    this.cached = services;
    return services;
  }
}

export const releasableCatalogService = new ReleasableCatalogService();
