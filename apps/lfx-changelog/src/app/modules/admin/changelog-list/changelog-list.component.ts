import { Component, computed, inject, signal, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonComponent } from '@components/button/button.component';
import { CardComponent } from '@components/card/card.component';
import { SelectComponent } from '@components/select/select.component';
import { StatusBadgeComponent } from '@components/status-badge/status-badge.component';
import type { ChangelogEntryWithRelations, Product } from '@lfx-changelog/shared';
import { ChangelogStatus } from '@lfx-changelog/shared';
import { ChangelogService } from '@services/changelog/changelog.service';
import { ProductService } from '@services/product/product.service';
import type { SelectOption } from '@shared/interfaces/form.interface';
import { DateFormatPipe } from '@shared/pipes/date-format/date-format.pipe';
import { ProductNamePipe } from '@shared/pipes/product-name/product-name.pipe';
import { combineLatest, map, startWith, switchMap, tap } from 'rxjs';

@Component({
  selector: 'lfx-changelog-list',
  imports: [ReactiveFormsModule, RouterLink, ButtonComponent, CardComponent, StatusBadgeComponent, SelectComponent, DateFormatPipe, ProductNamePipe],
  templateUrl: './changelog-list.component.html',
  styleUrl: './changelog-list.component.css',
})
export class ChangelogListComponent {
  private readonly changelogService = inject(ChangelogService);
  private readonly productService = inject(ProductService);

  protected readonly productFilterControl = new FormControl('', { nonNullable: true });
  protected readonly statusFilterControl = new FormControl('', { nonNullable: true });

  protected readonly products = toSignal(this.productService.getAll(), { initialValue: [] as Product[] });
  protected readonly loading = signal(true);

  protected readonly productOptions: Signal<SelectOption[]> = this.initProductOptions();
  protected readonly statusOptions: SelectOption[] = [
    { label: 'All Statuses', value: '' },
    { label: 'Published', value: ChangelogStatus.PUBLISHED },
    { label: 'Draft', value: ChangelogStatus.DRAFT },
  ];

  protected readonly filteredEntries: Signal<ChangelogEntryWithRelations[]> = this.initFilteredEntries();

  private initProductOptions(): Signal<SelectOption[]> {
    return computed(() => [{ label: 'All Products', value: '' }, ...this.products().map((p) => ({ label: p.name, value: p.id }))]);
  }

  private initFilteredEntries(): Signal<ChangelogEntryWithRelations[]> {
    return toSignal(
      combineLatest([
        this.productFilterControl.valueChanges.pipe(startWith(this.productFilterControl.value)),
        this.statusFilterControl.valueChanges.pipe(startWith(this.statusFilterControl.value)),
      ]).pipe(
        tap(() => this.loading.set(true)),
        switchMap(([productId, status]) =>
          this.changelogService.getAll({
            ...(productId ? { productId } : {}),
            ...(status ? { status } : {}),
          })
        ),
        map((res) => res.data),
        tap(() => this.loading.set(false))
      ),
      { initialValue: [] }
    );
  }
}
