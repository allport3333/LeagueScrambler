import { Component, Input, OnInit, SimpleChanges } from '@angular/core';
import { StatisticsService } from '../services/statistics.service';
import { LeagueTeams } from '../data-models/leagueTeams.model';
import { Player } from '../data-models/player.model';
import { PlayerService } from '../services/player.service';
import { FormControl } from '@angular/forms';
import { startWith, map } from 'rxjs/operators';
import { MatSnackBar } from '@angular/material';
import { TeamUpdateService } from '../services/team-update.service';

@Component({
    selector: 'app-team-management',
    templateUrl: './team-management.component.html',
    styleUrls: ['./team-management.component.css']
})
export class TeamManagementComponent implements OnInit {
    @Input() leagueId: number | null = null;

    // CREATE A NEW TEAM
    newTeamName: string = '';
    newTeamDivision: string = 'Silver'; // Default division
    creatingTeam = false;

    // ADD PLAYER
    teams: LeagueTeams[] = [];
    selectedTeamId: number | null = null;

    allPlayers: Player[] = [];
    filteredPlayers: Player[] = [];
    searchTerm: string = '';
    selectedPlayerId: number | null = null;
    playerCtrl = new FormControl();  
    selectedPlayer: Player | null = null;
    loadingData = false;

    constructor(private statisticsService: StatisticsService, private playerService: PlayerService, private snackBar: MatSnackBar,
        private teamUpdateService: TeamUpdateService) { }

    ngOnInit(): void {
        // If we have a leagueId at start, load data
        if (this.leagueId) {
            this.loadTeams();
            this.loadAllPlayers();
        }

        // We subscribe to changes in the FormControl (playerCtrl)
        // whenever the user types or selects an option
        this.playerCtrl.valueChanges
            .pipe(
                startWith(''),
                map(value => this._filterPlayers(value))
            )
            .subscribe(filtered => {
                this.filteredPlayers = filtered;
            });
    }


    ngOnChanges(changes: SimpleChanges): void {
        if (changes['leagueId']) {
            const leagueId = changes['leagueId'].currentValue;
            if (leagueId) {
                this.loadTeams();
                this.loadAllPlayers();
            }
        }
    }

    private loadTeams(): void {
        if (!this.leagueId) return;

        this.loadingData = true;

        this.statisticsService.GetTeamsByLeagueId(this.leagueId).subscribe({
            next: (res) => {
                this.teams = res;
                this.loadingData = false;
            },
            error: (err) => {
                console.error('Error loading teams:', err);
                this.loadingData = false;
            }
        });
    }

    private loadAllPlayers(): void {
        if (!this.leagueId) return;

        this.playerService.GetPlayersByLeague(this.leagueId).subscribe({
            next: (players) => {
                this.allPlayers = players;
                this.filteredPlayers = [...players];
            },
            error: (err) => console.error('Error loading players:', err)
        });
    }

    // *** CREATE A NEW TEAM ***
    createTeam(): void {
        if (!this.leagueId) {
            alert('No league selected.');
            return;
        }
        if (!this.newTeamName) {
            alert('Please enter a team name.');
            return;
        }

        this.creatingTeam = true;
        this.statisticsService.AddLeagueTeam(this.leagueId, this.newTeamName, this.newTeamDivision).subscribe({
            next: (newTeam) => {
                alert(`Created new team: ${newTeam.teamName} in division: ${newTeam.division}`);
                this.teamUpdateService.notifyTeamUpdate();
                this.loadTeams();
                this.newTeamName = '';
                this.newTeamDivision = 'Silver'; // Reset to default
                this.creatingTeam = false;
            },
            error: (err) => {
                console.error('Error creating team:', err);
                this.creatingTeam = false;
            }
        });
    }

    onSelectPlayer(player: Player) {
        this.selectedPlayer = player;
    }

    // *** SEARCH/TYPEAHEAD FOR PLAYERS ***
    onSearchChange(searchValue: string): void {
        this.filteredPlayers = this.allPlayers.filter((player) =>
            `${player.firstName} ${player.lastName}`.toLowerCase().includes(searchValue.toLowerCase())
        );
    }

    displayPlayerName(player: Player): string {
        return player ? `${player.firstName} ${player.lastName}` : '';
    }

    // *** ADD PLAYER TO TEAM ***
    addPlayerToTeam(): void {
        if (!this.selectedTeamId) {
            this.snackBar.open('Please select a team first.', 'Close', {
                duration: 3000,
                horizontalPosition: 'center',
                verticalPosition: 'top',
                panelClass: ['custom-snackbar']
            });
            return;
        }
        if (!this.selectedPlayer) {
            this.snackBar.open('Please select a player from the dropdown.', 'Close', {
                duration: 3000,
                horizontalPosition: 'center',
                verticalPosition: 'top',
                panelClass: ['custom-snackbar']
            });
            return;
        }

        // Find the selected team by ID to get the team name
        const selectedTeam = this.teams.find(team => team.id === this.selectedTeamId);

        if (!selectedTeam) {
            this.snackBar.open('Selected team not found.', 'Close', {
                duration: 3000,
                horizontalPosition: 'center',
                verticalPosition: 'top',
                panelClass: ['red-snackbar']
            });
            return;
        }

        this.statisticsService.AddPlayerToLeagueTeam(this.selectedTeamId, this.selectedPlayer.id)
            .subscribe({
                next: () => {
                    this.snackBar.open(
                        `Player ${this.selectedPlayer.firstName} was added to ${selectedTeam.teamName}.`,
                        'Close',
                        {
                            duration: 3000,
                            horizontalPosition: 'center',
                            verticalPosition: 'top',
                            panelClass: ['custom-snackbar']
                        }
                    );
                    this.selectedPlayer = null;
                    this.teamUpdateService.notifyTeamUpdate();
                    this.playerCtrl.setValue(''); // Clear input
                },
                error: (err) => {
                    console.error('Error adding player to team:', err);
                    this.snackBar.open('Error adding player to the team.', 'Close', {
                        duration: 3000,
                        horizontalPosition: 'center',
                        verticalPosition: 'top',
                        panelClass: ['red-snackbar']
                    });
                }
            });
    }


    private _filterPlayers(value: string | Player): Player[] {
        // If user typed nothing or typed a partial object, return all
        if (!value) {
            return this.allPlayers;
        }

        // If value is actually a Player object, use that for display
        let filterValue: string;
        if (typeof value === 'string') {
            filterValue = value.toLowerCase();
        } else {
            // 'value' is Player => e.g. { id: 5, firstName: 'John', lastName: 'Doe' }
            filterValue = `${value.firstName} ${value.lastName}`.toLowerCase();
        }

        return this.allPlayers.filter(player =>
            (`${player.firstName} ${player.lastName}`).toLowerCase().includes(filterValue)
        );
    }
}
