import { Component, OnInit } from '@angular/core';
import { KingQueenTeam } from '../data-models/kingQueenTeam.model';
import { LeagueService } from '../services/league.service';
import { PlayerService } from '../services/player.service';
import { Team } from '../data-models/teams.model';
import { KingQueenPlayer } from '../data-models/kingQueenPlayer.model';
import { Player } from '../data-models/player.model';
import { KingQueenRoundScore } from '../data-models/kingQueenRoundScore';

@Component({
  selector: 'app-kqmatchups',
  templateUrl: './kqmatchups.component.html',
  styleUrls: ['./kqmatchups.component.css']
})
export class KqmatchupsComponent implements OnInit {
    queriedScrambles: KingQueenTeam[] = new Array();
    retrievedListOfTeams: Team[] = new Array();
    selectedLeagueId: number;
    leagueName: string;
    listOfTeams: Team[] = new Array();
    listOfRetrievedScrambleNumbers: number[] = [];
    selectedRounds: number = 5; // Default to 5 rounds
    byePlayers: Player[] = new Array();
    rounds: number[] = [];
    kingQueenRoundScores: KingQueenRoundScore[] = [];
    constructor(
        public leagueService: LeagueService,
        public playerService: PlayerService
    ) { }

    ngOnInit() {

        // Subscribe to selected league changes
        this.leagueService.selectedLeague$.subscribe((selectedLeague) => {
            this.selectedLeagueId = selectedLeague.leagueId;
            this.leagueName = selectedLeague.leagueName;
            this.playerService.SelectedLeagueScrambles(selectedLeague.leagueName).subscribe((result) => {
                this.queriedScrambles = result;
            });

        });
    }

    getSortedScores(scores: KingQueenRoundScore[]): KingQueenRoundScore[] {
        // Return a sorted copy, so we don't mutate the original array
        return [...scores].sort((a, b) => a.roundId - b.roundId);
    }

    initializeRounds(): void {
        this.rounds = Array.from({ length: this.selectedRounds }, (_, index) => index + 1);
    }

    initializeScores(): void {
        this.kingQueenRoundScores = []; // Reset the array

        for (const team of this.retrievedListOfTeams) {

            if (team.kingQueenRoundScores && team.kingQueenRoundScores.length > 0) {
                // Use existing scores if they exist
                for (let kingQueenRoundScore of team.kingQueenRoundScores) {
                    this.kingQueenRoundScores.push({
                        id: kingQueenRoundScore.id,
                        roundId: kingQueenRoundScore.roundId,
                        kingQueenTeamId: kingQueenRoundScore.kingQueenTeamId,
                        roundScore: kingQueenRoundScore.roundScore,
                        roundWon: kingQueenRoundScore.roundWon
                    });
                }
            } else {
                // Create new scores if none exist
                for (let roundIndex = 0; roundIndex < this.selectedRounds; roundIndex++) {
                    this.kingQueenRoundScores.push({
                        id: 0, // Default for new scores
                        roundId: roundIndex + 1,
                        kingQueenTeamId: team.kingQueenTeamId,
                        roundScore: 0,
                        roundWon: false
                    });
                }
            }
        }

    }

    getTeamPairs(): Team[][] {
        const pairs: Team[][] = [];
        for (let i = 0; i < this.retrievedListOfTeams.length; i += 2) {
            pairs.push(this.retrievedListOfTeams.slice(i, i + 2));
        }
        return pairs;
    }

    retrieveScramble(scramble: KingQueenTeam) {
        this.retrievedListOfTeams = [];

        this.playerService.getKingQueenTeamsByScrambleNumber(this.leagueName, scramble.scrambleNumber).subscribe(
            (response) => {
                // Initialize your list of teams
                this.listOfTeams = [];
                this.listOfRetrievedScrambleNumbers = [];
                let matchups = response.kingQueenTeams;
                if (matchups.length > 0 && matchups[0].kingQueenTeam.kingQueenRoundScores) {
                    this.selectedRounds = matchups[0].kingQueenTeam.kingQueenRoundScores.length;
                }
                // Map the retrieved matchups into listOfTeams
                matchups.forEach((matchup) => {
                    matchup.players.forEach((player) => {
                        // kingQueenPlayers might be null/undefined, so default to empty array
                        const kqPlayers = matchup.kingQueenTeam.kingQueenPlayers || [];

                        let matchingKQPlayer: KingQueenPlayer | null = null;
                        for (const kqp of kqPlayers) {
                            if (kqp.playerId === player.id) {
                                matchingKQPlayer = kqp;
                                break; // Stop once we find the match
                            }
                        }

                        if (matchingKQPlayer) {
                            player.isSubScore = matchingKQPlayer.isSubScore;
                        }
                    });

                    // 2. Build your Team object now that each Player is updated
                    const team: Team = {
                        players: matchup.players,
                        maleCount: matchup.players.filter((player) => player.isMale).length,
                        femaleCount: matchup.players.filter((player) => !player.isMale).length,
                        kingQueenRoundScores: matchup.kingQueenTeam.kingQueenRoundScores,
                        kingQueenTeamId: matchup.kingQueenTeam.id,
                        scrambleNumber: null,
                        sortingId: null
                    };

                    // 3. Push the team into your list
                    this.listOfTeams.push(team);
                    this.retrievedListOfTeams.push(team);
                });
                this.byePlayers = response.byePlayers;

                this.listOfRetrievedScrambleNumbers.push(scramble.scrambleNumber);
                // Initialize rounds and scores after data is fully loaded
                this.initializeRounds();
                this.initializeScores();
            },
            (error) => {
                // Handle any errors
                console.error('Error retrieving matchups:', error);
            }
        );
    }

}
