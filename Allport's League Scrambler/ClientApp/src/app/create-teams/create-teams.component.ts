import { Component, OnInit, ViewChild, Input, SimpleChanges } from '@angular/core';
import { Player } from '../data-models/player.model';
import { PlayerService } from '../services/player.service';
import { KingQueenRoundScore } from '../data-models/kingQueenRoundScore';
import { Team } from '../data-models/teams.model';
import { Leagues } from '../data-models/leagues.model';
import { MatTabGroup } from '@angular/material';

@Component({
    selector: 'app-create-teams',
    templateUrl: './create-teams.component.html',
    styleUrls: ['./create-teams.component.css']
})
export class CreateTeamsComponent implements OnInit {
    @Input() selectedLeagueDto!: Leagues;
    leaguesAvailable: Leagues[] = []; // List of leagues to select from
    selectedLeague: Leagues | null = null; // The currently selected league

    scrambleNumbers: number[] = []; // List of existing scramble numbers
    selectedScrambleNumber: number | 'new' = 'new'; // Selected scramble number or 'new' for a new scramble
    newScrambleNumber: number | null = null;

    queriedPlayers: Player[] = []; // Full list of players fetched for the selected league
    malePlayers1: Player[] = []; // Male players in the selected league
    femalePlayers1: Player[] = []; // Female players in the selected league
    allMalePlayers: Player[] = [];
    allFemalePlayers: Player[] = [];

    malePlayerCount: number = 0; // Count of male players
    femalePlayerCount: number = 0; // Count of female players

    selectedPlayers: Player[] = []; // List of players selected for creating teams
    listOfTeams: Team[] = []; // List of teams
    playerLoading: boolean = true; // Indicates if players are being loaded

    @ViewChild('tabGroup') tabGroup!: MatTabGroup; // Reference to MatTabGroup
    rounds: number[] = [];
    maxRounds = Array.from({ length: 10 }, (_, i) => i + 1); // Array of numbers [1, 2, ..., 10]
    selectedRounds = 5; // Default to 5 rounds
    constructor(private playerService: PlayerService) { }

    ngOnInit(): void {
        // Load leagues on initialization
        this.setNumberOfRounds(this.selectedRounds);
        if (this.selectedLeague != null) {
            this.loadScrambleNumbers();
        }
        this.loadLeagues();
    }

    loadScrambleNumbers(): void {
        this.playerService.getScrambleNumbers(this.selectedLeague.id).subscribe(
            (numbers: number[]) => {
                this.scrambleNumbers = numbers;
            },
            (error) => {
                console.error('Error fetching scramble numbers:', error);
            }
        );
    }

    loadLeagues(): void {
        this.playerService.GetLeagues().subscribe(
            (leagues: Leagues[]) => {
                this.leaguesAvailable = leagues;
            },
            (error) => console.error('Error loading leagues:', error)
        );
    }

    saveTeamScores(): void {
        const scrambleNumber = this.selectedScrambleNumber === 'new' ? 0 : this.selectedScrambleNumber;
        const scores = this.listOfTeams.map(team => ({
            kingQueenTeamId: team.kingQueenTeamId, // Matches `KingQueenTeamId`
            leagueId: this.selectedLeague.id, // Matches `LeagueId`
            date: new Date().toISOString().split('T')[0], // Matches `Date` as a string (YYYY-MM-DD)
            scrambleNumber: scrambleNumber, // Matches `ScrambleNumber`
            players: team.players.map(player => ({
                playerId: player.id, // Matches `PlayerId`
                isSubScore: player.isSubScore // Matches `isSubScore` (nullable boolean)
            })),
            roundScores: team.kingQueenRoundScores.map(score => ({
                roundId: score.roundId, // Matches `RoundId`
                roundScore: score.roundScore, // Matches `RoundScore`
                roundWon: score.roundWon // Matches `RoundWon`
            }))
        }));
        this.playerService.saveTeamScores(scores).subscribe(
            (response) => {
                if (response && response.latestScrambleNumber) {
                    // Add latestScrambleNumber to the scrambleNumbers array if it doesn't exist
                    if (!this.scrambleNumbers.includes(response.latestScrambleNumber)) {
                        this.scrambleNumbers.push(response.latestScrambleNumber);
                    }

                    // Set the selected scramble number
                    this.selectedScrambleNumber = response.latestScrambleNumber;
                }
                // Remove players on saved teams from available players lists
                const playersOnTeams = this.listOfTeams.reduce((ids, team) => ids.concat(team.players.map(player => player.id)), []);

                this.malePlayers1 = this.malePlayers1.filter(player => !playersOnTeams.includes(player.id));
                this.femalePlayers1 = this.femalePlayers1.filter(player => !playersOnTeams.includes(player.id));

                // Optionally reset teams after saving
                this.listOfTeams = [];
            },
            (error) => {
                console.error('Error saving team scores:', error);
            }
        );
    }

