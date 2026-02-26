import { Component, input, output } from '@angular/core';

@Component({
  selector: 'lfx-button',
  templateUrl: './button.component.html',
  styleUrl: './button.component.css',
})
export class ButtonComponent {
  public readonly variant = input<'primary' | 'secondary' | 'ghost' | 'danger'>('primary');
  public readonly size = input<'sm' | 'md' | 'lg'>('md');
  public readonly loading = input(false);
  public readonly disabled = input(false);
  public readonly type = input<'button' | 'submit'>('button');
  public readonly clicked = output<MouseEvent>();
}
