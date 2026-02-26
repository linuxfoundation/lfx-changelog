import { DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { CardComponent } from '@components/card/card.component';

import { ProductActivityComponent } from '../product-activity/product-activity.component';

import type { Product } from '@lfx-changelog/shared';

@Component({
  selector: 'lfx-product-overview-tab',
  imports: [DatePipe, CardComponent, ProductActivityComponent],
  templateUrl: './product-overview-tab.component.html',
  styleUrl: './product-overview-tab.component.css',
})
export class ProductOverviewTabComponent {
  public readonly product = input.required<Product>();
  public readonly productId = input.required<string>();
}
