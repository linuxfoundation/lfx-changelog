import { Injectable, signal } from '@angular/core';
import type { AuthUser, User } from '@lfx-changelog/shared';

@Injectable({ providedIn: 'root' })
export class AuthService {
  public readonly authenticated = signal(false);
  public readonly user = signal<AuthUser | null>(null);
  public readonly dbUser = signal<User | null>(null);
}
