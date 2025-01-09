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

    leagueID: number = 1;
    leaguesAvailable: Leagues[];
    loading: boolean;
    newTeamScoreLoading: boolean;
    containsTeam: boolean;

    teamScores: LeagueTeamScoreDto[]; // GET call result
    gameDate: Date;
    initialDate = new Date(); // For the datepicker
    password: Password = { password: '', id: null };

    // The form with multiple "game" score boxes
    TeamScoresForm = new FormGroup({
        team1Score: new FormControl(),
        team2Score: new FormControl(),
        team1Score1: new FormControl(),
        team2Score1: new FormControl(),
        team1Score2: new FormControl(),
        team2Score2: new FormControl(),
        team1Score3: new FormControl(),
        team2Score3: new FormControl(),
        team1Score4: new FormControl(),
        team2Score4: new FormControl(),
        date: new FormControl(),
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
        public statisticsService: StatisticsService
    ) {
        // no-op
    }

    ngOnInit() {
        this.loading = true;
        this.newTeamScoreLoading = false;

        // Load leagues
        this.playerService.GetLeagues().subscribe({
            next: (result) => {
                this.leaguesAvailable = result;
                this.loading = false;
            },
            error: (err) => console.error(err)
        });
    }

    // *** SUBMIT: Called when user enters multiple game scores ***
    onSubmitClick() {
        this.playerService.GetPassword().subscribe({
            next: (result) => {
                this.password = result;

                if (
                    !this.TeamScoresForm.controls['password'].value ||
                    this.TeamScoresForm.controls['password'].value !== this.password.password
                ) {
                    alert('Password is not correct.');
                    return;
                }

                this.newTeamScoreLoading = true;

                // Basic validation
                if (
                    this.TeamScoresForm.controls['team1Score'].value === null ||
                    this.TeamScoresForm.controls['team2Score'].value === null ||
                    !this.selectedTeam1 ||
                    !this.selectedTeam2 ||
                    !this.TeamScoresForm.controls['date'].value
                ) {
                    alert('Please ensure that all required fields are filled out.');
                    this.newTeamScoreLoading = false;
                    return;
                }

                // We'll build an array of LeagueTeamScoreDto for ALL the "games" the user typed in
                let leagueTeamScoresArray: LeagueTeamScoreDto[] = [];

                // Helper function to add a single "game"
                const addGameRecords = (
                    team1ScoreControl: string,
                    team2ScoreControl: string
                ) => {
                    const team1Score = this.TeamScoresForm.controls[team1ScoreControl].value;
                    const team2Score = this.TeamScoresForm.controls[team2ScoreControl].value;

                    // If user didn't fill these in, skip
                    if (team1Score == null || team2Score == null) return;

                    // 1) Record from Team1's perspective
                    const recordForTeam1: LeagueTeamScoreDto = {
                        id: 0,
                        teamId: this.selectedTeam1.id,
                        opponentsTeamId: this.selectedTeam2.id,
                        teamScore: +team1Score,
                        wonGame: +team1Score === 15, // or whatever your logic is
                        date: this.TeamScoresForm.controls['date'].value
                    };

                    // 2) Record from Team2's perspective
                    const recordForTeam2: LeagueTeamScoreDto = {
                        id: 0,
                        teamId: this.selectedTeam2.id,
                        opponentsTeamId: this.selectedTeam1.id,
                        teamScore: +team2Score,
                        wonGame: +team2Score === 15,
                        date: this.TeamScoresForm.controls['date'].value
                    };

                    leagueTeamScoresArray.push(recordForTeam1, recordForTeam2);
                };

                // Collect all "games" the user entered
                addGameRecords('team1Score', 'team2Score');
                addGameRecords('team1Score1', 'team2Score1');
                addGameRecords('team1Score2', 'team2Score2');
                addGameRecords('team1Score3', 'team2Score3');
                addGameRecords('team1Score4', 'team2Score4');

                // Reset form
                this.TeamScoresForm.reset();

                if (this.selectedLeague) {

                    let pendingCalls = leagueTeamScoresArray.length;
                    if (pendingCalls === 0) {
                        alert('No valid score entries found.');
                        this.newTeamScoreLoading = false;
                        return;
                    }

                    // We'll insert them one by one, then update scores at the end
                    leagueTeamScoresArray.forEach((dto, index) => {
                        this.statisticsService.RecordLeagueTeamScore(dto).subscribe({
                            next: () => {
                                pendingCalls--;
                                if (pendingCalls === 0) {
                                    // All done inserting, update wins/losses, then get teams
                                    this.statisticsService.UpdateTeamScores(this.selectedLeague).subscribe({
                                        next: () => {
                                            this.statisticsService.GetTeams(this.selectedLeague).subscribe({
                                                next: updatedTeams => {
                                                    this.teams = updatedTeams;
                                                    this.newTeamScoreLoading = false;
                                                    alert('Successfully added score(s).');
                                                },
                                                error: err => console.error(err)
                                            });
                                        },
                                        error: err => console.error(err)
                                    });
                                }
                            },
                            error: err => console.error(err)
                        });
                    });
                } else {
                    alert('Please Select A League From The Dropdown');
                    this.newTeamScoreLoading = false;
                }

                this.password.password = '';
            },
            error: (err) => console.error(err)
        });
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
