import { Component, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'lfx-textarea',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: TextareaComponent, multi: true }],
  templateUrl: './textarea.component.html',
  styleUrl: './textarea.component.css',
})
export class TextareaComponent implements ControlValueAccessor {
  public readonly label = input<string>('');
  public readonly rows = input(4);
  public readonly error = input<string>('');
  public readonly placeholder = input<string>('');

  protected readonly value = signal('');
  protected readonly disabled = signal(false);

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
    this.onChange(val);
  }

  protected onBlur(): void {
    this.onTouched();
  }

  private onChange: (value: string) => void = () => {
    void 0;
  };

  private onTouched: () => void = () => {
    void 0;
  };
}
