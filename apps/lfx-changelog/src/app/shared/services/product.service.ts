// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { HttpClient, HttpResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, take } from 'rxjs';

import type {
  ApiResponse,
  CreateProductRequest,
  LinkRepositoryRequest,
  Product,
  ProductActivity,
  ProductRepository,
  PublicProduct,
  UpdateProductRequest,
} from '@lfx-changelog/shared';
import type { Observable } from 'rxjs';
@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);

  public getPublic(): Observable<PublicProduct[]> {
    return this.http.get<ApiResponse<PublicProduct[]>>('/public/api/products').pipe(map((res) => res.data));
  }

  public getAll(): Observable<Product[]> {
    return this.http.get<ApiResponse<Product[]>>('/api/products').pipe(map((res) => res.data));
  }

  public getById(id: string): Observable<Product> {
    return this.http.get<ApiResponse<Product>>(`/api/products/${id}`).pipe(
      map((res) => res.data),
      take(1)
    );
  }

  public create(data: CreateProductRequest): Observable<Product> {
    return this.http.post<ApiResponse<Product>>('/api/products', data).pipe(
      map((res) => res.data),
      take(1)
    );
  }

  public update(id: string, data: UpdateProductRequest): Observable<Product> {
    return this.http.put<ApiResponse<Product>>(`/api/products/${id}`, data).pipe(
      map((res) => res.data),
      take(1)
    );
  }

  public delete(id: string): Observable<HttpResponse<unknown>> {
    return this.http.delete(`/api/products/${id}`, { observe: 'response' }).pipe(take(1));
  }

  public getRepositories(productId: string): Observable<ProductRepository[]> {
    return this.http.get<ApiResponse<ProductRepository[]>>(`/api/products/${productId}/repositories`).pipe(map((res) => res.data));
  }

  public linkRepository(productId: string, data: LinkRepositoryRequest): Observable<ProductRepository> {
    return this.http.post<ApiResponse<ProductRepository>>(`/api/products/${productId}/repositories`, data).pipe(
      map((res) => res.data),
      take(1)
    );
  }

  public unlinkRepository(productId: string, repoId: string): Observable<HttpResponse<unknown>> {
    return this.http.delete(`/api/products/${productId}/repositories/${repoId}`, { observe: 'response' }).pipe(take(1));
  }

  public getActivity(productId: string): Observable<ProductActivity> {
    return this.http.get<ApiResponse<ProductActivity>>(`/api/products/${productId}/activity`).pipe(
      map((res) => res.data),
      take(1)
    );
  }
}
