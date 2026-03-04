// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, computed, ElementRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import type { SelectOption } from '@shared/interfaces/form.interface';

export type { SelectOption };

@Component({
  selector: 'lfx-select',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: SelectComponent, multi: true }],
  host: {
    '(document:click)': 'onDocumentClick($event)',
  },
  templateUrl: './select.component.html',
  styleUrl: './select.component.css',
})
export class SelectComponent implements ControlValueAccessor {
  private readonly elRef = inject(ElementRef);

  public readonly label = input<string>('');
  public readonly options = input<SelectOption[]>([]);
  public readonly error = input<string>('');
  public readonly placeholder = input<string>('Select...');
  public readonly searchable = input(false);

  protected readonly value = signal('');
  protected readonly disabled = signal(false);
  protected readonly isOpen = signal(false);
  protected readonly focusedIndex = signal(-1);
  protected readonly searchQuery = signal('');
  protected readonly triggerWidth = signal(0);

  protected readonly selectedLabel = computed(() => {
    const selected = this.options().find((o) => o.value === this.value());
    return selected?.label ?? '';
  });

  protected readonly filteredOptions = computed(() => {
    const query = this.searchQuery().toLowerCase();
    if (!query) return this.options();
    return this.options().filter((o) => o.label.toLowerCase().includes(query));
  });

  public writeValue(value: string): void {
    this.value.set(value ?? '');
  }

  public registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  public setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected toggle(): void {
    if (this.disabled()) return;
    this.isOpen.update((v) => !v);
    if (this.isOpen()) {
      this.searchQuery.set('');
      const currentIndex = this.filteredOptions().findIndex((o) => o.value === this.value());
      this.focusedIndex.set(currentIndex);
      this.updateDropdownPosition();
    }
  }

  protected selectOption(option: SelectOption): void {
    this.value.set(option.value);
    this.onChange(option.value);
    this.isOpen.set(false);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (this.disabled()) return;

    switch (event.key) {
      case 'Enter':
      case ' ':
        // Allow space in search input
        if (event.key === ' ' && event.target instanceof HTMLInputElement) {
          return;
        }
        event.preventDefault();
        if (this.isOpen()) {
          const idx = this.focusedIndex();
          const opts = this.filteredOptions();
          if (idx >= 0 && idx < opts.length) {
            this.selectOption(opts[idx]!);
          }
        } else {
          this.toggle();
        }
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (!this.isOpen()) {
          this.toggle();
        } else {
          this.focusedIndex.update((i) => Math.min(i + 1, this.filteredOptions().length - 1));
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (this.isOpen()) {
          this.focusedIndex.update((i) => Math.max(i - 1, 0));
        }
        break;
      case 'Escape':
        event.preventDefault();
        this.isOpen.set(false);
        break;
    }
  }

  protected onSearchInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.searchQuery.set(val);
    this.focusedIndex.set(0);
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (!this.elRef.nativeElement.contains(event.target as Node)) {
      if (this.isOpen()) {
        this.isOpen.set(false);
        this.onTouched();
      }
    }
  }

  private updateDropdownPosition(): void {
    const trigger = this.elRef.nativeElement.querySelector('button');
    if (!trigger) return;
    this.triggerWidth.set(trigger.getBoundingClientRect().width);
  }

  private onChange: (value: string) => void = () => {
    void 0;
  };

  private onTouched: () => void = () => {
    void 0;
  };
}
