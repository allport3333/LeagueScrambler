import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class TournamentNotifications {
    private readonly snackBar = inject(MatSnackBar);
    private successPopup?: ReturnType<MatSnackBar['open']>;

    success(message: string): void {
        const popup = this.snackBar.open(message, 'OK', {
            duration: 3000, politeness: 'polite', panelClass: ['tournament-operation-snackbar', 'tournament-success-snackbar']
        });
        this.successPopup = popup;
        popup.afterDismissed().subscribe(() => {
            if (this.successPopup === popup) this.successPopup = undefined;
        });
    }

    dismissSuccess(): void {
        this.successPopup?.dismiss();
    }

    error(message: string): void {
        this.snackBar.open(message, 'Close', {
            duration: 0, politeness: 'assertive', panelClass: ['tournament-operation-snackbar', 'red-snackbar']
        });
    }
}
