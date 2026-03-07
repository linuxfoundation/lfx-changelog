// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, inject, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonComponent } from '@components/button/button.component';
import { SelectComponent } from '@components/select/select.component';
import { AgentJobService } from '@services/agent-job.service';
import { DialogService } from '@services/dialog.service';
import { ToastService } from '@services/toast.service';

import type { SelectOption } from '@shared/interfaces/form.interface';

@Component({
  selector: 'lfx-trigger-agent-dialog',
  imports: [ReactiveFormsModule, ButtonComponent, SelectComponent],
  templateUrl: './trigger-agent-dialog.component.html',
  styleUrl: './trigger-agent-dialog.component.css',
})
export class TriggerAgentDialogComponent {
  private readonly agentJobService = inject(AgentJobService);
  protected readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);

  public readonly productOptions = input<SelectOption[]>([]);
  public readonly onTriggered = input<() => void>();

  protected readonly productControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  protected readonly triggering = signal(false);
  protected readonly error = signal('');

  protected trigger(): void {
    const productId = this.productControl.value;
    if (!productId) return;

    this.triggering.set(true);
    this.error.set('');

    this.agentJobService.trigger(productId).subscribe({
      next: () => {
        this.triggering.set(false);
        this.toastService.success('Agent job triggered successfully');
        this.onTriggered()?.();
        this.dialogService.close();
      },
      error: () => {
        this.triggering.set(false);
        this.error.set('Failed to trigger agent job. A job may already be running for this product.');
      },
    });
  }
}
