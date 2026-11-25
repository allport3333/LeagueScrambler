import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, HostListener, inject, OnDestroy, viewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { DraftMatchup, DraftReveal, ScrambleDraft } from './scramble-draft';

export interface ScrambleDraftData {
    draft: ScrambleDraft;
    save: () => Promise<void>;
    print: () => void;
    canSave: () => boolean;
    canPrint: () => boolean;
    saveFeedback: () => string;
}

interface MatchupWindow {
    matchup: DraftMatchup;
    start: number;
    end: number;
    split: boolean;
}

interface BoardPage { windows: MatchupWindow[]; columns: number; }

@Component({
    selector: 'app-scramble-draft',
    changeDetection: ChangeDetectionStrategy.Eager,
    templateUrl: './scramble-draft.component.html',
    styleUrl: './scramble-draft.component.css'
})
export class ScrambleDraftComponent implements AfterViewInit, OnDestroy {
    readonly actions = inject<ScrambleDraftData>(MAT_DIALOG_DATA);
    readonly draft = this.actions.draft;
    readonly dialog = inject(MatDialogRef<ScrambleDraftComponent>);
    private readonly changeDetector = inject(ChangeDetectorRef);
    private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');
    private readonly board = viewChild.required<ElementRef<HTMLElement>>('board');
    private readonly ghost = viewChild.required<ElementRef<HTMLElement>>('ghost');
    private readonly order = new Map(this.draft.queue.map((entry, index) => [entry.player.id, index]));
    private readonly speeds = { Slow: 1200, Normal: 700, Fast: 350 };
    private observer?: ResizeObserver;
    private animations: Animation[] = [];
    private run = 0;
    private destroyed = false;
    private poolCapacity = 8;
    private measured = '';
    private layoutPending = false;
    poolColumns = 3;
    poolRows = 1;
    poolSlotHeight = 38;
    assignmentHeight = 23;
    assignmentFont = 12;
    headingFont = 12;
    waitingHeight?: number;
    reallocating = false;
    readonly fullscreenSupported = !!document.fullscreenEnabled;
    fullscreen = false;
    speed: keyof typeof this.speeds = 'Normal';
    cursor = 0;
    paused = false;
    moving?: DraftReveal;
    highlighted?: number;
    opposingHighlight?: number;
    saving = false;
    status = '';
    page = 0;
    rosterColumns = 1;
    pages: BoardPage[] = [];
    pool: (DraftReveal | undefined)[] = [];

    get finished() { return this.cursor === this.draft.queue.length; }
    get remaining() { return this.draft.queue.length - this.cursor; }
    get visible() { return Math.min(this.remaining, this.poolCapacity); }

    ngAfterViewInit(): void {
        this.observer = new ResizeObserver(() => this.measure());
        const stage = this.stage().nativeElement;
        this.observer.observe(stage);
        for (const chrome of stage.querySelectorAll('.draft-header, .pool-details, .playback'))
            this.observer.observe(chrome);
        requestAnimationFrame(() => {
            if (this.destroyed) return;
            this.measure();
            void this.play(++this.run);
        });
    }

    ngOnDestroy(): void {
        this.destroyed = true;
        this.run++;
        this.observer?.disconnect();
        this.cancelAnimations();
    }

