// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, take } from 'rxjs';

import type {
  ApiResponse,
  BlogPostQueryParams,
  BlogPostWithRelations,
  CreateBlogPostRequest,
  PaginatedResponse,
  UpdateBlogPostRequest,
} from '@lfx-changelog/shared';
import type { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class BlogService {
  private readonly http = inject(HttpClient);

  public getPublished(params?: BlogPostQueryParams): Observable<PaginatedResponse<BlogPostWithRelations>> {
    return this.http.get<PaginatedResponse<BlogPostWithRelations>>('/public/api/blog', { params: this.buildParams(params) });
  }

  public getPublishedBySlug(slug: string): Observable<BlogPostWithRelations> {
    return this.http.get<ApiResponse<BlogPostWithRelations>>(`/public/api/blog/${slug}`).pipe(map((res) => res.data));
  }

  public getAll(params?: BlogPostQueryParams): Observable<PaginatedResponse<BlogPostWithRelations>> {
    return this.http.get<PaginatedResponse<BlogPostWithRelations>>('/api/blogs', { params: this.buildParams(params) });
  }

  public getById(id: string): Observable<BlogPostWithRelations> {
    return this.http.get<ApiResponse<BlogPostWithRelations>>(`/api/blogs/${id}`).pipe(map((res) => res.data));
  }

  public create(data: CreateBlogPostRequest): Observable<BlogPostWithRelations> {
    return this.http.post<ApiResponse<BlogPostWithRelations>>('/api/blogs', data).pipe(
      map((res) => res.data),
      take(1)
    );
  }

  public update(id: string, data: UpdateBlogPostRequest): Observable<BlogPostWithRelations> {
    return this.http.put<ApiResponse<BlogPostWithRelations>>(`/api/blogs/${id}`, data).pipe(
      map((res) => res.data),
      take(1)
    );
  }

  public publish(id: string): Observable<BlogPostWithRelations> {
    return this.http.patch<ApiResponse<BlogPostWithRelations>>(`/api/blogs/${id}/publish`, {}).pipe(
      map((res) => res.data),
      take(1)
    );
  }

  public unpublish(id: string): Observable<BlogPostWithRelations> {
    return this.http.patch<ApiResponse<BlogPostWithRelations>>(`/api/blogs/${id}/unpublish`, {}).pipe(
      map((res) => res.data),
      take(1)
    );
  }

  public remove(id: string): Observable<HttpResponse<void>> {
    return this.http.delete<void>(`/api/blogs/${id}`, { observe: 'response' }).pipe(take(1));
  }

  public linkProducts(id: string, productIds: string[]): Observable<BlogPostWithRelations> {
    return this.http.post<ApiResponse<BlogPostWithRelations>>(`/api/blogs/${id}/link-products`, { productIds }).pipe(
      map((res) => res.data),
      take(1)
    );
  }

  public linkChangelogs(id: string, changelogEntryIds: string[]): Observable<BlogPostWithRelations> {
    return this.http.post<ApiResponse<BlogPostWithRelations>>(`/api/blogs/${id}/link-changelogs`, { changelogEntryIds }).pipe(
      map((res) => res.data),
      take(1)
    );
  }

  private buildParams(params?: BlogPostQueryParams): HttpParams {
    let httpParams = new HttpParams();
    if (params?.type) httpParams = httpParams.set('type', params.type);
    if (params?.status) httpParams = httpParams.set('status', params.status);
    if (params?.page) httpParams = httpParams.set('page', params.page.toString());
    if (params?.limit) httpParams = httpParams.set('limit', params.limit.toString());
    return httpParams;
  }
}
