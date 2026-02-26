import { Component, input } from '@angular/core';

@Component({
  selector: 'lfx-empty-state',
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.css',
})
export class EmptyStateComponent {
  public readonly icon = input<string>('');
  public readonly title = input.required<string>();
  public readonly description = input<string>('');
}
