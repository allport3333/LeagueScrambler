import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { LeagueService } from '../services/league.service';
import { Leagues } from '../data-models/leagues.model';
import { Observable, Subscription } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { LoginService } from '../services/login.service';

@Component({
    selector: 'app-league-dashboard',
    templateUrl: './league-dashboard.component.html',
    styleUrls: ['./league-dashboard.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class LeagueDashboardComponent implements OnInit, OnDestroy {
    activeDashboardTab=0; requestedWeekNumber:number=null; requestedScheduleDate:string=null; navigationError='';
    get selectingLeague(): boolean { return !!this.requestedLeague && !this.navigationResolved && !this.navigationError; }
    private navigationSubscriptions=new Subscription(); private requestedLeague:number=null; private navigationResolved=true;
    leagues$: Observable<Leagues[]>;          // Observable of all leagues
    selectedLeagueId: number | null = null;  // The chosen league's ID (or null)
    selectedLeagueName: string | null = null;
    userRole: string;
    // Suppose we have a user object or role info that determines if user is admin/manager
    isAdminOrManager = false; // Just an example�replace with real auth logic

    constructor(private leagueService: LeagueService, private loginService: LoginService, private route: ActivatedRoute) { }

    ngOnDestroy(){this.navigationSubscriptions.unsubscribe();}
    ngOnInit(): void {
        this.navigationSubscriptions.add(this.route.queryParams.subscribe(params=>{
            this.activeDashboardTab = params.tab === 'schedule' ? 1 : params.tab === 'teams' ? 3 : 0;
            this.requestedWeekNumber=params.weekNumber===undefined?null:Number(params.weekNumber);
            this.requestedScheduleDate=params.scheduleDate||null;
            this.requestedLeague=params.leagueId===undefined?null:Number(params.leagueId);this.navigationError='';
            this.navigationResolved=!this.requestedLeague;
            if(params.leagueId!==undefined && !(this.requestedLeague>0)){this.selectedLeagueId=null;this.navigationError='The requested league is unavailable.';return;}
            if(this.requestedLeague){const requested=this.requestedLeague;this.selectedLeagueId=null;this.navigationSubscriptions.add(this.leagueService.selectNavigationLeague(requested).subscribe(found=>{if(requested!==this.requestedLeague)return;if(!found){this.navigationError='The requested league is unavailable.';return;}const selected=this.leagueService.leaguesAvailable.find(league=>league.id===requested);this.navigationResolved=true;this.selectedLeagueId=requested;this.selectedLeagueName=selected?selected.leagueName:null;}));}
        }));
        // 1) Load the leagues (the LeagueService already fetches them)
        this.leagues$ = this.leagueService.getLeagues();

        // 2) Subscribe to the current "selected league" if you want
        this.navigationSubscriptions.add(this.leagueService.selectedLeague$.subscribe(selected => {
            if(!this.navigationResolved && selected.leagueId!==this.requestedLeague)return;
            if(this.navigationResolved && this.selectedLeagueId && selected.leagueId!==this.selectedLeagueId){this.requestedWeekNumber=null;this.requestedScheduleDate=null;}
            this.navigationResolved=true;
            this.selectedLeagueId = selected.leagueId;
            this.selectedLeagueName = selected.leagueName;
        }));

        this.loginService.getUsersRole().subscribe((roleResult) => {
            this.userRole = roleResult.role; // Assuming the API returns { role: 'Admin' }
            if (this.userRole == "Admin" || this.userRole == "Manager") {
                this.isAdminOrManager = true;
            }
        });

    }

}
