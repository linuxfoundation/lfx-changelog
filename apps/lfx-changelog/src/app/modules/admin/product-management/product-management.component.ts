import { Component, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MOCK_PRODUCTS } from '@lfx-changelog/shared';
import type { Product } from '@lfx-changelog/shared';
import { DateFormatPipe } from '@shared/pipes/date-format/date-format.pipe';
import { ButtonComponent } from '@components/button/button.component';
import { CardComponent } from '@components/card/card.component';
import { DialogComponent } from '@components/dialog/dialog.component';
import { InputComponent } from '@components/input/input.component';
import { TextareaComponent } from '@components/textarea/textarea.component';

@Component({
  selector: 'lfx-product-management',
  imports: [ReactiveFormsModule, ButtonComponent, CardComponent, DialogComponent, InputComponent, TextareaComponent, DateFormatPipe],
  templateUrl: './product-management.component.html',
  styleUrl: './product-management.component.css',
})
export class ProductManagementComponent {
  protected readonly products = MOCK_PRODUCTS;

  protected readonly formNameControl = new FormControl('', { nonNullable: true });
  protected readonly formSlugControl = new FormControl('', { nonNullable: true });
  protected readonly formDescriptionControl = new FormControl('', { nonNullable: true });

  protected readonly dialogVisible = signal(false);
  protected readonly editingProduct = signal<Product | null>(null);

  protected openAdd(): void {
    this.editingProduct.set(null);
    this.formNameControl.setValue('');
    this.formSlugControl.setValue('');
    this.formDescriptionControl.setValue('');
    this.dialogVisible.set(true);
  }

  protected openEdit(product: Product): void {
    this.editingProduct.set(product);
    this.formNameControl.setValue(product.name);
    this.formSlugControl.setValue(product.slug);
    this.formDescriptionControl.setValue(product.description);
    this.dialogVisible.set(true);
  }
}
