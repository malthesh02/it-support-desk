import { Injectable, inject } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private snackBar = inject(MatSnackBar);

  success(message: string, durationMs: number = 4000): void {
    const config: MatSnackBarConfig = {
      duration: durationMs,
      horizontalPosition: 'right',
      verticalPosition: 'top',
      panelClass: ['snackbar-success'],
    };
    this.snackBar.open(message, 'Close', config);
  }

  error(message: string, durationMs: number = 6000): void {
    const config: MatSnackBarConfig = {
      duration: durationMs,
      horizontalPosition: 'right',
      verticalPosition: 'top',
      panelClass: ['snackbar-error'],
    };
    this.snackBar.open(message, 'Dismiss', config);
  }

  info(message: string, durationMs: number = 4000): void {
    const config: MatSnackBarConfig = {
      duration: durationMs,
      horizontalPosition: 'right',
      verticalPosition: 'top',
      panelClass: ['snackbar-info'],
    };
    this.snackBar.open(message, 'OK', config);
  }
}
