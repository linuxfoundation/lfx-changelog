// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { NgTemplateOutlet } from '@angular/common';
import { Component, contentChildren, input, output } from '@angular/core';
import { CardComponent } from '@components/card/card.component';
import { PaginationComponent } from '@components/pagination/pagination.component';
import { TableColumnDirective } from './table-column.directive';

@Component({
  selector: 'lfx-table',
  imports: [NgTemplateOutlet, CardComponent, PaginationComponent],
  templateUrl: './table.component.html',
  styleUrl: './table.component.css',
})
export class TableComponent {
  public readonly data = input.required<unknown[]>();
  public readonly emptyMessage = input('No data available.');
  public readonly testId = input('');
  public readonly loading = input(false);

  // Pagination inputs (optional)
  public readonly currentPage = input(0);
  public readonly totalPages = input(0);
  public readonly totalItems = input(0);
  public readonly pageSize = input(20);

  public readonly pageChange = output<number>();

  protected readonly columns = contentChildren(TableColumnDirective);
}
