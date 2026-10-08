import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const isPublicOrAuth =
        req.url.includes('/auth/login/') ||
        req.url.includes('/auth/register/') ||
        req.url.includes('/auth/token/refresh/') ||
        req.url.includes('/departments/');

      // Only attempt token refresh if 401 on protected endpoint and user has a refresh token
      if (
        error.status === 401 &&
        !isPublicOrAuth &&
        authService.getRefreshToken()
      ) {
        return authService.refreshToken().pipe(
          switchMap((tokenResponse) => {
            const retryReq = req.clone({
              setHeaders: {
                Authorization: `Bearer ${tokenResponse.access}`,
              },
            });
            return next(retryReq);
          }),
          catchError((refreshErr) => {
            authService.logout();
            return throwError(() => refreshErr);
          })
        );
      }

      return throwError(() => error);
    })
  );
};
