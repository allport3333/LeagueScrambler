import { onLeagueResume } from '../pwa/pending-work.service';
import { printSeasonSchedule } from './schedule-print';
import { Component, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild, TemplateRef, ChangeDetectionStrategy } from '@angular/core';
import { Subscription } from 'rxjs';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { StatisticsService } from '../services/statistics.service';
import { scheduleDateKey } from '../player-next-game/next-game-selection';
import { scheduleEventDescription } from './schedule-presentation';
import { Match, WeekSchedule } from '../data-models/DTOs';

@Component({
    selector: 'app-league-schedule', templateUrl: './league-schedule.component.html', styleUrls: ['./league-schedule.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class LeagueScheduleComponent implements OnChanges, OnDestroy {
    @Input() leagueName = '';
    @ViewChild('fullScheduleDialog', { static: true }) fullScheduleDialog: TemplateRef<any>;
    private dialogRef: MatDialogRef<any>;
    @Input() leagueId: number | null = null;
    @Input() requestedWeekNumber:number=null;
    @Input() requestedScheduleDate:string=null;
    private requestedAppliedKey='';
    loading = false;
    refreshing = false;
    refreshError = '';
    weeklyDivisions: { division: string; matches: Match[] }[] = [];
    error = '';
    schedule: WeekSchedule[] = [];
    activeTabIndex = 0;
    fullScheduleWeeks: any[] = [];
    fullDivision='';
    fullDivisions:string[]=[];
    filterFullSchedule():void { this.fullScheduleWeeks=this.buildFullScheduleWeeks(); }
    private request: Subscription;
    private version = 0;
    private loadedLeagueId: number = null;
    constructor(private statisticsService: StatisticsService, private dialog: MatDialog) { onLeagueResume(() => { if (!this.loading && !this.refreshing && !this.dialogRef) this.loadSchedule(true); }); }
    ngOnChanges(changes: SimpleChanges): void {
        if(changes['leagueId']) this.loadSchedule();
        else if((changes['requestedWeekNumber']||changes['requestedScheduleDate'])&&!this.loading)this.applyRequestedWeek();
    }
    private applyRequestedWeek():void {
        if(this.requestedWeekNumber===null||this.requestedWeekNumber===undefined)return;
        const key=this.leagueId+':'+this.requestedWeekNumber+':'+(this.requestedScheduleDate||'');if(key===this.requestedAppliedKey)return;
        const date=this.requestedScheduleDate?scheduleDateKey(this.requestedScheduleDate):null;
        const index=this.schedule.findIndex(week=>week.weekNumber===this.requestedWeekNumber&&(!this.requestedScheduleDate||date&&scheduleDateKey(week.date)===date));
        this.requestedAppliedKey=key;
        if(index<0){this.error='The requested scheduled week is unavailable.';return;}this.selectWeek(index);
    }
    calendarDate(value: string): Date { const key = scheduleDateKey(value); if (!key) return null; const p=key.split('-').map(Number);return new Date(p[0],p[1]-1,p[2]); }
    currentWeek(): void { this.setClosestWeekAsActiveTab(); }
    closestWeekIndex(): number { const today=new Date();let index=0,difference=Number.MAX_VALUE;this.schedule.forEach((week,i)=>{const delta=Math.abs(new Date(week.date).getTime()-today.getTime());if(delta<difference){index=i;difference=delta;}});return index; }
    isCurrentWeek(week:any):boolean {const current=this.schedule[this.closestWeekIndex()];return !!current&&current.date===week.date&&current.weekNumber===week.weekNumber;}
    openFullSchedule(): void { if(this.dialogRef||!this.schedule.length)return;this.dialogRef=this.dialog.open(this.fullScheduleDialog,{width:'95vw',maxWidth:'1100px',maxHeight:'94vh',panelClass:'full-schedule-dialog'});this.dialogRef.afterClosed().subscribe(()=>this.dialogRef=null); }
    closeFullSchedule(): void { if(this.dialogRef)this.dialogRef.close(); }
    private groupMatches(matches: Match[]): { division: string; matches: Match[] }[] {
        const priority = (division: string) => {
            const index = ['gold', 'silver', 'bronze'].indexOf(division.toLowerCase());
            return index < 0 ? 3 : index;
        };
        const groups = new Map<string, { division: string; matches: Match[] }>();
        for (const match of matches) {
            const division = (match.division || '').trim();
            const key = division.toLowerCase();
            if (!groups.has(key)) groups.set(key, { division, matches: [] });
            groups.get(key).matches.push(match);
        }
        return [...groups.values()].sort((a, b) => priority(a.division) - priority(b.division) || a.division.localeCompare(b.division));
    }

    private buildFullScheduleWeeks(): any[] {
        return this.schedule.map(week=>{
            const events:string[]=[];
            const matches = (week.matches || []).filter(match => !this.fullDivision ||
                [match.team1Division || match.division || 'No Division', match.team2Division || match.division || 'No Division'].includes(this.fullDivision));
            matches.forEach(match => {
                const event = scheduleEventDescription(match);
                if (event && !events.includes(event)) events.push(event);
            });
            ((week as any).events||[]).filter(e=>!this.fullDivision||!e.division||e.division===this.fullDivision).forEach(e=>events.push(e.title));
            return {...week,groups:this.groupMatches(matches),events};
        }).filter(week=>week.groups.some(g=>g.matches.length)||week.events.length);
    }
    printFullSchedule(): void {
        if(this.loading||this.error)return;printSeasonSchedule(this.leagueName,this.fullScheduleWeeks);
    }
    get selectedWeek(): WeekSchedule { return this.schedule[this.activeTabIndex]; }
    selectWeek(index: number): void {
        if(!this.loading && Number.isInteger(index) && index>=0 && index<this.schedule.length) {
            this.activeTabIndex = index;
            this.weeklyDivisions = this.groupMatches(this.selectedWeek.matches || []);
        }
    }
    retrySchedule(): void { this.loadSchedule(true); }
    private loadSchedule(force = false): void {
        if(!force && this.leagueId && this.loadedLeagueId===this.leagueId) return;
        if(this.request) this.request.unsubscribe();
        const version=++this.version;
        const previousWeek = this.loadedLeagueId === this.leagueId ? this.selectedWeek : null;
        if (!previousWeek) {
            this.schedule = [];
            this.fullScheduleWeeks = [];
            this.weeklyDivisions = [];
            this.activeTabIndex = 0;
            this.requestedAppliedKey = '';
        }
        this.error = '';
        this.refreshError = '';
        this.loadedLeagueId = this.leagueId;
        this.loading = !!this.leagueId && !previousWeek;
        this.refreshing = !!this.leagueId && !!previousWeek;
        if (!this.leagueId) return;
        const handleError = () => {
            if (version !== this.version) return;
            this.loading = this.refreshing = false;
            const message = 'Unable to load the league schedule. Please retry.';
            if (previousWeek) this.refreshError = message;
            else this.error = message;
        };
        this.request=this.statisticsService.getLeagueSchedule(this.leagueId).subscribe(data=>{
            if(version!==this.version) return;
            this.loading = this.refreshing = false;
            if (!Array.isArray(data)) { handleError(); return; }
            const weekToPreserve = previousWeek ? this.selectedWeek : null;
            this.schedule=data.slice().sort((a,b)=>String(scheduleDateKey(a.date)||'').localeCompare(String(scheduleDateKey(b.date)||'')) || a.weekNumber-b.weekNumber);
            this.fullDivision='';this.fullDivisions=Array.from(new Set(this.schedule.reduce((all:string[],w:any)=>all.concat((w.matches||[]).reduce((a:string[],m:any)=>a.concat(m.team1Division||m.division||'No Division',m.team2Division||m.division||'No Division'),[]),(w.events||[]).map(e=>e.division||'')),[]))).filter(Boolean).sort();
            this.fullScheduleWeeks = this.buildFullScheduleWeeks();
            const preserved = weekToPreserve ? this.schedule.findIndex(week => week.weekNumber === weekToPreserve.weekNumber && scheduleDateKey(week.date) === scheduleDateKey(weekToPreserve.date)) : -1;
            this.selectWeek(preserved >= 0 ? preserved : this.closestWeekIndex());
            if (!this.schedule.length) this.weeklyDivisions = [];
            this.applyRequestedWeek();
        }, handleError);
    }
    ngOnDestroy(): void { if(this.dialogRef)this.dialogRef.close();this.version++;if(this.request)this.request.unsubscribe(); }
    private setClosestWeekAsActiveTab(): void { this.selectWeek(this.closestWeekIndex()); }
}
