// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, computed, DestroyRef, inject, signal, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonComponent } from '@components/button/button.component';
import { TabsComponent } from '@components/tabs/tabs.component';
import { ProductService } from '@services/product/product.service';
import { catchError, filter, first, map, of, startWith, switchMap } from 'rxjs';

import { ProductOverviewTabComponent } from './product-overview-tab/product-overview-tab.component';
import { ProductRepositoriesTabComponent } from './product-repositories-tab/product-repositories-tab.component';

import type { Product } from '@lfx-changelog/shared';
import type { Tab } from '@shared/interfaces/form.interface';
import type { LoadingState } from '@shared/interfaces/loading-state.interface';

const TABS: Tab[] = [
  { label: 'Overview', value: 'overview' },
  { label: 'Repositories', value: 'repositories' },
];

@Component({
  selector: 'lfx-product-detail',
  imports: [ButtonComponent, TabsComponent, ProductOverviewTabComponent, ProductRepositoriesTabComponent],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.css',
})
export class ProductDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly productService = inject(ProductService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly tabs = TABS;
  protected readonly activeTab = signal('overview');
  protected readonly callbackInstallationId = signal<string | null>(null);

  protected readonly productId = toSignal(this.route.paramMap.pipe(map((params) => params.get('id') || '')), { initialValue: '' });

  private readonly productState: Signal<LoadingState<Product | null>> = this.initProductState();
  protected readonly product = computed(() => this.productState().data);
  protected readonly loading = computed(() => this.productState().loading);

  public constructor() {
    this.route.queryParamMap
      .pipe(
        first(),
        filter((params) => params.has('tab'))
      )
      .subscribe((params) => {
        const tab = params.get('tab');
        if (tab === 'repositories' || tab === 'overview') {
          this.activeTab.set(tab);
        }
        const installationId = params.get('installation_id');
        if (installationId) {
          this.callbackInstallationId.set(installationId);
        }
      });
  }

  protected goBack(): void {
    this.router.navigate(['/admin/products']);
  }

  private initProductState(): Signal<LoadingState<Product | null>> {
    return toSignal(
      this.route.paramMap.pipe(
        map((params) => params.get('id') || ''),
        filter((id) => id.length > 0),
        switchMap((id) =>
          this.productService.getById(id).pipe(
            map((product) => ({ data: product, loading: false })),
            catchError(() => of({ data: null as Product | null, loading: false })),
            startWith({ data: null as Product | null, loading: true })
          )
        )
      ),
      { initialValue: { data: null, loading: true } }
    );
  }
}
