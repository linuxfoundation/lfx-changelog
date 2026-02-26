// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, ElementRef, input, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

interface ToolbarAction {
  icon: string;
  title: string;
  action: () => void;
  shortcutLabel?: string;
}

@Component({
  selector: 'lfx-markdown-editor',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: MarkdownEditorComponent, multi: true }],
  templateUrl: './markdown-editor.component.html',
  styleUrl: './markdown-editor.component.css',
})
export class MarkdownEditorComponent implements ControlValueAccessor {
  public readonly label = input<string>('');
  public readonly rows = input(4);
  public readonly error = input<string>('');
  public readonly placeholder = input<string>('');

  protected readonly value = signal('');
  protected readonly disabled = signal(false);

  protected readonly textareaEl = viewChild<ElementRef<HTMLTextAreaElement>>('textareaEl');

  protected readonly toolbarGroups: ToolbarAction[][] = [
    [
      { icon: 'fa-solid fa-bold', title: 'Bold (Ctrl+B)', action: () => this.insertWrap('**', '**', 'bold text'), shortcutLabel: 'B' },
      { icon: 'fa-solid fa-italic', title: 'Italic (Ctrl+I)', action: () => this.insertWrap('*', '*', 'italic text'), shortcutLabel: 'I' },
    ],
    [
      { icon: 'fa-solid fa-heading', title: 'Heading', action: () => this.insertLinePrefix('## ') },
      { icon: 'fa-solid fa-list-ul', title: 'Bulleted List', action: () => this.insertLinePrefix('- ') },
      { icon: 'fa-solid fa-list-ol', title: 'Numbered List', action: () => this.insertLinePrefix('1. ') },
    ],
    [
      { icon: 'fa-solid fa-link', title: 'Link (Ctrl+K)', action: () => this.insertLink(), shortcutLabel: 'K' },
      { icon: 'fa-solid fa-code', title: 'Inline Code', action: () => this.insertWrap('`', '`', 'code') },
      { icon: 'fa-solid fa-rectangle-code', title: 'Code Block', action: () => this.insertWrap('\n```\n', '\n```\n', 'code block') },
    ],
    [{ icon: 'fa-solid fa-minus', title: 'Horizontal Rule', action: () => this.insertBlock('\n---\n') }],
  ];
  private onChange?: (value: string) => void;
  private onTouched?: () => void;

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

  protected onInput(event: Event): void {
    const val = (event.target as HTMLTextAreaElement).value;
    this.value.set(val);
    this.onChange?.(val);
  }

  protected onBlur(): void {
    this.onTouched?.();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!(event.ctrlKey || event.metaKey)) return;

    switch (event.key.toLowerCase()) {
      case 'b':
        event.preventDefault();
        this.insertWrap('**', '**', 'bold text');
        break;
      case 'i':
        event.preventDefault();
        this.insertWrap('*', '*', 'italic text');
        break;
      case 'k':
        event.preventDefault();
        this.insertLink();
        break;
    }
  }

  private insertWrap(prefix: string, suffix: string, placeholder: string): void {
    const textarea = this.textareaEl()?.nativeElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = this.value();
    const selected = text.substring(start, end);
    const insert = selected || placeholder;
    const newText = text.substring(0, start) + prefix + insert + suffix + text.substring(end);

    this.updateValue(newText);

    const cursorStart = start + prefix.length;
    const cursorEnd = cursorStart + insert.length;
    this.restoreCursor(textarea, cursorStart, cursorEnd);
  }

  private insertLinePrefix(prefix: string): void {
    const textarea = this.textareaEl()?.nativeElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const text = this.value();

    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const newText = text.substring(0, lineStart) + prefix + text.substring(lineStart);

    this.updateValue(newText);
    this.restoreCursor(textarea, start + prefix.length, start + prefix.length);
  }

  private insertLink(): void {
    const textarea = this.textareaEl()?.nativeElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = this.value();
    const selected = text.substring(start, end);

    if (selected) {
      const insert = `[${selected}](url)`;
      const newText = text.substring(0, start) + insert + text.substring(end);
      this.updateValue(newText);
      const urlStart = start + selected.length + 3;
      this.restoreCursor(textarea, urlStart, urlStart + 3);
    } else {
      const insert = '[link text](url)';
      const newText = text.substring(0, start) + insert + text.substring(end);
      this.updateValue(newText);
      this.restoreCursor(textarea, start + 1, start + 10);
    }
  }

  private insertBlock(block: string): void {
    const textarea = this.textareaEl()?.nativeElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const text = this.value();
    const newText = text.substring(0, start) + block + text.substring(start);

    this.updateValue(newText);
    this.restoreCursor(textarea, start + block.length, start + block.length);
  }

  private updateValue(newText: string): void {
    this.value.set(newText);
    this.onChange?.(newText);
  }

  private restoreCursor(textarea: HTMLTextAreaElement, start: number, end: number): void {
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start, end);
    });
  }
}
