import { Component, DestroyRef, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { NavigationStart, Router } from '@angular/router';
import { firstValueFrom, filter } from 'rxjs';

export interface Confirmation {
    title: string;
    message: string;
    action: string;
    tone?: 'success' | 'danger';
    details?: { label: string; value: string | number }[];
}

@Component({
    standalone: true,
    imports: [MatDialogModule, MatButtonModule],
    template: `
        <h2 mat-dialog-title>{{ data.title }}</h2>
        <mat-dialog-content>
            @if (data.details?.length) {
                <dl>@for (detail of data.details; track detail.label) {
                    <div><dt>{{ detail.label }}</dt><dd>{{ detail.value }}</dd></div>
                }</dl>
            }
            <p id="league-hub-confirmation-message">{{ data.message }}</p>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-button mat-dialog-close type="button" cdkFocusInitial>Cancel</button>
            <button mat-raised-button type="button" [mat-dialog-close]="true"
                [class.action-success]="data.tone === 'success'"
                [color]="data.tone === 'danger' ? 'warn' : 'primary'">{{ data.action }}</button>
        </mat-dialog-actions>
    `,
    styles: [`
        dl { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 12px; }
        dl div { flex: 1; min-width: 72px; padding: 6px 8px; border: 1px solid var(--hub-border, #d6deea); border-radius: 4px; }
        dt { color: var(--hub-muted, #475569); font-size: .85rem; }
        dd { margin: 0; font-weight: 600; overflow-wrap: anywhere; }
        p { margin: 0; overflow-wrap: anywhere; }
        mat-dialog-actions { gap: 4px; }
    `]
})
class ConfirmationDialogComponent {
    readonly data = inject<Confirmation>(MAT_DIALOG_DATA);
}

export function injectConfirmation(): (data: Confirmation) => Promise<boolean> {
    const dialogs = inject(MatDialog);
    const router = inject(Router);
    const owner = inject(DestroyRef);
    const id = 'league-hub-action-confirmation';
    return async data => {
        if (owner.destroyed || dialogs.getDialogById(id)) return false;
        const dialog = dialogs.open(ConfirmationDialogComponent, {
            data, id, role: 'alertdialog', width: '460px', maxWidth: 'calc(100vw - 24px)',
            maxHeight: 'calc(100dvh - 24px)', autoFocus: 'first-tabbable',
            ariaDescribedBy: 'league-hub-confirmation-message'
        });
        const unregister = owner.onDestroy(() => dialog.close());
        const navigation = router.events.pipe(filter(event => event instanceof NavigationStart))
            .subscribe(() => dialog.close());
        try {
            return (await firstValueFrom(dialog.afterClosed())) === true && !owner.destroyed;
        } catch {
            return false;
        } finally {
            navigation.unsubscribe();
            if (!owner.destroyed) unregister();
        }
    };
}
