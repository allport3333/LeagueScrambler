$ErrorActionPreference='Stop'
$repo=Split-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) -Parent
$models=Join-Path $repo "Allport's League Scrambler/Models"
$paths=@('Player.cs','LeagueTeam.cs','LeagueTeamPlayer.cs','LeagueTeamScore.cs','PlayerProfileStatistics.cs') | ForEach-Object {Join-Path $models $_}
# Windows PowerShell's compiler predates nameof; normalize only that model attribute
# spelling in memory. The production calculation helper itself is compiled unchanged.
$source='using System; using System.Collections.Generic; using System.Linq; using System.Threading.Tasks; using System.ComponentModel.DataAnnotations.Schema;'+[Environment]::NewLine
foreach($file in $paths){$unit=[IO.File]::ReadAllText($file);$unit=[regex]::Replace($unit,'(?m)^\s*using [^;]+;','');$unit=[regex]::Replace($unit,'nameof\((\w+)\)','"$1"');$source+=$unit+[Environment]::NewLine}
Add-Type -TypeDefinition $source -ReferencedAssemblies System.Core,System.ComponentModel.DataAnnotations
function Team($id,$league,$name){New-Object Allport_s_League_Scrambler.Models.LeagueTeam -Property @{Id=$id;LeagueID=$league;TeamName=$name}}
function Member($team,$player){New-Object Allport_s_League_Scrambler.Models.LeagueTeamPlayer -Property @{LeagueTeamId=$team;PlayerId=$player}}
function Person($id,$name){New-Object Allport_s_League_Scrambler.Models.Player -Property @{Id=$id;FirstName=$name;LastName='Synthetic'}}
function Game($id,$team,$opponent,$points,$won,$day){New-Object Allport_s_League_Scrambler.Models.LeagueTeamScore -Property @{Id=$id;LeagueTeamId=$team;OpponentsLeagueTeamId=$opponent;TeamScore=$points;WonGame=$won;Date=[datetime]('2026-01-'+$day)}}
function Equal($actual,$expected,$message){if($actual -ne $expected){throw "$message expected $expected, got $actual"}}
$teams=[Allport_s_League_Scrambler.Models.LeagueTeam[]]@((Team 10 1 'Team A'),(Team 11 1 'Team B'),(Team 12 1 'Opponent X'),(Team 13 1 'Opponent Y'),(Team 14 1 'Solo'),(Team 20 2 'Foreign team'),(Team 21 2 'Foreign opponent'),(Team 30 1 'No games'))
$members=[Allport_s_League_Scrambler.Models.LeagueTeamPlayer[]]@((Member 10 1),(Member 10 1),(Member 10 2),(Member 10 2),(Member 10 3),(Member 11 1),(Member 11 2),(Member 11 4),(Member 20 1),(Member 20 9),(Member 14 5),(Member 30 6),(Member 30 7))
$people=[Allport_s_League_Scrambler.Models.Player[]]@((Person 1 'Player'),(Person 2 'Partner'),(Person 3 'Alex'),(Person 4 'Alex'),(Person 5 'Solo'),(Person 6 'NoGames'),(Person 7 'NoGamesPartner'),(Person 9 'Foreign'))
$games=[Allport_s_League_Scrambler.Models.LeagueTeamScore[]]@((Game 101 10 12 12 $false '01'),(Game 100 10 12 21 $true '01'),(Game 102 11 13 21 $true '08'),(Game 103 11 12 18 $false '09'),(Game 200 20 21 99 $true '10'),(Game 201 12 10 7 $false '01'),(Game 104 14 12 0 $false '11'),(Game 100 10 12 21 $true '01'))
$result=[Allport_s_League_Scrambler.Models.PlayerProfileStatistics]::Combined(1,1,$teams,$members,$games,$people)
Equal $result.TotalGames 4 'Unique own saved games';Equal $result.TotalScores 72 'Raw points';Equal $result.TotalWins 2 'Wins';Equal $result.TotalLosses 2 'Losses';Equal $result.AverageScore 18 'Average';Equal $result.HighestScore 21 'High';Equal $result.LowestScore 12 'Low';Equal $result.WinPercentage 50 'Win percentage';Equal $result.LongestWinStreak 1 'Stable streak';Equal $result.LongestLossStreak 1 'Loss streak'
Equal @($result.TeammateStats).Count 3 'Distinct Player IDs';Equal @($result.TeammateStats | Where-Object PlayerName -eq 'Alex Synthetic').Count 2 'Namesakes retained';Equal @($result.TeammateStats | Where-Object PlayerId -in @(1,9)).Count 0 'No self or foreign teammate'
$partner=$result.TeammateStats | Where-Object PlayerId -eq 2;Equal $partner.TimesPlayedTogether 4 'Games across shared teams/weeks';Equal $partner.WinsTogether 2 'Wins across shared teams/weeks'
$opponent=$result.OpponentStats | Where-Object OpponentTeamId -eq 12;Equal $opponent.GamesPlayed 3 'Opponent includes all own teams';Equal $opponent.Wins 1 'Own wins, not opponent wins';Equal $opponent.TotalPointsScored 51 'Own points against opponent';Equal $opponent.AveragePointsPerGame 17 'Own opponent average'
$foreign=[Allport_s_League_Scrambler.Models.PlayerProfileStatistics]::Combined(1,2,$teams,$members,$games,$people);Equal $foreign.TotalGames 1 'Other league isolated';Equal $foreign.TeammateStats[0].PlayerId 9 'Other league teammate'
$empty=[Allport_s_League_Scrambler.Models.PlayerProfileStatistics]::Combined(99,1,$teams,$members,$games,$people);Equal $empty.TotalGames 0 'Empty';Equal @($empty.TeammateStats).Count 0 'No teammates'
$solo=[Allport_s_League_Scrambler.Models.PlayerProfileStatistics]::Combined(5,1,$teams,$members,$games,$people);Equal $solo.TotalGames 1 'Saved zero game';Equal $solo.TotalScores 0 'Saved zero score';Equal @($solo.TeammateStats).Count 0 'Solo player'
$unplayed=[Allport_s_League_Scrambler.Models.PlayerProfileStatistics]::Combined(6,1,$teams,$members,$games,$people);Equal $unplayed.TeammateStats[0].TimesPlayedTogether 0 'Calculated zero recorded games for co-rostered players'
function Round($score,$team,$week,$number,$points,$won,$day){New-Object Allport_s_League_Scrambler.Models.ProfileRound -Property @{ScoreId=$score;Id=$team;ScrambleNumber=$week;RoundNumber=$number;RoundScore=$points;RoundWon=$won;DateOfTeam=[datetime]('2026-01-'+$day)}}
function KqMember($team,$week,$id,$name){New-Object Allport_s_League_Scrambler.Models.ProfileMember -Property @{Id=$team;ScrambleNumber=$week;PlayerId=$id;PlayerName=$name;IsMale=($id % 2 -ne 0)}}
$rounds=[Allport_s_League_Scrambler.Models.ProfileRound[]]@((Round 1 101 41 1 21 $true '01'),(Round 2 101 41 2 0 $false '01'),(Round 3 102 77 1 15 $true '08'),(Round 4 103 77 1 20 $true '08'),(Round 5 104 88 1 18 $null '15'),(Round 6 104 88 2 9 $false '15'),(Round 1 101 41 1 21 $true '01'))
$kqMembers=[Allport_s_League_Scrambler.Models.ProfileMember[]]@((KqMember 101 41 2 'Partner Synthetic'),(KqMember 101 41 2 'Partner Synthetic'),(KqMember 101 41 1 'Self'),(KqMember 102 77 2 'Partner Synthetic'),(KqMember 102 77 3 'Alex Synthetic'),(KqMember 103 77 2 'Partner Synthetic'),(KqMember 103 77 4 'Alex Synthetic'),(KqMember 104 88 2 'Partner Synthetic'))
$kq=[Allport_s_League_Scrambler.Models.PlayerProfileStatistics]::KingQueen(1,$rounds,$kqMembers);Equal $kq.TotalScores 83 'KQ raw total';Equal $kq.TotalWins 3 'KQ won rounds';Equal @($kq.IndividualRounds).Count 6 'Unique saved round IDs';Equal @($kq.ScrambleTotals).Count 3 'Recorded scrambles';$kp=$kq.TeammateCounts | Where-Object PlayerId -eq 2;Equal $kp.Count 3 'KQ times is scrambles, not games';Equal $kp.WinsTogether 3 'KQ wins is saved winning rounds';Equal @($kq.ScrambleTotals[1].Team).Count 3 'Week roster unique by ID and namesakes separate'

