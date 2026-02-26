import { Pipe, PipeTransform } from '@angular/core';
import { MOCK_PRODUCTS } from '@lfx-changelog/shared';

@Pipe({
  name: 'productName',
  standalone: true,
})
export class ProductNamePipe implements PipeTransform {
  public transform(productId: string | null | undefined): string {
    if (!productId) return 'Global';
    return MOCK_PRODUCTS.find((p) => p.id === productId)?.name ?? 'Unknown';
  }
}
