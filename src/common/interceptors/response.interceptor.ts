import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  data: T;
  meta?: Record<string, any>;
  success: boolean;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        // Extract pagination if present
        const meta = data?.pagination ? { pagination: data.pagination } : undefined;
        // Unwrap nested data if service returns { data, pagination }
        const payload = data?.data !== undefined ? data.data : data;
        
        return {
          data: payload,
          meta,
          success: true,
        };
      }),
    );
  }
}