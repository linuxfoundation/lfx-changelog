// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Pipe, PipeTransform } from '@angular/core';
import { ChangelogCategory } from '@lfx-changelog/shared';

@Pipe({
  name: 'categoryColor',
  standalone: true,
})
export class CategoryColorPipe implements PipeTransform {
  public transform(value: ChangelogCategory | string | null | undefined): string {
    switch (value) {
      case ChangelogCategory.FEATURE:
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      case ChangelogCategory.BUGFIX:
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case ChangelogCategory.IMPROVEMENT:
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case ChangelogCategory.SECURITY:
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case ChangelogCategory.DEPRECATION:
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
      case ChangelogCategory.BREAKING_CHANGE:
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      case ChangelogCategory.OTHER:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
      default:
        return '';
    }
  }
}
