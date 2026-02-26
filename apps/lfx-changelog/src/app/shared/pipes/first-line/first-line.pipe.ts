import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'firstLine' })
export class FirstLinePipe implements PipeTransform {
  public transform(value: string): string {
    return value.split('\n')[0];
  }
}
