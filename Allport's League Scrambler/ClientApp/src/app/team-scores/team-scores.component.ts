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
    teamScores: TeamScores[];
    newTeam: NewCreatedTeam;
    TeamScoresForm = new FormGroup({
        team1Score: new FormControl(),
        team2Score: new FormControl(),
        date: new FormControl(),
        password: new FormControl()
    });
    NewTeamForm = new FormGroup({
        newTeamName: new FormControl(),
        password: new FormControl()
    });
    picker: Date;
    teamName: string;
    password: Password;
    initialDate = new Date();
    @ViewChild('dateInput', { read: MatInput }) dateInput;
    constructor(http: HttpClient, @Inject('BASE_URL') baseUrl: string, public playerService: PlayerService, public statisticsService: StatisticsService) {

    }
    ngOnInit() {
        this.loading = true;
        this.playerService.GetLeagues().subscribe(result => {
            this.leaguesAvailable = result;
            this.loading = false;
        }, error => console.error(error));
    }

    onSubmitClick() {
        this.playerService.GetPassword().subscribe(result => {

            this.password = result;
            if (this.TeamScoresForm.controls["password"].value == "" || this.TeamScoresForm.controls["password"].value != this.password.password) {
                alert("Password is not correct.")
            }
            else {
                if (this.TeamScoresForm.controls["team1Score"].value == "" || this.TeamScoresForm.controls["team2Score"].value == "" || this.selectedTeam1 == null || this.selectedTeam2 == null
                    || this.TeamScoresForm.controls["date"].value == "" || this.TeamScoresForm == null) {
                    alert("Please ensure that all fields are filled out.")
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

                    if (this.selectedLeague != null) {
                        this.statisticsService.AddScore(newScore).subscribe(result => {
                            var temp = result;
                            this.statisticsService.UpdateTeamScores(this.selectedLeague).subscribe(result => {

                                this.statisticsService.GetTeams(this.selectedLeague).subscribe(result => {
                                    this.teams = result;
                                }, error => console.error(error));
                            }
                                , error => console.error(error));
                        });
                    }
                    else {
                        alert("Please Select A League From The Dropdown");
                    }
                }
            }
        });
    }

    updateScores() {
        if (this.selectedLeague != null) {

            this.statisticsService.UpdateTeamScores(this.selectedLeague).subscribe(result => {

                this.statisticsService.GetTeams(this.selectedLeague).subscribe(result => {
                    this.teams = result;
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
