// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Pipe, PipeTransform } from '@angular/core';
import { UserRole } from '@lfx-changelog/shared';

@Pipe({
  name: 'roleLabel',
  standalone: true,
})
export class RoleLabelPipe implements PipeTransform {
  public transform(role: UserRole): string {
    switch (role) {
      case UserRole.SUPER_ADMIN:
        return 'Super Admin';
      case UserRole.PRODUCT_ADMIN:
        return 'Product Admin';
      case UserRole.EDITOR:
        return 'Editor';
    }
  }
}
