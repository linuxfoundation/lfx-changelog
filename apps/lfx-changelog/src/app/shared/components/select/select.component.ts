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

  protected readonly value = signal('');
  protected readonly disabled = signal(false);
  protected readonly isOpen = signal(false);
  protected readonly focusedIndex = signal(-1);

  protected readonly selectedLabel = computed(() => {
    const selected = this.options().find((o) => o.value === this.value());
    return selected?.label ?? '';
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
      const currentIndex = this.options().findIndex((o) => o.value === this.value());
      this.focusedIndex.set(currentIndex);
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
        event.preventDefault();
        if (this.isOpen()) {
          const idx = this.focusedIndex();
          const opts = this.options();
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
          this.focusedIndex.update((i) => Math.min(i + 1, this.options().length - 1));
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

  protected onDocumentClick(event: MouseEvent): void {
    if (!this.elRef.nativeElement.contains(event.target as Node)) {
      if (this.isOpen()) {
        this.isOpen.set(false);
        this.onTouched();
      }
    }
  }

  private onChange: (value: string) => void = () => {
    void 0;
  };

  private onTouched: () => void = () => {
    void 0;
  };
}
