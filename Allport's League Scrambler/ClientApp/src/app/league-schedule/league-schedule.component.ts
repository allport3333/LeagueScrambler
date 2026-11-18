import { Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { Subscription } from 'rxjs';
import { StatisticsService } from '../services/statistics.service';
import { scheduleDateKey } from '../player-next-game/next-game-selection';
import { WeekSchedule } from '../data-models/DTOs';

@Component({selector:'app-league-schedule',templateUrl:'./league-schedule.component.html',styleUrls:['./league-schedule.component.css']})
export class LeagueScheduleComponent implements OnChanges, OnDestroy {
    @Input() leagueId: number | null = null;
    @Input() requestedWeekNumber:number=null;
    @Input() requestedScheduleDate:string=null;
    private requestedAppliedKey='';
    loading = false;
    error = '';
    schedule: WeekSchedule[] = [];
    activeTabIndex = 0;
    private request: Subscription;
    private version = 0;
    private loadedLeagueId: number = null;
    constructor(private statisticsService: StatisticsService) { }
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
        if(index<0){this.error='The requested scheduled week is unavailable.';return;}this.activeTabIndex=index;
    }
    get selectedWeek(): WeekSchedule { return this.schedule[this.activeTabIndex]; }
    selectWeek(index: number): void {
        if(!this.loading && Number.isInteger(index) && index>=0 && index<this.schedule.length) this.activeTabIndex=index;
    }
    retrySchedule(): void { this.loadSchedule(true); }
    private loadSchedule(force = false): void {
        if(!force && this.leagueId && this.loadedLeagueId===this.leagueId) return;
        if(this.request) this.request.unsubscribe();
        const version=++this.version;
        this.schedule=[];this.activeTabIndex=0;this.requestedAppliedKey='';this.error='';this.loading=false;this.loadedLeagueId=this.leagueId;
        if(!this.leagueId) return;
        this.loading=true;
        this.request=this.statisticsService.getLeagueSchedule(this.leagueId).subscribe(data=>{
            if(version!==this.version) return;
            this.loading=false;
            if(!Array.isArray(data)){this.error='Unable to load the league schedule. Please retry.';return;}
            this.schedule=data;
            this.setClosestWeekAsActiveTab();
            this.applyRequestedWeek();
        },()=>{if(version===this.version){this.loading=false;this.error='Unable to load the league schedule. Please retry.';}});
    }
    ngOnDestroy(): void { this.version++;if(this.request)this.request.unsubscribe(); }
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
