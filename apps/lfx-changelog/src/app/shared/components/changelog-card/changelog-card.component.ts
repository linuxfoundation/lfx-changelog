// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CardComponent } from '@components/card/card.component';
import { ProductPillComponent } from '@components/product-pill/product-pill.component';
import type { ChangelogEntryWithRelations, Product } from '@lfx-changelog/shared';
import { format } from 'date-fns';

@Component({
  selector: 'lfx-changelog-card',
  imports: [CardComponent, ProductPillComponent, RouterLink],
  templateUrl: './changelog-card.component.html',
  styleUrl: './changelog-card.component.css',
})
export class ChangelogCardComponent {
  public readonly entry = input.required<ChangelogEntryWithRelations>();

  protected readonly product = computed<Product | undefined>(() => this.entry().product);

  protected readonly formattedDate = computed(() => {
    const date = this.entry().publishedAt ?? this.entry().createdAt;
    return format(new Date(date), 'MMM d, yyyy');
  });

  protected readonly preview = computed(() => {
    const desc = this.entry().description;
    const plain = desc.replace(/[#*_`[\]]/g, '');
    return plain.length > 200 ? plain.slice(0, 200) + '...' : plain;
  });
}
