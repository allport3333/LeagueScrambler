import { Component, OnInit, ViewChild } from '@angular/core';
import { FormGroup, FormControl } from '@angular/forms';
import { MatInput } from '@angular/material';

import { PlayerService } from '../services/player.service';
import { StatisticsService } from '../services/statistics.service';

import { Leagues } from '../data-models/leagues.model';
import { LeagueTeams } from '../data-models/leagueTeams.model';
import { Password } from '../data-models/password.model';
import { NewCreatedTeam } from '../data-models/newCreatedTeam.model';

// Our new interface for LEAGUE TEAM SCORES
import { LeagueTeamScoreDto } from '../data-models/leagueTeamScore.model';
import { LeagueService } from '../services/league.service';
import { LoginService } from '../services/login.service';

@Component({
    selector: 'app-team-scores',
    templateUrl: './team-scores.component.html',
    styleUrls: ['./team-scores.component.less']
})
export class TeamScoresComponent implements OnInit {
    teams: LeagueTeams[];
    selectedTeam1: LeagueTeams;
    selectedTeam2: LeagueTeams;
    selectedLeague: string;
    loggedIn: boolean = false;
    leagueID: number = 1;
    leaguesAvailable: Leagues[];
    loading: boolean;
    newTeamScoreLoading: boolean;
    containsTeam: boolean;
    numberOfGames: number = 3;
    teamScores: LeagueTeamScoreDto[]; // GET call result
    gameDate: Date;
    initialDate: Date | null = new Date();
    password: Password = { password: '', id: null };
    isActionAllowed: boolean = false;
    userRole: string;
    // The form with multiple "game" score boxes
    TeamScoresForm = new FormGroup({
        date: new FormControl(new Date()),
        password: new FormControl()
    });


    // For creating a new team
    NewTeamForm = new FormGroup({
        newTeamName: new FormControl(),
        password: new FormControl()
    });

    @ViewChild('dateInput', { read: MatInput }) dateInput;

    constructor(
        public playerService: PlayerService,
        public statisticsService: StatisticsService,
        public leagueService: LeagueService,
        public loginService: LoginService
    ) {
        // no-op
    }

    ngOnInit() {
        this.loading = true;
        this.newTeamScoreLoading = false;

        this.leagueService.selectedLeague$.subscribe(selected => {
            this.leagueID = selected.leagueId;
            this.selectedLeague = selected.leagueName;
            this.getTeams();
        });

        this.loginService.isLoggedIn().subscribe((result) => {
            this.loggedIn = result;

            if (result) {
                // User is logged in
                this.isActionAllowed = true; // Enable action for logged-in users

                // Fetch user role
                this.loginService.getUsersRole().subscribe((roleResult) => {
                    this.userRole = roleResult.role;
                    this.loading = false;
                });

                // Fetch user leagues
                this.leagueService.getLeagues().subscribe((leagueResult) => {
                    this.leaguesAvailable = leagueResult;
                    this.loading = false;
                });
            } else {
                this.isActionAllowed = false;
                this.loading = false;
            }
        });

        this.adjustScoreInputs();  // Initialize score inputs
    }

    // Adjust form controls based on number of games
    adjustScoreInputs() {
        // Remove old score controls
        Object.keys(this.TeamScoresForm.controls).forEach((key) => {
            if (key.startsWith('team1Score') || key.startsWith('team2Score')) {
                this.TeamScoresForm.removeControl(key);
            }
        });

        // Add new controls based on the selected number of games
        for (let i = 0; i < this.numberOfGames; i++) {
            this.TeamScoresForm.addControl(`team1Score${i}`, new FormControl());
            this.TeamScoresForm.addControl(`team2Score${i}`, new FormControl());
        }
    }


