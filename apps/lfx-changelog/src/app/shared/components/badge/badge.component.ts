import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'lfx-badge',
  templateUrl: './badge.component.html',
  styleUrl: './badge.component.css',
})
export class BadgeComponent {
  public readonly label = input.required<string>();
  public readonly color = input<string>('#3B82F6');
  public readonly size = input<'sm' | 'md'>('md');

  protected readonly bgStyle = computed(() => {
    const hex = this.color();
    return `background-color: ${hex}1a; color: ${hex};`;
  });
}
