// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Pipe, PipeTransform } from '@angular/core';
import type { Product } from '@lfx-changelog/shared';

@Pipe({
  name: 'productName',
  standalone: true,
})
export class ProductNamePipe implements PipeTransform {
  public transform(productId: string | null | undefined, products: Product[] = []): string {
    if (!productId) return 'Global';
    return products.find((p) => p.id === productId)?.name ?? 'Unknown';
  }
}
