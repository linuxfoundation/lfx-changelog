// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export type Toast = { id: number; type: ToastType; message: string };
