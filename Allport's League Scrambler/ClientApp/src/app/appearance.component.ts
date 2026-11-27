import { Component, Injectable } from '@angular/core';

const softLight = { id: 'soft-light', label: 'Soft Light', page: '#edf2f7', surface: '#f8fafc', accent: '#315e8a' } as const;

const themes = [
    { id: 'classic', label: 'Classic Light', page: '#ffffff', surface: '#edf3fa', accent: '#293d69' },
    { id: 'navy', label: 'Dark Navy', page: '#111b2d', surface: '#1d2c45', accent: '#adc8ff' },
    { id: 'charcoal', label: 'Charcoal', page: '#1b1d20', surface: '#292c31', accent: '#c3d6d1' },
    { id: 'soft-light', label: 'Soft Light', page: '#edf2f7', surface: '#f8fafc', accent: '#315e8a' }
] as const;

@Injectable({ providedIn: 'root' })
export class AppearanceService {
    readonly themes = themes;
    selected = themes.find(theme => theme.id === document.documentElement.dataset.theme) ?? softLight;

    select(theme: typeof themes[number]): void {
        this.selected = theme;
        document.documentElement.dataset.theme = theme.id;
        document.documentElement.style.colorScheme = theme.id === 'navy' || theme.id === 'charcoal' ? 'dark' : 'light';
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.page);
        try { localStorage.setItem('league-hub-appearance', theme.id); } catch { /* Storage can be disabled. */ }
    }
}

@Component({
    selector: 'app-appearance',
    standalone: false,
    template: `
      <h2 mat-dialog-title>Appearance</h2>
      <mat-dialog-content>
        <mat-radio-group aria-label="Application theme" [value]="appearance.selected.id" class="appearance-options">
          @for (theme of appearance.themes; track theme.id) {
            <mat-radio-button [value]="theme.id" (change)="appearance.select(theme)">
              <span class="theme-preview" aria-hidden="true" [style.background]="theme.page">
                <i [style.background]="theme.surface" [style.border-color]="theme.accent"></i>
              </span>
              {{ theme.label }}
            </mat-radio-button>
          }
        </mat-radio-group>
        <p>Your choice is saved on this browser.</p>
      </mat-dialog-content>
      <mat-dialog-actions align="end"><button mat-button mat-dialog-close>Done</button></mat-dialog-actions>
    `
})
export class AppearanceComponent {
    constructor(public appearance: AppearanceService) {}
}
