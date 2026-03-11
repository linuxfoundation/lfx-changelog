// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Pipe, PipeTransform } from '@angular/core';
import { BlogType } from '@lfx-changelog/shared';

@Pipe({
  name: 'blogTypeLabel',
  standalone: true,
})
export class BlogTypeLabelPipe implements PipeTransform {
  public transform(type: string): string {
    switch (type) {
      case BlogType.MONTHLY_ROUNDUP:
        return 'Monthly Roundup';
      case BlogType.PRODUCT_NEWSLETTER:
        return 'Product Newsletter';
      default:
        return type;
    }
  }
}
