// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { HttpClient, HttpResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, take, type Observable } from 'rxjs';

import type { ApiResponse, CreateUserRequest, User, UserRoleAssignment } from '@lfx-changelog/shared';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);

  public getMe(): Observable<User> {
    return this.http.get<ApiResponse<User>>('/api/users/me').pipe(map((res) => res.data));
  }

  public getAll(): Observable<User[]> {
    return this.http.get<ApiResponse<User[]>>('/api/users').pipe(map((res) => res.data));
  }

  public create(data: CreateUserRequest): Observable<User> {
    return this.http.post<ApiResponse<User>>('/api/users', data).pipe(
      map((res) => res.data),
      take(1)
    );
  }

  public assignRole(userId: string, role: string, productId: string | null): Observable<UserRoleAssignment> {
    return this.http.post<ApiResponse<UserRoleAssignment>>(`/api/users/${userId}/roles`, { role, productId }).pipe(
      map((res) => res.data),
      take(1)
    );
  }

  public removeRole(userId: string, roleId: string): Observable<HttpResponse<unknown>> {
    return this.http.delete(`/api/users/${userId}/roles/${roleId}`, { observe: 'response' }).pipe(take(1));
  }
}
