// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { ChatCopy } from '../interfaces/chat.interface';

export const PUBLIC_COPY: ChatCopy = {
  heading: "What's new on LFX?",
  subheading: 'Ask about recent updates, new features, and improvements across the LFX platform — explained in plain language.',
  placeholder: "What's changed recently?",
  prompts: [
    "What's new on LFX this month?",
    'What improvements were made to Security?',
    'Are there any new features for EasyCLA?',
    'Summarize the latest updates for me',
  ],
};

export const ADMIN_COPY: ChatCopy = {
  heading: 'Changelog Assistant',
  subheading: 'Search changelog data, compare releases, and draft release communications across products.',
  placeholder: 'Search changelogs or ask for a summary...',
  prompts: [
    'List all draft changelogs',
    'What changed in PCC over the last 30 days?',
    'Draft release notes for the latest Security update',
    'Compare recent updates across all products',
  ],
};
