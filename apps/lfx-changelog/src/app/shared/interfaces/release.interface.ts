// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { StoredRelease } from '@lfx-changelog/shared';

/**
 * How a release job reads in the history: a short label, the tone to render it in, and the run
 * it came from. Deliberately not the four stored states — `succeeded` means the image was built
 * and the version bump dispatched, which is not the same as deployed, and `failed` covers a
 * cancelled run that nobody should read as a failure.
 */
export interface ReleaseDeployment {
  label: string;
  /** Semantic token classes for the badge, chosen with the label so the two cannot drift apart. */
  classes: string;
  running: boolean;
  runUrl: string | null;
  workflowName: string | null;
}

/** A stored release with what CI did with its tag, where anything is known. */
export interface ReleaseHistoryRow extends StoredRelease {
  deployment: ReleaseDeployment | null;
}
