// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, input, model, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonComponent } from '@components/button/button.component';
import { SelectComponent } from '@components/select/select.component';
import { TabsComponent } from '@components/tabs/tabs.component';
import { AgentJobService } from '@services/agent-job.service';
import { DialogService } from '@services/dialog.service';
import { ToastService } from '@services/toast.service';

import type { SelectOption, Tab } from '@shared/interfaces/form.interface';

const AGENT_TABS: Tab[] = [
  { label: 'Changelog', value: 'changelog' },
  { label: 'Blog', value: 'blog' },
];

@Component({
  selector: 'lfx-trigger-agent-dialog',
  imports: [ReactiveFormsModule, ButtonComponent, SelectComponent, TabsComponent],
  templateUrl: './trigger-agent-dialog.component.html',
  styleUrl: './trigger-agent-dialog.component.css',
})
export class TriggerAgentDialogComponent {
  private readonly agentJobService = inject(AgentJobService);
  protected readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  public readonly productOptions = input<SelectOption[]>([]);
  public readonly onTriggered = input<() => void>();

  protected readonly agentTabs = AGENT_TABS;
  protected readonly activeTab = model('changelog');

  private readonly defaultPeriod = TriggerAgentDialogComponent.computeDefaultPeriod();

  protected readonly productControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  protected readonly monthControl = new FormControl(this.defaultPeriod.month, { nonNullable: true, validators: [Validators.required] });
  protected readonly yearControl = new FormControl(this.defaultPeriod.year, { nonNullable: true, validators: [Validators.required] });

  protected readonly monthOptions: SelectOption[] = [
    { label: 'January', value: '1' },
    { label: 'February', value: '2' },
    { label: 'March', value: '3' },
    { label: 'April', value: '4' },
    { label: 'May', value: '5' },
    { label: 'June', value: '6' },
    { label: 'July', value: '7' },
    { label: 'August', value: '8' },
    { label: 'September', value: '9' },
    { label: 'October', value: '10' },
    { label: 'November', value: '11' },
    { label: 'December', value: '12' },
  ];
  protected readonly yearOptions: SelectOption[] = this.initYearOptions();

  protected readonly triggering = signal(false);
  protected readonly error = signal('');
  protected readonly isDisabled = this.initIsDisabled();

  public constructor() {
    // Update dialog title when tab changes
    toObservable(this.activeTab)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((tab) => {
        this.dialogService.updateTitle(tab === 'changelog' ? 'Run Changelog Agent' : 'Run Blog Agent');
        this.error.set('');
      });
  }

  protected trigger(): void {
    this.triggering.set(true);
    this.error.set('');

    if (this.activeTab() === 'changelog') {
      this.triggerChangelog();
    } else {
      this.triggerBlog();
    }
  }

  private triggerChangelog(): void {
    const productId = this.productControl.value;
    if (!productId) return;

    this.agentJobService.trigger(productId).subscribe({
      next: () => {
        this.triggering.set(false);
        this.toastService.success('Agent job triggered successfully');
        this.onTriggered()?.();
        this.dialogService.close();
      },
      error: (err: HttpErrorResponse) => {
        this.triggering.set(false);
        this.error.set(err.error?.error || 'Failed to trigger agent job.');
      },
    });
  }

  private triggerBlog(): void {
    const year = parseInt(this.yearControl.value, 10);
    const month = parseInt(this.monthControl.value, 10);

    this.agentJobService.triggerBlog('monthly', { year, month }).subscribe({
      next: () => {
        this.triggering.set(false);
        this.toastService.success('Blog agent job triggered successfully');
        this.onTriggered()?.();
        this.dialogService.close();
      },
      error: (err: HttpErrorResponse) => {
        this.triggering.set(false);
        this.error.set(err.error?.error || 'Failed to trigger blog agent job.');
      },
    });
  }

  private initIsDisabled() {
    const productValue = toSignal(this.productControl.valueChanges, { initialValue: this.productControl.value });
    const monthValue = toSignal(this.monthControl.valueChanges, { initialValue: this.monthControl.value });
    const yearValue = toSignal(this.yearControl.valueChanges, { initialValue: this.yearControl.value });
    return computed(() => {
      if (this.activeTab() === 'changelog') {
        return !productValue();
      }
      return !monthValue() || !yearValue();
    });
  }

  private initYearOptions(): SelectOption[] {
    const currentYear = new Date().getFullYear();
    const options: SelectOption[] = [];
    for (let y = currentYear; y >= 2024; y--) {
      options.push({ label: String(y), value: String(y) });
    }
    return options;
  }

  private static computeDefaultPeriod(): { month: string; year: string } {
    const now = new Date();
    const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    return { month: String(prev.getUTCMonth() + 1), year: String(prev.getUTCFullYear()) };
  }
}
