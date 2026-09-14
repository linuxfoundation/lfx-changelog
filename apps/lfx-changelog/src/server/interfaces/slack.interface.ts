// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

/** Raw member shape returned by Slack's `users.list` (only the fields we consume). */
export interface SlackMember {
  id: string;
  team_id?: string;
  name: string;
  real_name?: string;
  deleted?: boolean;
  is_bot?: boolean;
  profile?: {
    real_name?: string;
    display_name?: string;
    email?: string;
    image_72?: string;
    image_192?: string;
  };
}
