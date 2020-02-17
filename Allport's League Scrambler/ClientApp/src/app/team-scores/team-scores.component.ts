import { Component, Inject, OnInit, ViewChild } from '@angular/core';
import { Player } from '../data-models/player.model';
import { PlayerService } from '../services/player.service';
import { FormGroup, FormControl } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { StatisticsService } from '../services/statistics.service';
import { Team } from '../data-models/teams.model';
import { Leagues } from '../data-models/leagues.model';
import { NewCreatedTeam } from '../data-models/newCreatedTeam.model';
import { LeagueTeams } from '../data-models/leagueTeams.model';
import { TeamScores } from '../data-models/teamScores.model';
import { Password } from '../data-models/password.model';
import { MatInput } from '@angular/material';
import { LeagueTeamScores } from '../data-models/leagueTeamScores.model';
@Component({
    selector: 'app-team-scores',
    templateUrl: './team-scores.component.html',
    styleUrls: ['./team-scores.component.less']
})
export class TeamScoresComponent implements OnInit {
    teams: LeagueTeams[];
    team: LeagueTeams;
    loading: boolean;
    leagueID: number = 1;
    selectedLeague: string;
    leaguesAvailable: Leagues[];
    selectedTeam1: LeagueTeams;
    containsTeam: boolean;
    selectedTeam2: LeagueTeams;
    gameDate: Date;
    TeamScoresMultiple: TeamScores[];
    newTeamScoreLoading: boolean;
    teamScores: LeagueTeamScores[];
    newTeam: NewCreatedTeam;
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
    NewTeamForm = new FormGroup({
        newTeamName: new FormControl(),
        password: new FormControl()
    });
    picker: Date;
    teamName: string;
    password: Password = {
        password: '',
        id: null 
    };
    initialDate = new Date();
    @ViewChild('dateInput', { read: MatInput }) dateInput;
    constructor(http: HttpClient, @Inject('BASE_URL') baseUrl: string, public playerService: PlayerService, public statisticsService: StatisticsService) {

    }
    ngOnInit() {
        this.loading = true;
        this.newTeamScoreLoading = false;
        this.playerService.GetLeagues().subscribe(result => {
            this.leaguesAvailable = result;
            this.loading = false;
        }, error => console.error(error));
    }

