import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { ApiResponse, CreateProductRequest, LinkRepositoryRequest, Product, ProductActivity, ProductRepository, UpdateProductRequest } from '@lfx-changelog/shared';
import { map, take, type Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);

  public getAll(): Observable<Product[]> {
    return this.http.get<ApiResponse<Product[]>>('/public/api/products').pipe(map((res) => res.data));
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

  public delete(id: string): Observable<void> {
    return this.http.delete<void>(`/api/products/${id}`).pipe(take(1));
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

  public unlinkRepository(productId: string, repoId: string): Observable<void> {
    return this.http.delete<void>(`/api/products/${productId}/repositories/${repoId}`).pipe(take(1));
  }

  public getActivity(productId: string): Observable<ProductActivity> {
    return this.http.get<ApiResponse<ProductActivity>>(`/api/products/${productId}/activity`).pipe(
      map((res) => res.data),
      take(1)
    );
  }
}
