import { Injectable } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';

@Injectable()
export class LeagueHubSnackBar extends MatSnackBar {
    override open(message: string, action?: string, config?: MatSnackBarConfig) {
        const classes = [config?.panelClass ?? []].flat();
        const persistent = config?.duration === 0 || config?.politeness === 'assertive' || classes.includes('red-snackbar');
        return super.open(message, action, {
            ...config, horizontalPosition: 'center', duration: persistent ? 0 : 3000
        });
    }
}