    private measure(force = false): void {
        const stage = this.stage().nativeElement;
        const { clientWidth, clientHeight } = stage;
        if (!clientWidth || !clientHeight) return;
        const style = getComputedStyle(stage);
        const width = clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        const chromeHeight = ['.draft-header', '.playback'].reduce((sum, selector) =>
            sum + (stage.querySelector<HTMLElement>(selector)?.offsetHeight ?? 0), 0);
        const poolHeading = stage.querySelector<HTMLElement>('.pool-details');
        const poolChrome = poolHeading.offsetHeight + parseFloat(getComputedStyle(poolHeading).marginBottom);
        const available = clientHeight - chromeHeight - parseFloat(style.paddingTop) -
            parseFloat(style.paddingBottom) - 3 * parseFloat(style.rowGap);
        const mobile = width < 600;
        const poolColumns = mobile ? (width < 280 ? 2 : 3) : Math.max(4, Math.min(8, Math.floor(width / 140)));
        const slotHeight = Math.min(47, Math.max(29, Math.floor(clientHeight / (mobile ? 18 : 19))));
        const minimumBoard = mobile ? 145 : width >= 1050 ? 270 : 165;
        const desiredRows = mobile ? (clientHeight >= 710 ? 3 : 2) : clientHeight >= 890 ? 4 : 3;
        const maxRows = Math.max(1, Math.min(desiredRows,
            Math.floor((available - poolChrome - minimumBoard + 5) / (slotHeight + 5))));
        const rows = Math.min(maxRows, Math.ceil(this.remaining / poolColumns));
        const key = [width, available, poolChrome, rows].join(':');
        if (!force && key === this.measured) return;
        if (!force && (this.moving || this.reallocating)) {
            this.layoutPending = true;
            if (this.moving) this.cancelAnimations();
            return;
        }
        this.measured = key;
        this.layoutPending = false;
        const oldWindow = this.pages[this.page]?.windows[0];
        this.poolColumns = poolColumns;
        this.poolSlotHeight = slotHeight;
        this.poolRows = rows;
        this.poolCapacity = poolColumns * rows;
        this.waitingHeight = rows ? poolChrome + rows * (slotHeight + 5) - 5 : 0;
        const height = available - this.waitingHeight;
        const initialRows = Math.min(maxRows, Math.ceil(this.draft.queue.length / poolColumns));
        const planningHeight = available - poolChrome - initialRows * (slotHeight + 5) + 5;
        // Pitch each page at a readable minimum, then grow the reserved slots
        // to fill the available area without dropping any matchups from a page.
        const longest = Math.max(...this.draft.matchups.flatMap(group => group.teams.map(team => team.players.length)));
        this.rosterColumns = longest > 9 && width >= 330 ? 2 : 1;
        const columns = Math.max(1, Math.floor(width / (this.rosterColumns > 1 ? 450 : 236)));
        const headingSpace = 60;
        const slots = Math.max(1, Math.floor((planningHeight - headingSpace) / 23)) * this.rosterColumns;
        const rowHeight = headingSpace + Math.ceil(Math.min(longest, slots) / this.rosterColumns) * 23;
        const perPage = columns * Math.max(1, Math.floor((planningHeight + 8) / (rowHeight + 8)));
        const windows = this.draft.matchups.flatMap(matchup => {
            const count = Math.max(...matchup.teams.map(team => team.players.length));
            return Array.from({ length: Math.ceil(count / slots) }, (_, index) =>
                ({ matchup, start: index * slots, end: Math.min(count, (index + 1) * slots), split: count > slots }));
        });
        this.pages = [];
        let largestRowCount = 1;
        for (let i = 0; i < windows.length; i += perPage) {
            const visible = windows.slice(i, i + perPage);
            const rows = Math.ceil(visible.length / columns);
            largestRowCount = Math.max(rows, largestRowCount);
            this.pages.push({ windows: visible, columns: Math.ceil(visible.length / rows) });
        }
        const rowBudget = (height - 8 * (largestRowCount - 1)) / largestRowCount - (mobile ? 66 : 76);
        this.assignmentHeight = Math.max(23, Math.min(mobile ? 48 : 85,
            Math.floor(rowBudget / Math.ceil(Math.min(longest, slots) / this.rosterColumns))));
        this.assignmentFont = Math.min(mobile ? 18 : 25, Math.round(12 + (this.assignmentHeight - 23) / 2.65));
        this.headingFont = Math.min(mobile ? 19 : 26, this.assignmentFont + 1);
        if (oldWindow && (this.finished || this.paused)) {
            this.page = Math.max(0, this.pages.findIndex(page => page.windows.some(window =>
                window.matchup.id === oldWindow.matchup.id && oldWindow.start >= window.start && oldWindow.start < window.end)));
        } else this.page = this.pageFor(this.draft.queue[this.cursor]);
        this.refreshPool();
        this.changeDetector.detectChanges();
    }

