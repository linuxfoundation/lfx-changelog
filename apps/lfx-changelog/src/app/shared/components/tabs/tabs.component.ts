import { Component, ElementRef, afterNextRender, input, model, signal, viewChildren } from '@angular/core';
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

  public readonly tabButtons = viewChildren<ElementRef<HTMLButtonElement>>('tabBtn');
  public readonly indicatorLeft = signal(0);
  public readonly indicatorWidth = signal(0);
  public readonly indicatorReady = signal(false);

  public constructor() {
    afterNextRender(() => {
      this.measureActiveTab();
      this.indicatorReady.set(true);
    });
  }

  public selectTab(value: string): void {
    this.activeTab.set(value);
    requestAnimationFrame(() => this.measureActiveTab());
  }

  private measureActiveTab(): void {
    const allTabs = this.tabs();
    const buttons = this.tabButtons();
    const index = allTabs.findIndex(t => t.value === this.activeTab());
    if (index >= 0 && buttons[index]) {
      const el = buttons[index].nativeElement;
      this.indicatorLeft.set(el.offsetLeft);
      this.indicatorWidth.set(el.offsetWidth);
    }
  }
}