    // *** SUBMIT: Called when user enters multiple game scores ***
    onSubmitClick() {
        this.newTeamScoreLoading = true;

        // Validate the first game's scores
        if (
            this.TeamScoresForm.controls['team1Score0'].value === null ||
            this.TeamScoresForm.controls['team2Score0'].value === null ||
            !this.selectedTeam1 ||
            !this.selectedTeam2 ||
            !this.TeamScoresForm.controls['date'].value
        ) {
            alert('Please ensure all required fields are filled out.');
            this.newTeamScoreLoading = false;
            return;
        }

        // Collect all game scores
        let leagueTeamScoresArray: LeagueTeamScoreDto[] = [];

        const addGameRecords = (team1ScoreControl: string, team2ScoreControl: string) => {
            const team1Score = this.TeamScoresForm.controls[team1ScoreControl].value;
            const team2Score = this.TeamScoresForm.controls[team2ScoreControl].value;

            if (team1Score == null || team2Score == null) return;

            const recordForTeam1: LeagueTeamScoreDto = {
                id: 0,
                teamId: this.selectedTeam1.id,
                opponentsTeamId: this.selectedTeam2.id,
                teamScore: +team1Score,
                wonGame: +team1Score === 15,
                date: this.TeamScoresForm.controls['date'].value,
                teamName: null,
                opponentsTeamName: null
            };

            const recordForTeam2: LeagueTeamScoreDto = {
                id: 0,
                teamId: this.selectedTeam2.id,
                opponentsTeamId: this.selectedTeam1.id,
                teamScore: +team2Score,
                wonGame: +team2Score === 15,
                date: this.TeamScoresForm.controls['date'].value,
                teamName: null,
                opponentsTeamName: null
            };

            leagueTeamScoresArray.push(recordForTeam1, recordForTeam2);
        };

        // Loop through dynamic controls
        for (let i = 0; i < this.numberOfGames; i++) {
            addGameRecords(`team1Score${i}`, `team2Score${i}`);
        }

        // Check if scores were entered
        if (leagueTeamScoresArray.length === 0) {
            alert('No valid score entries found.');
            this.newTeamScoreLoading = false;
            return;
        }

        // Submit each score to the backend
        let pendingCalls = leagueTeamScoresArray.length;

        leagueTeamScoresArray.forEach((dto) => {
            this.statisticsService.RecordLeagueTeamScore(dto).subscribe({
                next: () => {
                    pendingCalls--;
                    if (pendingCalls === 0) {
                        // Once all scores are recorded, update the team scores
                        this.statisticsService.UpdateTeamScores(this.selectedLeague).subscribe({
                            next: () => {
                                this.statisticsService.GetTeams(this.selectedLeague).subscribe({
                                    next: (updatedTeams) => {
                                        this.teams = updatedTeams;
                                        this.newTeamScoreLoading = false;
                                        alert('Scores submitted and team standings updated successfully!');
                                    },
                                    error: (err) => console.error(err)
                                });
                            },
                            error: (err) => console.error(err)
                        });
                    }
                },
                error: (err) => console.error(err)
            });
        });

        // Reset form after submission
        this.TeamScoresForm.reset();
        this.password.password = '';
    }

    groupScoresByTeam() {
        if (!this.teamScores || this.teamScores.length === 0) {
            return [];  // Return an empty array if teamScores is undefined or empty
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


    // *** Update All Scores for the league ***
    updateScores() {
        if (this.selectedLeague) {
            this.newTeamScoreLoading = true;
            this.statisticsService.UpdateTeamScores(this.selectedLeague).subscribe({
                next: () => {
                    this.statisticsService.GetTeams(this.selectedLeague).subscribe({
                        next: result => {
                            this.teams = result;
                            this.newTeamScoreLoading = false;
                            alert('Successfully updated scores.');
                        },
                        error: err => console.error(err)
                    });
                },
                error: err => console.error(err)
            });
        } else {
            alert('Please Select A League From The Dropdown');
        }
    }

    // *** GET (READ) the existing scores for a certain date ***
    getTeamScores() {
        if (!this.selectedLeague) {
            alert('Please select a league');
            return;
        }
        this.gameDate = this.initialDate;
        this.statisticsService.GetTeamScores(this.gameDate, this.selectedLeague).subscribe({
            next: (result) => {
                this.teamScores = result;
            },
            error: err => console.error(err)
        });
    }

    addTeam() {
        this.playerService.GetPassword().subscribe({
            next: (result) => {
                this.password = result;
                if (
                    !this.NewTeamForm.controls['password'].value ||
                    this.NewTeamForm.controls['password'].value !== this.password.password
                ) {
                    alert('Password is not correct.');
                } else {
                    const newTeam: NewCreatedTeam = {
                        teamName: this.NewTeamForm.controls['newTeamName'].value,
                        leagueName: this.selectedLeague
                    };
                    this.statisticsService.AddTeam(newTeam).subscribe({
                        next: (created) => {
                            if (created.id === 0) {
                                alert('Error creating team. Make sure a league is selected.');
                            } else {
                                alert(
                                    newTeam.teamName +
                                    ' successfully created for league ' +
                                    newTeam.leagueName +
                                    '.'
                                );
                                this.getTeams();
                            }
                        },
                        error: err => console.error(err)
                    });
                }
            },
            error: (err) => console.error(err)
        });
    }

    getTeams() {
        if (!this.selectedLeague) return;
        this.statisticsService.GetTeams(this.selectedLeague).subscribe({
            next: result => {
                this.teams = result;
            },
            error: err => console.error(err)
        });
    }
}
