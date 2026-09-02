// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { ButtonComponent } from '@components/button/button.component';
import { AuthService } from '@services/auth.service';
import { ProductService } from '@services/product.service';
import { ReleasableServiceService } from '@services/releasable-service.service';
import { ReleaseJobService } from '@services/release-job.service';
import { ToastService } from '@services/toast.service';
import { BehaviorSubject, catchError, of, switchMap, tap } from 'rxjs';

import type { Product, ReleaseJob, ReleasableService } from '@lfx-changelog/shared';

@Component({
  selector: 'lfx-release-list',
  imports: [RouterLink, ButtonComponent],
  templateUrl: './release-list.component.html',
  styleUrl: './release-list.component.css',
})
export class ReleaseListComponent {
  private readonly releasableService = inject(ReleasableServiceService);
  private readonly releaseJobService = inject(ReleaseJobService);
  private readonly productService = inject(ProductService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);
  private readonly refresh$ = new BehaviorSubject<void>(undefined);

  protected readonly authService = inject(AuthService);
  protected readonly loading = signal(true);
  protected readonly mappingKey = signal<string | null>(null);

  protected readonly services = toSignal(
    this.refresh$.pipe(
      tap(() => this.loading.set(true)),
      switchMap(() => this.releasableService.list().pipe(catchError(() => of([] as ReleasableService[])))),
      tap(() => this.loading.set(false))
    ),
    { initialValue: [] as ReleasableService[] }
  );

  protected readonly jobs = toSignal(
    this.refresh$.pipe(switchMap(() => this.releaseJobService.list({ page: 1, limit: 20 }).pipe(catchError(() => of({ data: [] as ReleaseJob[] }))))),
    { initialValue: { data: [] as ReleaseJob[] } }
  );

  protected readonly products = toSignal(this.productService.getAll().pipe(catchError(() => of([] as Product[]))), {
    initialValue: [] as Product[],
  });

  protected start(service: ReleasableService): void {
    if (service.activeJobId) {
      void this.router.navigate(['/admin/release-jobs', service.activeJobId]);
      return;
    }
    if (service.pendingCount === 0 || !service.canRelease) {
      return;
    }
    void this.router.navigate(['/admin/release-jobs/plan', service.key]);
  }

  protected saveMapping(key: string, productId: string): void {
    this.mappingKey.set(key);
    this.releasableService.updateMapping(key, productId || null).subscribe({
      next: () => {
        this.mappingKey.set(null);
        this.toastService.success('Mapping saved');
        this.refresh$.next();
      },
      error: () => {
        this.mappingKey.set(null);
        this.toastService.error('Could not save mapping');
      },
    });
  }
}
