import { printSeasonSchedule } from './schedule-print';
import { Component, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild, TemplateRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { StatisticsService } from '../services/statistics.service';
import { scheduleDateKey } from '../player-next-game/next-game-selection';
import { scheduleEventDescription } from './schedule-presentation';
import { WeekSchedule } from '../data-models/DTOs';

@Component({selector:'app-league-schedule',templateUrl:'./league-schedule.component.html',styleUrls:['./league-schedule.component.css']})
export class LeagueScheduleComponent implements OnChanges, OnDestroy {
    @Input() leagueName = '';
    @ViewChild('fullScheduleDialog', { static: true }) fullScheduleDialog: TemplateRef<any>;
    private dialogRef: MatDialogRef<any>;
    @Input() leagueId: number | null = null;
    @Input() requestedWeekNumber:number=null;
    @Input() requestedScheduleDate:string=null;
    private requestedAppliedKey='';
    loading = false;
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
    constructor(private statisticsService: StatisticsService, private dialog: MatDialog) { }
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
    private buildFullScheduleWeeks(): any[] {
        const priority=(division:string)=>{const i=['gold','silver','bronze'].indexOf(division.toLowerCase());return i<0?3:i;};
        return this.schedule.map(week=>{
            const groups=new Map<string,any>();const events:string[]=[];
            (week.matches||[]).filter((match:any)=>!this.fullDivision||[match.team1Division||match.division||'No Division',match.team2Division||match.division||'No Division'].includes(this.fullDivision)).forEach(match=>{
                const division=(match.division||'').trim(),key=division.toLowerCase();
                if(!groups.has(key))groups.set(key,{division,matches:[]});
                groups.get(key).matches.push(match);
                const event=scheduleEventDescription(match);
                if(event && events.indexOf(event)<0)events.push(event);
            });
            ((week as any).events||[]).filter(e=>!this.fullDivision||!e.division||e.division===this.fullDivision).forEach(e=>events.push(e.title));
            return {...week,groups:Array.from(groups.values()).sort((a,b)=>priority(a.division)-priority(b.division)||a.division.localeCompare(b.division)),events};
        }).filter(week=>week.groups.some(g=>g.matches.length)||week.events.length);
    }
    printFullSchedule(): void {
        if(this.loading||this.error)return;printSeasonSchedule(this.leagueName,this.fullScheduleWeeks);
    }
    get selectedWeek(): WeekSchedule { return this.schedule[this.activeTabIndex]; }
    selectWeek(index: number): void {
        if(!this.loading && Number.isInteger(index) && index>=0 && index<this.schedule.length) { this.activeTabIndex=index; }
    }
    retrySchedule(): void { this.loadSchedule(true); }
    private loadSchedule(force = false): void {
        if(!force && this.leagueId && this.loadedLeagueId===this.leagueId) return;
        if(this.request) this.request.unsubscribe();
        const version=++this.version;
        this.schedule=[];this.fullScheduleWeeks=[];this.activeTabIndex=0;this.requestedAppliedKey='';this.error='';this.loading=false;this.loadedLeagueId=this.leagueId;
        if(!this.leagueId) return;
        this.loading=true;
        this.request=this.statisticsService.getLeagueSchedule(this.leagueId).subscribe(data=>{
            if(version!==this.version) return;
            this.loading=false;
            if(!Array.isArray(data)){this.error='Unable to load the league schedule. Please retry.';return;}
            this.schedule=data.slice().sort((a,b)=>String(scheduleDateKey(a.date)||'').localeCompare(String(scheduleDateKey(b.date)||'')) || a.weekNumber-b.weekNumber);
            this.fullDivision='';this.fullDivisions=Array.from(new Set(this.schedule.reduce((all:string[],w:any)=>all.concat((w.matches||[]).reduce((a:string[],m:any)=>a.concat(m.team1Division||m.division||'No Division',m.team2Division||m.division||'No Division'),[]),(w.events||[]).map(e=>e.division||'')),[]))).filter(Boolean).sort();
            this.fullScheduleWeeks = this.buildFullScheduleWeeks();
            this.setClosestWeekAsActiveTab();
            this.applyRequestedWeek();
        },()=>{if(version===this.version){this.loading=false;this.error='Unable to load the league schedule. Please retry.';}});
    }
    ngOnDestroy(): void { if(this.dialogRef)this.dialogRef.close();this.version++;if(this.request)this.request.unsubscribe(); }
    private setClosestWeekAsActiveTab(): void {
        const today = new Date();
        let closestIndex = 0;
        let closestDifference = Number.MAX_VALUE;

        this.schedule.forEach((week, index) => {
            const weekDate = new Date(week.date);
            const difference = Math.abs(weekDate.getTime() - today.getTime());

            if (difference < closestDifference) {
                closestIndex = index;
                closestDifference = difference;
            }
        });

        this.activeTabIndex = closestIndex;

    }
}
