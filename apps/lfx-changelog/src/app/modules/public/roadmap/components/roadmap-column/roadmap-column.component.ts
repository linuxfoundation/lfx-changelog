// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, computed, input, output, signal } from '@angular/core';
import { ROADMAP_COLUMN_ORDER } from '@lfx-changelog/shared';
import { RoadmapCardComponent } from '../roadmap-card/roadmap-card.component';

import type { RoadmapIdea } from '@lfx-changelog/shared';

const COLUMN_STYLES: Record<string, { border: string; badge: string; icon: string; dot: string }> = {
  Now: {
    border: 'border-t-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    icon: 'fa-duotone fa-bolt',
    dot: 'bg-emerald-500',
  },
  Next: {
    border: 'border-t-blue-500',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    icon: 'fa-duotone fa-arrow-right',
    dot: 'bg-blue-500',
  },
  Later: {
    border: 'border-t-amber-500',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    icon: 'fa-duotone fa-clock',
    dot: 'bg-amber-500',
  },
  Done: {
    border: 'border-t-gray-400',
    badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    icon: 'fa-duotone fa-check',
    dot: 'bg-gray-400',
  },
  "Won't do": {
    border: 'border-t-red-400',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    icon: 'fa-duotone fa-xmark',
    dot: 'bg-red-400',
  },
};

const DEFAULT_STYLE = {
  border: 'border-t-gray-300',
  badge: 'bg-gray-100 text-gray-600',
  icon: 'fa-duotone fa-circle',
  dot: 'bg-gray-300',
};

@Component({
  selector: 'lfx-roadmap-column',
  imports: [RoadmapCardComponent],
  templateUrl: './roadmap-column.component.html',
  styleUrl: './roadmap-column.component.css',
  host: { class: 'min-w-0' },
})
export class RoadmapColumnComponent {
  public readonly columnName = input.required<string>();
  public readonly ideas = input.required<RoadmapIdea[]>();
  public readonly initiallyExpanded = input(false);
  public readonly cardClick = output<string>();

  protected readonly collapsed = signal<boolean | null>(null);
  protected readonly style = computed(() => COLUMN_STYLES[this.columnName()] ?? DEFAULT_STYLE);
  protected readonly sortOrder = computed(() => ROADMAP_COLUMN_ORDER[this.columnName()] ?? 99);

  protected readonly isCollapsed = computed(() => {
    const explicit = this.collapsed();
    if (explicit !== null) return explicit;
    return !this.initiallyExpanded();
  });

  protected toggleCollapse(): void {
    this.collapsed.set(!this.isCollapsed());
  }

  protected onCardClick(jiraKey: string): void {
    this.cardClick.emit(jiraKey);
  }
}
