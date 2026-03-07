// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { HttpClient, HttpResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, take } from 'rxjs';

import type { ApiKey, ApiResponse, CreateApiKeyRequest, CreateApiKeyResponse } from '@lfx-changelog/shared';
import type { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiKeyService {
  private readonly http = inject(HttpClient);

  public getAll(): Observable<ApiKey[]> {
    return this.http.get<ApiResponse<ApiKey[]>>('/api/api-keys').pipe(map((res) => res.data));
  }

  public create(data: CreateApiKeyRequest): Observable<CreateApiKeyResponse> {
    return this.http.post<ApiResponse<CreateApiKeyResponse>>('/api/api-keys', data).pipe(
      map((res) => res.data),
      take(1)
    );
  }

  public revoke(id: string): Observable<HttpResponse<unknown>> {
    return this.http.delete(`/api/api-keys/${id}`, { observe: 'response' }).pipe(take(1));
  }
}
