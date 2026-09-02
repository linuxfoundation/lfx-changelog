// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonComponent } from '@components/button/button.component';
import { ReleasableServiceService } from '@services/releasable-service.service';
import { ReleaseJobService } from '@services/release-job.service';
import { ToastService } from '@services/toast.service';

import type { ReleasePlan } from '@lfx-changelog/shared';

@Component({
  selector: 'lfx-release-plan',
  imports: [FormsModule, RouterLink, ButtonComponent],
  templateUrl: './release-plan.component.html',
  styleUrl: './release-plan.component.css',
})
export class ReleasePlanComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly releasableService = inject(ReleasableServiceService);
  private readonly releaseJobService = inject(ReleaseJobService);
  private readonly toastService = inject(ToastService);

  protected readonly loading = signal(true);
  protected readonly generating = signal(false);
  protected readonly confirming = signal(false);
  protected readonly plan = signal<ReleasePlan | null>(null);
  protected notes = '';

  public constructor() {
    const key = this.route.snapshot.paramMap.get('key');
    if (!key) {
      void this.router.navigate(['/admin/release-jobs']);
      return;
    }
    this.releasableService.plan(key).subscribe({
      next: (plan) => {
        this.plan.set(plan);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        if (error instanceof HttpErrorResponse && error.status === 409 && error.error?.data?.jobId) {
          void this.router.navigate(['/admin/release-jobs', error.error.data.jobId]);
          return;
        }
        this.toastService.error('Could not load the release plan');
        void this.router.navigate(['/admin/release-jobs']);
      },
    });
  }

  protected generateNotes(): void {
    const plan = this.plan();
    if (!plan) return;
    this.generating.set(true);
    this.releasableService.generateNotes(plan.service.key).subscribe({
      next: (notes) => {
        this.notes = notes;
        this.generating.set(false);
      },
      error: () => {
        this.generating.set(false);
        this.toastService.error('Could not generate notes');
      },
    });
  }

  protected confirm(): void {
    const plan = this.plan();
    if (!plan || !this.notes.trim() || this.confirming()) return;
    this.confirming.set(true);
    this.releaseJobService.start(plan.service.key, this.notes.trim(), plan.newTag).subscribe({
      next: (job) => {
        void this.router.navigate(['/admin/release-jobs', job.id]);
      },
      error: (error: unknown) => {
        this.confirming.set(false);
        if (error instanceof HttpErrorResponse && error.status === 409 && error.error?.data?.jobId) {
          void this.router.navigate(['/admin/release-jobs', error.error.data.jobId]);
          return;
        }
        this.toastService.error('Could not start the release');
      },
    });
  }

  protected cancel(): void {
    void this.router.navigate(['/admin/release-jobs']);
  }
}