    private refreshPool(): void {
        const next = new Set(this.draft.queue.slice(this.cursor, this.cursor + this.poolCapacity));
        const pool = Array.from({ length: this.poolCapacity }, (_, index) => {
            const previous = this.pool[index];
            if (next.delete(previous)) return previous;
            return undefined;
        });
        const replacements = next.values();
        this.pool = pool.map(entry => entry ?? replacements.next().value);
    }

    private pageFor(entry?: DraftReveal): number {
        if (!entry) return 0;
        return Math.max(0, this.pages.findIndex(page => page.windows.some(window =>
            window.matchup.id === entry.matchupId && entry.slot >= window.start && entry.slot < window.end)));
    }

    revealed(id: number): boolean { return this.order.get(id)! < this.cursor; }

    private async play(run: number): Promise<void> {
        while (!this.destroyed && run === this.run && !this.paused && !this.finished) {
            if (this.layoutPending) this.measure(true);
            const entry = this.draft.queue[this.cursor];
            const targetPage = this.pageFor(entry);
            const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (targetPage !== this.page) {
                this.page = targetPage;
                this.changeDetector.detectChanges();
                if (!reduced) await this.animate(this.board().nativeElement, [{ opacity: .42 }, { opacity: 1 }], 120);
                if (run !== this.run || this.paused || this.destroyed) return;
                if (this.page !== this.pageFor(entry)) continue;
            }
            this.moving = entry;
            this.changeDetector.detectChanges();
            const arrived = await this.move(entry, reduced);
            if (run !== this.run || this.destroyed) return;
            this.moving = undefined;
            if (this.layoutPending) this.measure(true);
            if (!arrived) continue;
            const otherTop = entry.player.top && this.draft.matchups[entry.matchupId].teams
                .some(team => team.id !== entry.teamId && team.players.some(player => player.top && this.revealed(player.id)));
            this.highlighted = entry.teamId;
            this.opposingHighlight = otherTop ? entry.matchupId : undefined;
            this.cursor++;
            if (Math.ceil(this.remaining / this.poolColumns) < this.poolRows) {
                await this.releasePoolRows(run);
                if (run !== this.run || this.destroyed) return;
            } else this.refreshPool();
            if (this.finished) this.complete();
            else this.changeDetector.detectChanges();
        }
    }

    private async move(entry: DraftReveal, reduced: boolean): Promise<boolean> {
        const stage = this.stage().nativeElement;
        const sourceSelector = '[data-pool="' + entry.player.id + '"]';
        const destinationSelector = '[data-slot="' + entry.player.id + '"]';
        let source = stage.querySelector<HTMLElement>(sourceSelector);
        let target = stage.querySelector<HTMLElement>(destinationSelector);
        if (!source || !target) {
            // A resize or page transition can invalidate the rendered window
            // between selecting the next reveal and measuring its destination.
            this.measure(true);
            this.page = this.pageFor(entry);
            this.changeDetector.detectChanges();
            source = stage.querySelector<HTMLElement>(sourceSelector);
            target = stage.querySelector<HTMLElement>(destinationSelector);
            if (!source || !target) {
                await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
                return false;
            }
        }
        const duration = this.speeds[this.speed];
        if (reduced) return this.animate(target, [{ opacity: .65 }, { opacity: 1 }], Math.min(duration, 180));
        const root = stage.getBoundingClientRect(), from = source.getBoundingClientRect(), to = target.getBoundingClientRect();
        const flight = this.ghost().nativeElement;
        const flightWidth = Math.min(Math.max(from.width, 112), stage.clientWidth);
        flight.style.width = flightWidth + 'px';
        const startX = Math.max(0, Math.min(from.x - root.x, stage.clientWidth - flightWidth));
        const endX = Math.max(0, Math.min(to.x - root.x + (to.width - flightWidth) / 2, stage.clientWidth - flightWidth));
        const startY = from.y - root.y + from.height / 2;
        const endY = to.y - root.y + to.height / 2;
        return this.animate(flight, [
            { transform: 'translate(' + startX + 'px,' + startY + 'px) translateY(-50%) scale(.98)', opacity: .95 },
            { transform: 'translate(' + startX + 'px,' + (startY - 5) + 'px) translateY(-50%) scale(1.05)', opacity: 1, offset: .15 },
            { transform: 'translate(' + endX + 'px,' + endY + 'px) translateY(-50%) scale(.92)', opacity: 1 }
        ], duration);
    }

