import { Component, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild, TemplateRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { MatDialog, MatDialogRef } from '@angular/material';
import { StatisticsService } from '../services/statistics.service';
import { scheduleDateKey } from '../player-next-game/next-game-selection';
import { scheduleEventDescription } from './schedule-presentation';
import { WeekSchedule } from '../data-models/DTOs';

@Component({selector:'app-league-schedule',templateUrl:'./league-schedule.component.html',styleUrls:['./league-schedule.component.css']})
export class LeagueScheduleComponent implements OnChanges, OnDestroy {
    @Input() leagueName = '';
    @ViewChild('fullScheduleDialog') fullScheduleDialog: TemplateRef<any>;
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
    openFullSchedule(): void { if(this.dialogRef||!this.schedule.length)return;this.dialogRef=this.dialog.open(this.fullScheduleDialog,{width:'95vw',maxWidth:'1100px',maxHeight:'94vh',panelClass:'full-schedule-dialog'});this.dialogRef.afterClosed().subscribe(()=>this.dialogRef=null); }
    closeFullSchedule(): void { if(this.dialogRef)this.dialogRef.close(); }
    private buildFullScheduleWeeks(): any[] {
        const priority=(division:string)=>{const i=['gold','silver','bronze'].indexOf(division.toLowerCase());return i<0?3:i;};
        return this.schedule.map(week=>{
            const groups=new Map<string,any>();const events:string[]=[];
            (week.matches||[]).forEach(match=>{
                const division=(match.division||'').trim(),key=division.toLowerCase();
                if(!groups.has(key))groups.set(key,{division,matches:[]});
                groups.get(key).matches.push(match);
                const event=scheduleEventDescription(match);
                if(event && events.indexOf(event)<0)events.push(event);
            });
            return {...week,groups:Array.from(groups.values()).sort((a,b)=>priority(a.division)-priority(b.division)||a.division.localeCompare(b.division)),events};
        });
    }
    printFullSchedule(): void {
        const element=document.getElementById('full-season-tables');if(!element||this.loading||this.error)return;
        const popup=window.open('','_blank','width=1000,height=800');if(!popup)return;
        const title=document.createElement('span');title.textContent=this.leagueName||'Full League Schedule';
        // Print static team labels, never dialog controls or interactive styles.
        const printed=element.cloneNode(true) as HTMLElement;
        Array.from(printed.querySelectorAll('app-team-roster-button')).forEach(link=>{link.parentNode.replaceChild(document.createTextNode(link.textContent || ''),link);});
        popup.document.open();popup.document.write('<!doctype html><html><head><title>Full League Schedule</title><style>@page{size:A4 portrait;margin:8mm}*{box-sizing:border-box}body{margin:0;font:11px/1.15 Arial;color:#172b46}h1{text-align:center;font-size:16px;margin:0 0 7px}.season-week-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 8px;align-items:start}.season-week{break-inside:avoid;page-break-inside:avoid;border:1px solid #aab7c8;padding:2px}h3{text-align:center;font-size:11.5px;margin:0 0 3px}table{font:inherit;width:100%;border-collapse:collapse;table-layout:fixed}td,th{border:1px solid #c5cdd7;padding:.5px 3px;text-align:center;overflow-wrap:break-word}.season-versus-column{width:18px}.season-versus{color:#657285}.season-division th{font-size:9px;font-weight:600;background:#eef2f7;padding:1px 3px}.season-event{font-size:9px;text-align:center;margin:3px 0 0}.season-week p{margin:3px 0 0}.current-season-week{background:transparent}a{color:inherit;text-decoration:none}</style></head><body><h1>'+title.innerHTML+'</h1>'+printed.innerHTML+'</body></html>');popup.onload=()=>{popup.print();popup.close();};popup.document.close();
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
