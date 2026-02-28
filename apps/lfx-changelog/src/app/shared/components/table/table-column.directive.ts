// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Directive, inject, input, TemplateRef } from '@angular/core';

@Directive({
  selector: 'ng-template[lfxColumn]',
})
export class TableColumnDirective {
  public readonly lfxColumn = input.required<string>();
  public readonly lfxColumnHeaderClass = input('');
  public readonly lfxColumnCellClass = input('');

  public readonly templateRef = inject(TemplateRef);
}