    private async animate(element: HTMLElement, frames: Keyframe[], duration: number): Promise<boolean> {
        if (!element.animate) return true;
        const animation = element.animate(frames, { duration, easing: 'cubic-bezier(.25,.65,.3,1)' });
        this.animations.push(animation);
        try { await animation.finished; return true; }
        catch { return false; }
        finally { this.animations = this.animations.filter(item => item !== animation); }
    }

    private cancelAnimations(): void {
        this.animations.splice(0).forEach(animation => animation.cancel());
    }

    pauseOrResume(): void {
        if (this.finished) return;
        if (!this.paused) { this.paused = true; return; }
        this.paused = false;
        this.status = '';
        if (!this.moving && !this.reallocating) void this.play(++this.run);
    }

    async skip(): Promise<void> {
        const run = ++this.run;
        this.cancelAnimations();
        this.moving = undefined;
        this.paused = false;
        this.cursor = this.draft.queue.length;
        await this.releasePoolRows(run);
        if (!this.destroyed && run === this.run) this.complete();
    }

    private async releasePoolRows(run: number): Promise<void> {
        const waiting = this.stage().nativeElement.querySelector<HTMLElement>('.waiting');
        this.reallocating = true;
        this.measure(true);
        // The height transition is the longest layout change. Wait for it before
        // measuring the next player's source and destination coordinates.
        const transitions = waiting.getAnimations();
        await Promise.allSettled(transitions.map(animation => animation.finished));
        if (this.destroyed || run !== this.run) return;
        this.reallocating = false;
        if (this.layoutPending) this.measure(true);
        else this.changeDetector.detectChanges();
    }

    private complete(): void {
        const stage = this.stage().nativeElement;
        const focusedPlaybackControl = !!document.activeElement?.closest('.controls') && stage.contains(document.activeElement);
        this.status = 'Teams Are Ready!';
        this.changeDetector.detectChanges();
        if (focusedPlaybackControl && !stage.contains(document.activeElement))
            stage.querySelector<HTMLElement>('[data-replay]')?.focus({ preventScroll: true });
    }

    replay(): void {
        this.cursor = 0;
        this.pool = [];
        this.highlighted = this.opposingHighlight = undefined;
        this.paused = false;
        this.status = '';
        this.measure(true);
        this.page = this.pageFor(this.draft.queue[0]);
        this.changeDetector.detectChanges();
        this.stage().nativeElement.querySelector<HTMLElement>('[data-pause]')?.focus({ preventScroll: true });
        void this.play(++this.run);
    }

    async save(): Promise<void> {
        if (!this.finished || this.saving || !this.actions.canSave()) return;
        this.saving = true;
        try { await this.actions.save(); }
        finally { this.saving = false; if (!this.destroyed) this.changeDetector.detectChanges(); }
    }

    async toggleFullscreen(): Promise<void> {
        try {
            if (document.fullscreenElement === this.stage().nativeElement) await document.exitFullscreen();
            else await this.stage().nativeElement.requestFullscreen();
        } catch { this.status = 'Fullscreen is unavailable on this display.'; }
    }

    @HostListener('document:fullscreenchange')
    onFullscreenChange(): void {
        this.fullscreen = document.fullscreenElement === this.stage().nativeElement;
        this.measure();
    }
}
