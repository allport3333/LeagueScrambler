import {KingQueenTeam} from '../data-models/kingQueenTeam.model';
import {scheduleDateKey} from '../player-next-game/next-game-selection';

// SelectedLeagueScrambles is already scoped to finalized saved records. Be
// defensive about explicit unsaved placeholders, without inventing future weeks.
export function savedMatchupWeeks(rows:KingQueenTeam[]):KingQueenTeam[] {
 return (Array.isArray(rows)?rows:[]).filter((row:any)=>row && row.id>0 &&
  Number.isInteger(row.scrambleNumber) && row.scrambleNumber>0 && row.scrambleWithScoresToBeSaved!==false);
}

function savedDate(row:KingQueenTeam):string {
  const value:any=row.dateOfTeam;
  if(value instanceof Date && !isNaN(value.getTime()))return [value.getFullYear(),('0'+(value.getMonth()+1)).slice(-2),('0'+value.getDate()).slice(-2)].join('-');
  const key=scheduleDateKey(value);return key && !key.startsWith('0001-')?key:'';
}

export function compareSavedMatchupWeeks(a:KingQueenTeam,b:KingQueenTeam):number {
 return savedDate(a).localeCompare(savedDate(b)) || a.scrambleNumber-b.scrambleNumber || a.id-b.id;
}

export function latestSavedMatchupWeek(rows:KingQueenTeam[]):KingQueenTeam|null {
 return savedMatchupWeeks(rows).slice().sort((a,b)=>compareSavedMatchupWeeks(b,a))[0] || null;
}
