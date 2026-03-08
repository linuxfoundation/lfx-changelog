// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Pipe, PipeTransform } from '@angular/core';
import { ChangelogCategory } from '@lfx-changelog/shared';

@Pipe({
  name: 'categoryLabel',
  standalone: true,
})
export class CategoryLabelPipe implements PipeTransform {
  public transform(value: ChangelogCategory | string | null | undefined): string {
    switch (value) {
      case ChangelogCategory.FEATURE:
        return 'Feature';
      case ChangelogCategory.BUGFIX:
        return 'Bug Fix';
      case ChangelogCategory.IMPROVEMENT:
        return 'Improvement';
      case ChangelogCategory.SECURITY:
        return 'Security';
      case ChangelogCategory.DEPRECATION:
        return 'Deprecation';
      case ChangelogCategory.BREAKING_CHANGE:
        return 'Breaking Change';
      case ChangelogCategory.OTHER:
        return 'Other';
      default:
        return '';
    }
  }
}