    onSubmitClick() {
        this.playerService.GetPassword().subscribe(result => {
            this.TeamScoresMultiple = [];
            this.password = result;
            if (this.TeamScoresForm.controls["password"].value == "" || this.TeamScoresForm.controls["password"].value != this.password.password) {
                alert("Password is not correct.")
            }
            else {
                this.newTeamScoreLoading = true;
                console.log(this.TeamScoresForm.controls["team1Score"].value);
                console.log(this.TeamScoresForm.controls["team2Score"].value);

                if (this.TeamScoresForm.controls["team1Score"].value === null || this.TeamScoresForm.controls["team2Score"].value === null || this.selectedTeam1 == null || this.selectedTeam2 == null
                    || this.TeamScoresForm.controls["date"].value == "" || this.TeamScoresForm == null) {
                    alert("Please ensure that all fields are filled out.");
                    this.newTeamScoreLoading = false;
                }
                else {
                    let newScore: TeamScores = {
                        id: 0,
                        team1Score: this.TeamScoresForm.controls["team1Score"].value,
                        team2Score: this.TeamScoresForm.controls["team2Score"].value,
                        team1ID: this.selectedTeam1.id,
                        team2ID: this.selectedTeam2.id,
                        date: this.TeamScoresForm.controls["date"].value
                    };
                    let newScore1: TeamScores = {
                        id: 0,
                        team1Score: this.TeamScoresForm.controls["team1Score1"].value,
                        team2Score: this.TeamScoresForm.controls["team2Score1"].value,
                        team1ID: this.selectedTeam1.id,
                        team2ID: this.selectedTeam2.id,
                        date: this.TeamScoresForm.controls["date"].value
                    };
                    let newScore2: TeamScores = {
                        id: 0,
                        team1Score: this.TeamScoresForm.controls["team1Score2"].value,
                        team2Score: this.TeamScoresForm.controls["team2Score2"].value,
                        team1ID: this.selectedTeam1.id,
                        team2ID: this.selectedTeam2.id,
                        date: this.TeamScoresForm.controls["date"].value
                    };
                    let newScore3: TeamScores = {
                        id: 0,
                        team1Score: this.TeamScoresForm.controls["team1Score3"].value,
                        team2Score: this.TeamScoresForm.controls["team2Score3"].value,
                        team1ID: this.selectedTeam1.id,
                        team2ID: this.selectedTeam2.id,
                        date: this.TeamScoresForm.controls["date"].value
                    };
                    let newScore4: TeamScores = {
                        id: 0,
                        team1Score: this.TeamScoresForm.controls["team1Score4"].value,
                        team2Score: this.TeamScoresForm.controls["team2Score4"].value,
                        team1ID: this.selectedTeam1.id,
                        team2ID: this.selectedTeam2.id,
                        date: this.TeamScoresForm.controls["date"].value
                    };
                    this.TeamScoresMultiple.push(newScore);
                    if (newScore1.team1Score != null && newScore1.team2Score != null) {
                        this.TeamScoresMultiple.push(newScore1);
                    };
                    if (newScore2.team1Score != null && newScore2.team2Score != null) {
                        this.TeamScoresMultiple.push(newScore2);
                    };
                    if (newScore3.team1Score != null && newScore3.team2Score != null) {
                        this.TeamScoresMultiple.push(newScore3);
                    };
                    if (newScore4.team1Score != null && newScore4.team2Score != null) {
                        this.TeamScoresMultiple.push(newScore4);
                    };
                    this.TeamScoresForm = new FormGroup({
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
                    
                    if (this.selectedLeague != null) {
                        this.statisticsService.AddScore(this.TeamScoresMultiple).subscribe(result => {
                            var temp = result;
                            this.statisticsService.UpdateTeamScores(this.selectedLeague).subscribe(result => {

                                this.statisticsService.GetTeams(this.selectedLeague).subscribe(result => {
                                    this.teams = result;
                                    this.newTeamScoreLoading = false;
                                    alert('Succesfully added score(s).')
                                }, error => console.error(error));
                            }
                                , error => console.error(error));
                        });
                    }
                    else {
                        alert("Please Select A League From The Dropdown");
                    }
                    this.password.password = '';
                }
            }
        });
    }

    updateScores() {
        if (this.selectedLeague != null) {
            this.newTeamScoreLoading = true;
            this.statisticsService.UpdateTeamScores(this.selectedLeague).subscribe(result => {

                this.statisticsService.GetTeams(this.selectedLeague).subscribe(result => {
                    this.teams = result;
                    this.newTeamScoreLoading = false;
                    alert('Succesfully updated score.')
                }, error => console.error(error));
            }
                , error => console.error(error));

        }
        else {
            alert("Please Select A League From The Dropdown");
        }
    }




    getTeamScores() {
        if (this.selectedLeague == null) {
            alert('Please select a league');
        }
        else {
            this.gameDate = this.initialDate;
            this.gameDate.toUTCString();
            this.statisticsService.GetTeamScores(this.gameDate, this.selectedLeague).subscribe(result => {
                this.teamScores = result;
                
            });

        }
    }

    addTeam() {
        this.containsTeam = false;
        this.playerService.GetPassword().subscribe(result => {
            this.password = result;
            if (this.NewTeamForm.controls["password"].value == "" || this.NewTeamForm.controls["password"].value != this.password.password) {
                alert("Password is not correct.")
            }
            else {
                let newTeam: NewCreatedTeam = {
                    teamName: this.NewTeamForm.controls["newTeamName"].value,
                    leagueName: this.selectedLeague
                }


                this.statisticsService.AddTeam(newTeam).subscribe(result => {

                    if (result.id == 0) {
                        alert('Error creating team. Make sure a league is selected.');
                    }
                    else {
                        alert(newTeam.teamName + ' successfully created for league ' + newTeam.leagueName + '.');
                        this.getTeams();
                    }

                }, error => console.error(error));
            }
        });
    }

    getTeams() {
        this.statisticsService.GetTeams(this.selectedLeague).subscribe(result => {
            this.teams = result;
        }, error => console.error(error));
    }
}
