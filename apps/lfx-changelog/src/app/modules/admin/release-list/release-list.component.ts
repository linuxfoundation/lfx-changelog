// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
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
  imports: [ReactiveFormsModule, RouterLink, ButtonComponent],
  templateUrl: './release-list.component.html',
  styleUrl: './release-list.component.css',
})
export class ReleaseListComponent {
  private readonly releasableService = inject(ReleasableServiceService);
  private readonly releaseJobService = inject(ReleaseJobService);
  private readonly productService = inject(ProductService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly refresh$ = new BehaviorSubject<void>(undefined);
  private readonly mappingControlsCache = new Map<string, FormControl<string>>();

  protected readonly authService = inject(AuthService);
  protected readonly loading = signal(true);

  protected readonly services = this.initServices();
  protected readonly jobs = this.initJobs();
  protected readonly products = this.initProducts();
  protected readonly serviceRows = this.initServiceRows();

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
    const control = this.mappingControlsCache.get(key);
    control?.disable({ emitEvent: false });
    this.releasableService.updateMapping(key, productId || null).subscribe({
      next: () => {
        control?.enable({ emitEvent: false });
        this.toastService.success('Mapping saved');
        this.refresh$.next();
      },
      error: () => {
        control?.enable({ emitEvent: false });
        this.toastService.error('Could not save mapping');
      },
    });
  }

  private initServices() {
    return toSignal(
      this.refresh$.pipe(
        tap(() => this.loading.set(true)),
        switchMap(() => this.releasableService.list().pipe(catchError(() => of([] as ReleasableService[])))),
        tap(() => this.loading.set(false))
      ),
      { initialValue: [] as ReleasableService[] }
    );
  }

  private initJobs() {
    return toSignal(
      this.refresh$.pipe(switchMap(() => this.releaseJobService.list({ page: 1, limit: 20 }).pipe(catchError(() => of({ data: [] as ReleaseJob[] }))))),
      { initialValue: { data: [] as ReleaseJob[] } }
    );
  }

  private initProducts() {
    return toSignal(this.productService.getAll().pipe(catchError(() => of([] as Product[]))), {
      initialValue: [] as Product[],
    });
  }

  private initServiceRows() {
    return computed(() =>
      this.services().map((service) => ({
        service,
        environmentsLabel: service.environments.join(', '),
        mappingControl: this.mappingControlFor(service),
      }))
    );
  }

  private mappingControlFor(service: ReleasableService): FormControl<string> {
    const cached = this.mappingControlsCache.get(service.key);
    if (cached) {
      if (!cached.dirty) {
        cached.setValue(service.productId ?? '', { emitEvent: false });
      }
      return cached;
    }
    const control = new FormControl(service.productId ?? '', { nonNullable: true });
    control.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => this.saveMapping(service.key, value));
    this.mappingControlsCache.set(service.key, control);
    return control;
  }
}
