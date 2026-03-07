// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Pipe, PipeTransform } from '@angular/core';
import { format } from 'date-fns';

@Pipe({
  name: 'dateFormat',
  standalone: true,
})
export class DateFormatPipe implements PipeTransform {
  public transform(value: string | null | undefined, dateFormat: string = 'MMM d, yyyy'): string {
    if (!value) return '';
    return format(new Date(value), dateFormat);
  }
}
