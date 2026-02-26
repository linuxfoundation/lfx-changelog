import { Component, computed, type Signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ChangelogStatus, MOCK_CHANGELOG_ENTRIES, MOCK_PRODUCTS } from '@lfx-changelog/shared';
import type { SelectOption } from '@shared/interfaces/form.interface';
import { DateFormatPipe } from '@shared/pipes/date-format/date-format.pipe';
import { ProductNamePipe } from '@shared/pipes/product-name/product-name.pipe';
import { ButtonComponent } from '@components/button/button.component';
import { CardComponent } from '@components/card/card.component';
import { SelectComponent } from '@components/select/select.component';
import { StatusBadgeComponent } from '@components/status-badge/status-badge.component';
import type { ChangelogEntry } from '@lfx-changelog/shared';

@Component({
  selector: 'lfx-changelog-list',
  imports: [ReactiveFormsModule, RouterLink, ButtonComponent, CardComponent, StatusBadgeComponent, SelectComponent, DateFormatPipe, ProductNamePipe],
  templateUrl: './changelog-list.component.html',
  styleUrl: './changelog-list.component.css',
})
export class ChangelogListComponent {
  protected readonly productFilterControl = new FormControl('', { nonNullable: true });
  protected readonly statusFilterControl = new FormControl('', { nonNullable: true });

  protected readonly productOptions: SelectOption[] = [
    { label: 'All Products', value: '' },
    ...MOCK_PRODUCTS.map((p) => ({ label: p.name, value: p.id })),
  ];

  protected readonly statusOptions: SelectOption[] = [
    { label: 'All Statuses', value: '' },
    { label: 'Published', value: ChangelogStatus.PUBLISHED },
    { label: 'Draft', value: ChangelogStatus.DRAFT },
  ];

  protected readonly filteredEntries: Signal<ChangelogEntry[]> = this.initFilteredEntries();

  private initFilteredEntries(): Signal<ChangelogEntry[]> {
    const productFilter = toSignal(this.productFilterControl.valueChanges, { initialValue: this.productFilterControl.value });
    const statusFilter = toSignal(this.statusFilterControl.valueChanges, { initialValue: this.statusFilterControl.value });

    return computed(() => {
      let entries = [...MOCK_CHANGELOG_ENTRIES];

      const prod = productFilter();
      if (prod) entries = entries.filter((e) => e.productId === prod);

      const status = statusFilter();
      if (status) entries = entries.filter((e) => e.status === status);

      return entries.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    });
  }
}
