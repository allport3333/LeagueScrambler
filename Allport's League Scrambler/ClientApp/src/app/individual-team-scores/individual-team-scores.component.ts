import { Component, OnInit } from '@angular/core';
import { StatisticsService } from '../services/statistics.service';
import { LeagueService } from '../services/league.service';
import { LoginService } from '../services/login.service';
import { LeagueTeamScoreDto } from '../data-models/leagueTeamScore.model';
import { Leagues } from '../data-models/leagues.model';

@Component({
    selector: 'app-individual-team-scores',
    templateUrl: './individual-team-scores.component.html',
    styleUrls: ['./individual-team-scores.component.css']
})
export class IndividualTeamScoresComponent implements OnInit {
    teamScores: LeagueTeamScoreDto[] = [];
    initialDate: Date | null = new Date();
    leaguesAvailable: Leagues[] = [];
    selectedLeague: string = '';
    leagueID: number = 0;
    isActionAllowed: boolean = false;
    userRole: string = '';
    loading: boolean = false;
    availableDates: Date[] = [];
    selectedDate: Date | null = null;
    constructor(
        private statisticsService: StatisticsService,
        private leagueService: LeagueService,
        private loginService: LoginService
    ) { }

    ngOnInit(): void {
        this.loading = true;

        // Subscribe to League Selection from NavBar
        this.leagueService.selectedLeague$.subscribe((selectedLeague) => {
            this.teamScores = null;
            if (selectedLeague.leagueId !== null && selectedLeague.leagueName !== null) {
                this.leagueID = selectedLeague.leagueId;
                this.selectedLeague = selectedLeague.leagueName;
                this.loadAvailableDates();
            }
        });

        // Check if user is logged in and retrieve their role
        this.loginService.isLoggedIn().subscribe((result) => {
            this.isActionAllowed = result;

            if (result) {
                this.loginService.getUsersRole().subscribe((roleResult) => {
                    this.userRole = roleResult.role;
                });

                // Fetch available leagues for the user
                this.leagueService.getLeagues().subscribe((leagues) => {
                    this.leaguesAvailable = leagues;
                });                
            }
            this.loading = false;
        });
    }

    // Fetch team scores for the selected date and league
    getTeamScores() {
        if (!this.selectedDate || !this.selectedLeague) {
            alert('Please select a league and a date');
            return;
        }

        this.statisticsService.GetTeamScores(this.selectedDate, this.selectedLeague).subscribe({
            next: (result) => {
                this.teamScores = result;
            },
            error: (err) => console.error('Error fetching team scores', err)
        });
    }

    loadAvailableDates() {
        if (!this.selectedLeague) {
            alert('Please select a league');
            return;
        }

        this.statisticsService.GetAvailableScoreDates(this.selectedLeague).subscribe({
            next: (dates: string[]) => {
                // Convert the date strings to Date objects
                this.availableDates = dates.map(dateStr => new Date(dateStr));

                if (this.availableDates.length > 0) {
                    // Find the date closest to today
                    const today = new Date();
                    this.selectedDate = this.availableDates.reduce((prev, curr) =>
                        Math.abs(curr.getTime() - today.getTime()) < Math.abs(prev.getTime() - today.getTime()) ? curr : prev
                    );

                    // Automatically load scores for the closest date
                    this.getTeamScores();
                } else {
                    this.selectedDate = null;
                    this.teamScores = null;
                }
            },
            error: (err) => console.error('Error fetching available dates', err)
        });
    }


    // Group scores by teamId for display in UI
    groupScoresByTeam(): LeagueTeamScoreDto[][] {
        if (!this.teamScores || this.teamScores.length === 0) {
            return [];
        }

        const grouped = this.teamScores.reduce((acc, score) => {
            if (!acc[score.teamId]) {
                acc[score.teamId] = [];
            }
            acc[score.teamId].push(score);
            return acc;
        }, {} as { [key: number]: LeagueTeamScoreDto[] });

        return Object.values(grouped);
    }
}
