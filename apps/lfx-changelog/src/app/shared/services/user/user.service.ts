import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { ApiResponse, User, UserRoleAssignment } from '@lfx-changelog/shared';
import { map, take, type Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);

  public getMe(): Observable<User> {
    return this.http.get<ApiResponse<User>>('/api/users/me').pipe(map((res) => res.data));
  }

  public getAll(): Observable<User[]> {
    return this.http.get<ApiResponse<User[]>>('/api/users').pipe(map((res) => res.data));
  }

  public assignRole(userId: string, role: string, productId: string | null): Observable<UserRoleAssignment> {
    return this.http.post<ApiResponse<UserRoleAssignment>>(`/api/users/${userId}/roles`, { role, productId }).pipe(
      map((res) => res.data),
      take(1)
    );
  }

  public removeRole(userId: string, roleId: string): Observable<void> {
    return this.http.delete<void>(`/api/users/${userId}/roles/${roleId}`).pipe(take(1));
  }
}
