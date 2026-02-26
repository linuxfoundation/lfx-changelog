// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { CardComponent } from '@components/card/card.component';

import { ProductActivityComponent } from '../product-activity/product-activity.component';
import { ProductChangelogsComponent } from '../product-changelogs/product-changelogs.component';

import type { Product } from '@lfx-changelog/shared';

@Component({
  selector: 'lfx-product-overview-tab',
  imports: [DatePipe, CardComponent, ProductActivityComponent, ProductChangelogsComponent],
  templateUrl: './product-overview-tab.component.html',
  styleUrl: './product-overview-tab.component.css',
})
export class ProductOverviewTabComponent {
  public readonly product = input.required<Product>();
  public readonly productId = input.required<string>();
}