    updateIsSubScore(teamId: number, playerId: number, isSubScore: boolean): void {

        const team = this.listOfTeams.find(t => t.kingQueenTeamId === teamId);
        if (team) {
            const player = team.players.find(p => p.id === playerId);
            if (player) {
                player.isSubScore = isSubScore;
            }
        }
    }

    onLeagueSelect(selectedLeague: Leagues): void {
        this.selectedLeague = selectedLeague;
        this.malePlayers1 = [];
        this.femalePlayers1 = [];
        this.selectedPlayers = []; // Clear selected players when switching leagues
        this.listOfTeams = []; // Reset teams when a new league is selected

        // Backup original players
        this.allMalePlayers = [];
        this.allFemalePlayers = [];

        // Fetch players for the selected league
        this.playerService.SelectLeague(this.selectedLeague.leagueName).subscribe(
            (result: Player[]) => {
                this.queriedPlayers = result;

                for (let player of this.queriedPlayers) {
                    const playerWithState = { ...player, isUsed: false };
                    if (player.isMale) {
                        this.malePlayers1.push(playerWithState);
                        this.allMalePlayers.push(playerWithState); // Backup original male players
                    } else {
                        this.femalePlayers1.push(playerWithState);
                        this.allFemalePlayers.push(playerWithState); // Backup original female players
                    }
                }

                this.malePlayerCount = this.malePlayers1.length;
                this.femalePlayerCount = this.femalePlayers1.length;

                this.playerLoading = false;
                this.loadScrambleNumbers();
                this.setNumberOfRounds(this.selectedRounds); // Initialize rounds after league is selected
            },
            (error) => {
                console.error('Error loading league players:', error);
            }
        );
    }

    setNumberOfRounds(selectedRounds: number): void {
        this.rounds = Array.from({ length: selectedRounds }, (_, i) => i + 1);
        this.listOfTeams.forEach(team => {
            team.kingQueenRoundScores = this.rounds.map(round => ({
                id: 0,
                roundId: round,
                kingQueenTeamId: team.kingQueenTeamId,
                roundScore: team.kingQueenRoundScores[round - 1] ? team.kingQueenRoundScores[round - 1].roundScore : 0,
                roundWon: team.kingQueenRoundScores[round - 1] ? team.kingQueenRoundScores[round - 1].roundWon : false

            }));
        });
    }

    addPlayerToTeam(player: Player): void {
        const scrambleNumber = this.selectedScrambleNumber === 'new' ? 0 : this.selectedScrambleNumber;

        // Check if the player is already in a team
        const existingTeam = this.listOfTeams.find(team => team.players.includes(player));
        if (existingTeam) {
            // Remove the player from the existing team
            existingTeam.players = existingTeam.players.filter(p => p.id !== player.id);

            // If the team becomes empty after removal, remove the team from the list
            if (existingTeam.players.length === 0) {
                this.listOfTeams = this.listOfTeams.filter(team => team !== existingTeam);
            }

            // Mark the player as not used
            player.isUsed = false;
        } else {
            // Add the player to a team
            const availableTeam = this.listOfTeams.find(team => team.players.length < 5);

            if (availableTeam) {
                availableTeam.players.push(player);
            } else {
                const newTeam: Team = {
                    players: [player],
                    maleCount: player.isMale ? 1 : 0,
                    femaleCount: player.isMale ? 0 : 1,
                    kingQueenTeamId: this.listOfTeams.length + 1,
                    kingQueenRoundScores: this.rounds.map(round => ({
                        id: 0,
                        roundId: round,
                        kingQueenTeamId: this.listOfTeams.length + 1,
                        roundScore: 0,
                        roundWon: false
                    })),
                    scrambleNumber: scrambleNumber,
                    sortingId: this.listOfTeams.length + 1
                };
                this.listOfTeams.push(newTeam);
            }

            // Mark the player as used
            player.isUsed = true;
        }

    }

