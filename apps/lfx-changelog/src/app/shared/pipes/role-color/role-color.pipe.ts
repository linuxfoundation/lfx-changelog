import { Pipe, PipeTransform } from '@angular/core';
import { UserRole } from '@lfx-changelog/shared';

@Pipe({
  name: 'roleColor',
  standalone: true,
})
export class RoleColorPipe implements PipeTransform {
  public transform(role: UserRole): string {
    switch (role) {
      case UserRole.SUPER_ADMIN:
        return '#EF4444';
      case UserRole.PRODUCT_ADMIN:
        return '#3B82F6';
      case UserRole.EDITOR:
        return '#22C55E';
    }
  }
}
