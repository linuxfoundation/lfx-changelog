import { Component, input, model } from '@angular/core';
import type { Tab } from '@shared/interfaces/form.interface';

export type { Tab };

@Component({
  selector: 'lfx-tabs',
  templateUrl: './tabs.component.html',
  styleUrl: './tabs.component.css',
})
export class TabsComponent {
  public readonly tabs = input.required<Tab[]>();
  public readonly activeTab = model<string>('');
}
