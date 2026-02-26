import { Component, input } from '@angular/core';
import type { Product } from '@lfx-changelog/shared';

@Component({
  selector: 'lfx-product-pill',
  templateUrl: './product-pill.component.html',
  styleUrl: './product-pill.component.css',
})
export class ProductPillComponent {
  public readonly product = input.required<Product>();
}
