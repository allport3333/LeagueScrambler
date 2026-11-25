import { Component, DestroyRef, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { NavigationStart, Router } from '@angular/router';
import { firstValueFrom, filter } from 'rxjs';

export interface Confirmation {
    title: string;
    message: string;
    action?: string;
    dismiss?: string;
    tone?: 'success' | 'danger';
    details?: { label: string; value: string | number }[];
    confirmName?: string;
    tournament?: { name: string; date: string; participants: number; rounds: number; hasScores: boolean };
}

@Component({
    standalone: true,
    imports: [MatDialogModule, MatButtonModule, FormsModule],
    template: `
        <h2 mat-dialog-title>{{ data.title }}</h2>
        <mat-dialog-content>
            @if (data.tournament; as tournament) {
                <p class="tournament-name">{{ tournament.name }}</p>
                @if (tournament.date) { <p class="tournament-date">{{ tournament.date }}</p> }
                <dl class="tournament-summary">
                    <div><dt>Participants</dt><dd>{{ tournament.participants }}</dd></div>
                    <div><dt>Rounds</dt><dd>{{ tournament.rounds }}</dd></div>
                    <div><dt>Scores</dt><dd>{{ tournament.hasScores ? 'Yes' : 'No' }}</dd></div>
                </dl>
            } @else if (data.details?.length) {
                <dl>@for (detail of data.details; track detail.label) {
                    <div><dt>{{ detail.label }}</dt><dd>{{ detail.value }}</dd></div>
                }</dl>
            }
            <p id="league-hub-confirmation-message">{{ data.message }}</p>
            @if (data.confirmName !== undefined) {
                <label class="confirmation-name">{{ data.tournament ? 'Type the tournament name to confirm' : 'Type ' + data.confirmName + ' to confirm' }}
                    <input class="form-control" [(ngModel)]="typedName" autocomplete="off" spellcheck="false">
                </label>
            }
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-button mat-dialog-close type="button" cdkFocusInitial>{{ data.dismiss || (data.action ? 'Cancel' : 'Close') }}</button>
            @if (data.action) {
            <button mat-raised-button type="button" [mat-dialog-close]="true"
                [disabled]="data.confirmName !== undefined && typedName !== data.confirmName"
                [class.action-success]="data.tone === 'success'"
                [color]="data.tone === 'danger' ? 'warn' : 'primary'">{{ data.action }}</button>
            }
        </mat-dialog-actions>
    `,
    styles: [`
        dl { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 12px; }
        dl div { flex: 1; min-width: 72px; padding: 6px 8px; border: 1px solid var(--hub-border, #d6deea); border-radius: 4px; }
        dt { color: var(--hub-muted, #475569); font-size: .85rem; }
        dd { margin: 0; font-weight: 600; overflow-wrap: anywhere; }
        p { margin: 0; overflow-wrap: anywhere; }
        mat-dialog-actions { gap: 4px; }
        .confirmation-name { display: grid; gap: .35rem; margin-top: 1rem; overflow-wrap: anywhere; }
        .tournament-name { font-size: 1.25rem; font-weight: 650; color: var(--hub-text, #243247); }
        .tournament-date { margin-top: .15rem; color: var(--hub-muted, #475569); }
        .tournament-summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .25rem;
            text-align: center; padding-block: .6rem; margin-block: .75rem; border-block: 1px solid var(--hub-border, #d6deea); }
        .tournament-summary div { display: flex; flex-direction: column-reverse; min-width: 0; padding: 0; border: 0; }
        .tournament-summary dd { font-size: 1.25rem; }
        .tournament-summary dt { overflow-wrap: anywhere; }
    `]
})
class ConfirmationDialogComponent {
    readonly data = inject<Confirmation>(MAT_DIALOG_DATA);
    typedName = '';
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