# Completed games are saved positive IDs with score, date and distinct same-league opponents.
# This schema has no nullable score, pending flag or draw result: false is a loss under existing rules.
$thirtyThree=[Allport_s_League_Scrambler.Models.LeagueTeamScore[]]@(1..33 | ForEach-Object {Game (500+$_) 10 12 21 ($_ -le 19) '01'})
$example=[Allport_s_League_Scrambler.Models.PlayerProfileStatistics]::Combined(1,1,$teams,$members,$thirtyThree,$people)
Equal $example.TotalGames 33 '33 games';Equal $example.TotalWins 19 '19 wins';Equal $example.TotalLosses 14 '14 losses';Equal ($example.TotalWins+$example.TotalLosses) $example.TotalGames 'Consistent totals'
foreach($won in @($true,$false)){
 $set=[Allport_s_League_Scrambler.Models.LeagueTeamScore[]]@((Game 600 10 12 0 $won '01'),(Game 601 10 12 21 $won '01'),(Game 602 10 12 12 $won '01'))
 $r=[Allport_s_League_Scrambler.Models.PlayerProfileStatistics]::Combined(1,1,$teams,$members,$set,$people)
 Equal $r.TotalGames 3 'Three games on one day';Equal $r.TotalWins $(if($won){3}else{0}) 'All wins/all losses';Equal $r.TotalLosses $(if($won){0}else{3}) 'Numeric zero loss/win'
 Equal ($r.TeammateStats|Where-Object PlayerId -eq 2).TimesPlayedTogether 3 'Partner three games';Equal ($r.TeammateStats|Where-Object PlayerId -eq 2).WinsTogether $(if($won){3}else{0}) 'Partner wins including zero'
}
$three=[Allport_s_League_Scrambler.Models.LeagueTeamScore[]]@((Game 610 10 12 21 $true '01'),(Game 611 10 12 21 $true '01'),(Game 612 10 12 0 $false '01'),(Game 610 10 12 21 $true '01'))
$r=[Allport_s_League_Scrambler.Models.PlayerProfileStatistics]::Combined(1,1,$teams,$members,$three,$people)
Equal $r.TeammateStats[0].TimesPlayedTogether 3 'Three unique saved IDs';Equal $r.TeammateStats[0].WinsTogether 2 'Two recorded wins'
$invalid=Game 0 10 12 0 $false '01';$missingDate=Game 700 10 12 1 $false '01';$missingDate.Date=[datetime]::MinValue
$bad=[Allport_s_League_Scrambler.Models.LeagueTeamScore[]]@($invalid,$missingDate,(Game 701 10 12 -1 $false '01'),(Game 702 10 20 21 $true '01'),(Game 703 10 10 21 $true '01'))
$r=[Allport_s_League_Scrambler.Models.PlayerProfileStatistics]::Combined(1,1,$teams,$members,$bad,$people)
Equal $r.TotalGames 0 'No completed valid records';Equal $r.TotalLosses 0 'No games zero losses';Equal $r.TotalWins 0 'No games zero wins';Equal $r.WinPercentage 0 'No games percent';Equal $r.TeammateStats[0].TimesPlayedTogether 0 'No unsaved or invalid shared games'
$tied=[Allport_s_League_Scrambler.Models.LeagueTeamScore[]]@((Game 710 10 12 15 $false '01'),(Game 711 12 10 15 $false '01'))
$r=[Allport_s_League_Scrambler.Models.PlayerProfileStatistics]::Combined(1,1,$teams,$members,$tied,$people)
Equal $r.TotalGames 1 'Saved tie';Equal $r.TotalLosses 1 'Existing tie rule is nonwin/loss';Equal $r.TotalWins 0 'Tie not won'
$target=Join-Path (Split-Path $PSScriptRoot -Parent) 'player-profile-evidence';New-Item -ItemType Directory -Path $target -Force | Out-Null
$fixture=@{combined=$result;example33=$example;kingQueen=$kq;foreign=$foreign;empty=$empty;solo=$solo;unplayed=$unplayed;teamScores=@($games | Where-Object {$_.LeagueTeamId -in @(10,11)} | Group-Object Id | ForEach-Object {$g=$_.Group[0];@{scoreId=$g.Id;date=$g.Date.ToString('s');teamScore=$g.TeamScore;wonGame=$g.WonGame;opponentTeam=($teams | Where-Object Id -eq $g.OpponentsLeagueTeamId).TeamName}})}
[IO.File]::WriteAllText((Join-Path $target 'calculation-fixtures.json'),($fixture|ConvertTo-Json -Depth 18),[Text.UTF8Encoding]::new($false))
@{passed=12;failed=0;databaseAccess=$false;groups=@('duplicate memberships and score-ID joins','distinct IDs/namesakes/self/league scope','regular shared games/wins','opponent own-perspective/all teams','empty/solo/co-rostered zero','raw KQ scores/nullable wins','KQ week frequency and score-ID wins','33 games 19 wins 14 losses','all wins and all losses with zero values','three games same day two wins','unsaved invalid or missing-date records excluded','ties preserve existing recorded nonwin rule')}|ConvertTo-Json -Depth 5|Set-Content (Join-Path $target 'calculation-results.json')
'12 calculation regression groups passed; no SQL accessed.'
