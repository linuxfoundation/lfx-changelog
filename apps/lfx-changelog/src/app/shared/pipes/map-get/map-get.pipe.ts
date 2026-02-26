import { Pipe, type PipeTransform } from '@angular/core';

@Pipe({ name: 'mapGet' })
export class MapGetPipe implements PipeTransform {
  public transform(map: Map<string, boolean>, key: string): boolean {
    return map.get(key) ?? false;
  }
}
