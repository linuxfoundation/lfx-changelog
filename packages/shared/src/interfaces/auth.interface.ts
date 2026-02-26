import type { User } from './user.interface.js';

export interface AuthContext {
  authenticated: boolean;
  user: AuthUser | null;
  dbUser: User | null;
}

export interface AuthUser {
  sub: string;
  email: string;
  name: string;
  picture: string;
}
