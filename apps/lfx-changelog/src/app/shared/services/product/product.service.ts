import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { ApiResponse, CreateProductRequest, Product, UpdateProductRequest } from '@lfx-changelog/shared';
import { map, take, type Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);

  public getAll(): Observable<Product[]> {
    return this.http.get<ApiResponse<Product[]>>('/public/api/products').pipe(map((res) => res.data));
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
}