    onScrambleNumberChange(scrambleNumber: number | 'new'): void {
        if (!this.selectedLeague) {
            console.error('No league selected. Cannot fetch teams for scramble number.');
            return;
        }

        if (scrambleNumber === 'new') {
            this.malePlayers1 = this.allMalePlayers.map(player => ({ ...player, isUsed: false }));
            this.femalePlayers1 = this.allFemalePlayers.map(player => ({ ...player, isUsed: false }));
            return;
        }


        this.playerService.getTeamsByScrambleNumber(this.selectedLeague.id, scrambleNumber).subscribe(
            (teams: Team[]) => {

                // Collect all player IDs already on teams
                const playersOnTeams = teams.reduce((ids, team) => ids.concat(team.players.map(player => player.id)), []);

                // Restore the original lists, set isUsed to false, and filter out players already on teams
                this.malePlayers1 = this.allMalePlayers
                    .map(player => ({ ...player, isUsed: false })) // Reset isUsed to false
                    .filter(player => !playersOnTeams.includes(player.id)); // Filter out players already on teams

                this.femalePlayers1 = this.allFemalePlayers
                    .map(player => ({ ...player, isUsed: false })) // Reset isUsed to false
                    .filter(player => !playersOnTeams.includes(player.id)); // Filter out players already on teams

            },
            (error) => {
                console.error('Error fetching teams:', error);
            }
        );

    }


    // Add a player to the selected list
    addPlayer(player: Player): void {
        if (!this.selectedPlayers.includes(player)) {
            this.selectedPlayers.push(player);
        }
    }

    // Remove a player from the selected list
    removePlayer(player: Player): void {
        this.selectedPlayers = this.selectedPlayers.filter(p => p.id !== player.id);
    }

    // Add a team to the list of teams
    addTeam(): void {
        const scrambleNumber = this.selectedScrambleNumber === 'new' ? 0 : this.selectedScrambleNumber;

        const newTeam: Team = {
            players: [...this.selectedPlayers],
            maleCount: this.selectedPlayers.filter(player => player.isMale).length,
            femaleCount: this.selectedPlayers.filter(player => !player.isMale).length,
            kingQueenTeamId: Math.random(), // Temporary ID for the team
            kingQueenRoundScores: this.rounds.map(roundId => ({
                id: 0,
                roundId,
                kingQueenTeamId: 0,
                roundScore: 0,
                roundWon: false,
            })),
            scrambleNumber: scrambleNumber,
            sortingId: this.listOfTeams.length + 1,// Increment sorting ID
        }; this.listOfTeams.push(newTeam);
        this.selectedPlayers.forEach(player => (player.isUsed = true)); // Mark players as used
        this.selectedPlayers = []; // Clear selected players after creating a team
    }

    // Update the score for a specific round
    updateRoundScore(team: Team, roundId: number, score: number): void {
        const roundScore = team.kingQueenRoundScores.find(r => r.roundId === roundId);
        if (roundScore) {
            roundScore.roundScore = score;
        }
    }

    updateRoundWon(team: Team, roundId: number, won: boolean): void {
        const roundScore = team.kingQueenRoundScores.find(r => r.roundId === roundId);
        if (roundScore) {
            roundScore.roundWon = won;
        }
    }


    getRoundScore(team: Team, roundId: number): number {
        const roundScore = team.kingQueenRoundScores.find(r => r.roundId === roundId);
        return roundScore ? roundScore.roundScore : 0;
    }

    getRoundWon(team: Team, roundId: number): boolean {
        const roundScore = team.kingQueenRoundScores.find(r => r.roundId === roundId);
        return roundScore ? roundScore.roundWon : false;
    }

    // Calculate the total score for a team
    calculateTotalScore(teamId: number): number {
        const team = this.listOfTeams.find(t => t.kingQueenTeamId === teamId);
        return team
            ? team.kingQueenRoundScores.reduce((total, round) => total + round.roundScore, 0)
            : 0;
    }

    // Calculate the total wins for a team
    calculateTotalWins(teamId: number): number {
        const team = this.listOfTeams.find(t => t.kingQueenTeamId === teamId);
        return team
            ? team.kingQueenRoundScores.filter(round => round.roundWon).length
            : 0;
    }

    ngOnChanges(changes: SimpleChanges): void {
        // Check if selectedLeagueDto has changed and has data
        if (changes['selectedLeagueDto'] && changes['selectedLeagueDto'].currentValue) {
            this.onLeagueSelect(changes['selectedLeagueDto'].currentValue);
        }
    }

}