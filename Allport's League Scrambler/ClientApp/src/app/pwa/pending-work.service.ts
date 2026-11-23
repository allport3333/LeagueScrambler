import { DestroyRef, Injectable, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Injectable({ providedIn: 'root' })
export class PendingWorkService {
    private readonly probes = new Set<() => boolean>();

    get hasPendingWork(): boolean {
        return [...this.probes].some(probe => probe()) ||
            !!document.querySelector('form.ng-dirty');
    }

    register(probe: () => boolean, lifetime: DestroyRef): void {
        this.probes.add(probe);
        lifetime.onDestroy(() => this.probes.delete(probe));
    }
}

export function protectPendingWork(probe: () => boolean): void {
    inject(PendingWorkService).register(probe, inject(DestroyRef));
}

@Injectable({ providedIn: 'root' })
export class LeagueRefreshService {
    private readonly resumed = new Subject<void>();
    readonly resumed$ = this.resumed.asObservable();

    refreshVisibleData(): void {
        this.resumed.next();
    }
}

export function onLeagueResume(refresh: () => void): void {
    inject(LeagueRefreshService).resumed$.pipe(takeUntilDestroyed()).subscribe(refresh);
}
