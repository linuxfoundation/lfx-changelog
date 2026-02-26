import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  ApiResponse,
  ChangelogEntryWithRelations,
  CreateChangelogEntryRequest,
  PaginatedResponse,
  UpdateChangelogEntryRequest,
} from '@lfx-changelog/shared';
import { map, take, type Observable } from 'rxjs';

export interface ChangelogQueryParams {
  productId?: string;
  status?: string;
  page?: number;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class ChangelogService {
  private readonly http = inject(HttpClient);

  public getPublished(params?: ChangelogQueryParams): Observable<PaginatedResponse<ChangelogEntryWithRelations>> {
    return this.http.get<PaginatedResponse<ChangelogEntryWithRelations>>('/public/api/changelogs', { params: this.buildParams(params) });
  }

  public getPublishedById(id: string): Observable<ChangelogEntryWithRelations> {
    return this.http.get<ApiResponse<ChangelogEntryWithRelations>>(`/public/api/changelogs/${id}`).pipe(map((res) => res.data));
  }

  public getAll(params?: ChangelogQueryParams): Observable<PaginatedResponse<ChangelogEntryWithRelations>> {
    return this.http.get<PaginatedResponse<ChangelogEntryWithRelations>>('/api/changelogs', { params: this.buildParams(params) });
  }

  public getById(id: string): Observable<ChangelogEntryWithRelations> {
    return this.http.get<ApiResponse<ChangelogEntryWithRelations>>(`/api/changelogs/${id}`).pipe(map((res) => res.data));
  }

  public create(data: CreateChangelogEntryRequest): Observable<ChangelogEntryWithRelations> {
    return this.http.post<ApiResponse<ChangelogEntryWithRelations>>('/api/changelogs', data).pipe(
      map((res) => res.data),
      take(1)
    );
  }

  public update(id: string, data: UpdateChangelogEntryRequest): Observable<ChangelogEntryWithRelations> {
    return this.http.put<ApiResponse<ChangelogEntryWithRelations>>(`/api/changelogs/${id}`, data).pipe(
      map((res) => res.data),
      take(1)
    );
  }

  public publish(id: string): Observable<ChangelogEntryWithRelations> {
    return this.http.patch<ApiResponse<ChangelogEntryWithRelations>>(`/api/changelogs/${id}/publish`, {}).pipe(
      map((res) => res.data),
      take(1)
    );
  }

  public remove(id: string): Observable<void> {
    return this.http.delete<void>(`/api/changelogs/${id}`).pipe(take(1));
  }

  private buildParams(params?: ChangelogQueryParams): HttpParams {
    let httpParams = new HttpParams();
    if (params?.productId) httpParams = httpParams.set('productId', params.productId);
    if (params?.status) httpParams = httpParams.set('status', params.status);
    if (params?.page) httpParams = httpParams.set('page', params.page.toString());
    if (params?.limit) httpParams = httpParams.set('limit', params.limit.toString());
    return httpParams;
  }
}
