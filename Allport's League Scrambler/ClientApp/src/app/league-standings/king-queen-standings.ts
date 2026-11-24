import {PlayerScoreGroup} from '../data-models/playerScoresResponse';
export interface KingQueenStandingsOptions {dropLowestNumber:number;numberOfSubsAllowed:number;subScorePercent:number;}
// Shared with Home. This is the existing standings transformation, including its tie breakers.
export function transformKingQueenStandings(input:PlayerScoreGroup[],options:KingQueenStandingsOptions,standingsType:'round'|'matchup', matchupWins?: Record<number, number>):PlayerScoreGroup[] {
            const output: PlayerScoreGroup[] = [];

            for (let i = 0; i < input.length; i++) {
                const player = input[i];

                const updatedScores: any[] = [];
                for (let j = 0; j < player.scores.length; j++) {
                    const s: any = player.scores[j];
                    const copy = { ...s, unadjustedScore: s.score, isDropped: false, isReduced: false };
                    updatedScores.push(copy);
                }

                const subScores: any[] = [];
                for (let j = 0; j < updatedScores.length; j++) {
                    const s: any = updatedScores[j];
                    if (s.isSubScore === true) {
                        subScores.push(s);
                    }
                }

                for (let j = 0; j < subScores.length; j++) {
                    const subScore = subScores[j];

                    let isReduced = false;
                    if (j >= options.numberOfSubsAllowed) {
                        isReduced = true;
                    }

                    let index = -1;
                    for (let k = 0; k < updatedScores.length; k++) {
                        if (updatedScores[k] === subScore) {
                            index = k;
                            break;
                        }
                    }

                    if (index !== -1) {
                        let newScore = updatedScores[index].score;

                        if (isReduced === true) {
                            newScore = (updatedScores[index].score * options.subScorePercent) / 100;
                        }

                        updatedScores[index] = {
                            ...updatedScores[index],
                            score: newScore,
                            isReduced: isReduced
                        };
                    }
                }

                const sortedByScore = [...updatedScores].sort((a, b) => a.score - b.score);

                const toDrop = sortedByScore.slice(0, options.dropLowestNumber);
                for (let j = 0; j < toDrop.length; j++) {
                    const dropItem = toDrop[j];

                    let dropIndex = -1;
                    for (let k = 0; k < updatedScores.length; k++) {
                        if (updatedScores[k] === dropItem) {
                            dropIndex = k;
                            break;
                        }
                    }

                    if (dropIndex !== -1) {
                        updatedScores[dropIndex] = { ...updatedScores[dropIndex], isDropped: true };
                    }
                }

                let totalScore = 0;
                let totalWins = 0;

                for (let j = 0; j < updatedScores.length; j++) {
                    const s: any = updatedScores[j];
                    if (s.isDropped !== true) {
                        totalScore = totalScore + s.score;

                        if (s.roundWon === true) {
                            totalWins = totalWins + 1;
                        }
                    }
                }

                let totalScoreBeforeReduction = 0;
                for (let j = 0; j < player.scores.length; j++) {
                    totalScoreBeforeReduction = totalScoreBeforeReduction + (player.scores[j] as any).score;
                }

                const updatedPlayer: any = {
                    ...player,
                    scores: updatedScores,
                    totalScore: totalScore,
                    totalWins: matchupWins ? (matchupWins[player.playerId] ?? 0) : totalWins,
                    totalScoreBeforeReduction: totalScoreBeforeReduction
                };

                output.push(updatedPlayer);
            }

            output.sort((a: any, b: any) => {
                if (standingsType === 'matchup') {
                    if (b.totalScore !== a.totalScore) {
                        return b.totalScore - a.totalScore;
                    }

                    if (b.totalScoreBeforeReduction !== a.totalScoreBeforeReduction) {
                        return b.totalScoreBeforeReduction - a.totalScoreBeforeReduction;
                    }

                    return b.totalWins - a.totalWins;
                } else {
                    if (b.totalScore !== a.totalScore) {
                        return b.totalScore - a.totalScore;
                    }

                    return b.totalWins - a.totalWins;
                }
            });

            return output;
        
}
