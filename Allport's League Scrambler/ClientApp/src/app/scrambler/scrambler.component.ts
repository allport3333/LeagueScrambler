import { injectConfirmation } from '../confirmation-dialog';
import { protectPendingWork } from '../pwa/pending-work.service';
import { LeaguePlayerEditComponent } from '../league-management/player-management-dialogs.component';
import { Component, Inject, Input, OnInit, OnChanges, OnDestroy, SimpleChanges, TemplateRef, ElementRef, ViewChild, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSelectionListChange } from '@angular/material/list';
import { MatTabGroup, MatTabChangeEvent } from '@angular/material/tabs';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { Player } from '../data-models/player.model';
import { PlayerService } from '../services/player.service';
import { UntypedFormGroup, UntypedFormControl, Validators } from '@angular/forms';

import { Team } from '../data-models/teams.model';
import { Leagues } from '../data-models/leagues.model';
import { Gender } from '../data-models/gender.model';
import { AuthService } from '../auth.service';
import { KingQueenTeam } from '../data-models/kingQueenTeam.model';
import { KingQueenTeamWithPlayers } from '../data-models/KingQueenTeamWithPlayers.model';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';
import { LoginService } from '../services/login.service';
import { KingQueenRoundScoresResponse } from '../data-models/kingQueenRoundScoresResponse';
import { KingQueenRoundScore } from '../data-models/KingQueenRoundScore';
import { KingQueenRoundScoresRequest } from '../data-models/kingQueenRoundScoresRequest';
import { PlayerScoreGroup, PlayerScoresResponse } from '../data-models/playerScoresResponse';
import { KingQueenPlayer } from '../data-models/kingQueenPlayer.model';
import { LeagueService } from '../services/league.service';
import { ExistingPlayerBrowserComponent } from '../league-management/existing-player-browser.component';
import { PlayerImportComponent } from '../league-management/player-import.component';
import { KingQueenTeamsResponse } from '../data-models/kingQueenTeamsResponse';
import { Subject, Observable, forkJoin, of, Subscription, combineLatest, switchMap } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { timeout } from 'rxjs/operators';
import { generateScramble as runScrambleV2, rankTopPlayers, capacitiesFor, historyIndex, pairKey, validateAllocation, ScrambleInput, ScrambleResult, ScrambleIssue, TopPriority } from './scramble-engine';
@Component({
    selector: 'app-scrambler-component',
    templateUrl: './scrambler.component.html',
    styleUrls: ['./scrambler.component.less'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class ScramblerComponent implements OnInit, OnChanges, OnDestroy {
    prioritizePreviousTeammates = false;
    allowMinimumRepeats = false;
    generationBusy = false;
    generationFeedback = '';
    generationResult: ScrambleResult = null;
    // Latest attempt diagnostics are separate from the result belonging to the
    // displayed teams, which must remain valid for saving after a failed retry.
    generationAttempt: Pick<ScrambleResult, 'status' | 'reason' | 'repeatedPairs' | 'demotedTopIds' | 'historyCost' | 'issues'> = null;
    get generationReport() {
        return !this.generationBusy && this.generationAttempt && this.generationAttempt.issues.length ? this.generationAttempt : null;
    }
    private generationProblem(reason: string, code: ScrambleIssue['code'] = 'service-error'): void {
        this.generationAttempt = { status: code === 'inputs-changed' ? 'invalid-configuration' : 'unexpected-error', reason,
            repeatedPairs: [], demotedTopIds: [], historyCost: 0, issues: [{ code, message: reason }] };
    }
    configuredTopPriorities: TopPriority[] = [];
    private generationVersion = 0;
    private generatedInput: ScrambleInput = null;
    private generatedLeagueId: number = null;
    private generatedConfiguration = '';

    private generationSignature(): string {
        return JSON.stringify({league:this.leagueId,players:this.selectedList.map(p=>[p.id,p.isMale,p.isByePlayer,p.isTopPlayer,p.isLowPlayer]),
            tops:this.displayTopPlayers.map(p=>p.id),lows:this.displayLowPlayers.map(p=>p.id),size:this.teamSize,teams:this.numberOfTeams,
            random:this.completeRandom,history:this.prioritizePreviousTeammates,fallback:this.allowMinimumRepeats,selected:this.listOfScrambleNumbers});
    }

    private updateConfigurationSignature(): string {
        return JSON.stringify([this.generationSignature(), this.teamConfigurationMode,
            this.rememberedTeamSize, this.rememberedTeamCount, this.lockedResults]);
    }

    private hasPendingScrambleConfiguration(): boolean {
        if (this.workspaceSection !== 'scrambler') return false;
        if (this.isScrambleSaved && this.generatedInput) {
            return this.updateConfigurationSignature() !== this.generatedConfiguration;
        }
        return this.selectedList.length > 0 || this.teamConfigurationMode !== 'size' ||
            this.rememberedTeamSize !== 4 || this.rememberedTeamCount !== null ||
            this.enabledScrambleRuleCount > 0 || this.listOfScrambleNumbers.length > 0;
    }
    private async loadGenerationTopPriorities(leagueId:number): Promise<TopPriority[]> {
        const rows=await this.playerService.getTopPlayersForLeague(leagueId,0).pipe(timeout(15000)).toPromise();
        if(!Array.isArray(rows)||rows.some(p=>!p||!Number.isInteger(p.id)||p.id<=0))throw new Error('Top player priority data is unavailable.');
        const priorities=rows.map(p=>({playerId:p.id,rank:p.rank}));
        if(this.leagueId===leagueId)this.configuredTopPriorities=priorities;
        return priorities;
    }
    private currentGenerationCount(): number {
        return capacitiesFor(this.selectedList.filter(p=>!p.isByePlayer).length,this.teamSize,this.numberOfTeams).length;
    }
    generationPlayerName(id:number):string {
        const player=this.selectedList.find(p=>p.id===id)||this.listOfTeams.reduce((all,t)=>all.concat(t.players),[] as Player[]).find(p=>p.id===id);
        return player?((player.firstName||'')+' '+(player.lastName||'')).trim():'Player '+id;
    }

    async scramblePlayers(nonDuplicates:boolean=false): Promise<void> {
        if(this.generationBusy||this.teamSaveBusy)return;
        if (!this.teamSize && !this.numberOfTeams) {
            this.generationProblem('Choose the number of teams before scrambling.', 'inputs-changed');
            return;
        }
        if(this.lockedResults&&this.locked){this.showSnackBar('Results are currently locked. Please uncheck lock results to rescramble.');return;}
        if(!await this.confirmWorkspaceChanges(true, !!this.scoringScramble))return;
        const leagueId=this.leagueId,leagueName=this.selectedLeague,signature=this.generationSignature(),version=++this.generationVersion;
        this.generationBusy=true;this.generationAttempt=null;this.generationFeedback='Generating and validating teams...';
        try {
            if(leagueId&&this.selectedList.some(p=>!this.queriedPlayers.some(member=>member.id===p.id)))
                throw new Error('Wait for this league roster to load and select its eligible players.');
            const selected=this.selectedList.slice(),topIds=Array.from(new Set(this.displayTopPlayers.map(p=>p.id).concat(selected.filter(p=>p.isTopPlayer).map(p=>p.id)))),lowIds=Array.from(new Set(this.displayLowPlayers.map(p=>p.id).concat(selected.filter(p=>p.isLowPlayer).map(p=>p.id))));
            const input:ScrambleInput={players:selected.map(p=>({...p})),mode:this.completeRandom?'random':'balanced',maxTeamSize:this.teamSize,numberOfTeams:this.numberOfTeams,
                topIds,lowIds,configuredTop:[],standings:[...(this.maleStandings||[]),...(this.femaleStandings||[])],prioritizeHistory:this.prioritizePreviousTeammates,allowMinimumRepeats:this.allowMinimumRepeats,
                cancelled:()=>version!==this.generationVersion||this.scoreDestroyed};
            if(!this.completeRandom&&topIds.length)input.configuredTop=await this.loadGenerationTopPriorities(leagueId);
            const numbers=Array.from(new Set(this.listOfScrambleNumbers.length?this.listOfScrambleNumbers:nonDuplicates?this.listOfRetrievedScrambleNumbers:[]));
            if(nonDuplicates&&!numbers.length)throw new Error('Select saved previous scrambles before requesting strict teammate avoidance.');
            if(numbers.length){
                if(!leagueId||numbers.some(n=>!Number.isInteger(n)||n<0))throw new Error('Selected historical scramble identities are invalid.');
                const response=await this.playerService.getMultipleKingQueenTeamsByScrambleNumbers(leagueName,numbers).pipe(timeout(15000)).toPromise();
            if(!response||!Array.isArray(response.kingQueenTeams))throw new Error('Selected scramble history could not be loaded.');
                const index=historyIndex(leagueId,response.kingQueenTeams.map(row=>({leagueId:row.kingQueenTeam.leagueID,teamId:row.kingQueenTeam.id,scrambleNumber:row.kingQueenTeam.scrambleNumber,saved:(row.kingQueenTeam as any).scrambleWithScoresToBeSaved===true,playerIds:(row.players||[]).map(p=>p.id)})));
                if(numbers.some(n=>index.scrambles.indexOf(n)<0))throw new Error('A selected scramble has no reliable saved team history. Retrieve a saved scramble or clear that selection.');
                input.prohibitedPairs=index.frequencies.map(p=>pairKey(p.player1Id,p.player2Id));
            }
            if(input.prioritizeHistory){
                if(!leagueId)throw new Error('Select a league before loading teammate history.');
                const history=await this.playerService.getTeammateHistory(leagueId).pipe(timeout(15000)).toPromise();
                if(!history||history.leagueId!==leagueId||!Array.isArray(history.pairs))throw new Error('League teammate history could not be loaded. No zero-history assumption was made.');
                input.frequencies=history.pairs;
            }
            if(version!==this.generationVersion)return;
            const result=await runScrambleV2(input);
            if(version!==this.generationVersion)return;
            if(this.generationSignature()!==signature){this.generationFeedback='Inputs changed during generation. Previous results are unchanged; please scramble again.';this.generationProblem(this.generationFeedback,'inputs-changed');return;}
            this.generationAttempt=result;
            if(result.status!=='success'){this.generationFeedback=result.reason+' No new scramble was saved; previous results are unchanged.';this.showSnackBar(result.reason,true);return;}
            const teams:Team[]=result.teams.map((players,index)=>({players:players.map(p=>selected.find(original=>original.id===p.id)),maleCount:players.filter(p=>p.isMale).length,femaleCount:players.filter(p=>!p.isMale).length,
                kingQueenTeamId:0,kingQueenRoundScores:[],scrambleNumber:null,sortingId:index+1}));
            let number=0;
            if(this.isActionAllowed){
                const body:KingQueenTeamsResponse={kingQueenTeams:teams.map(team=>({kingQueenTeam:{id:0,leagueID:0,dateOfTeam:new Date(),kingQueenPlayers:[],scrambleNumber:0,scrambleWithScoresToBeSaved:false,kingQueenRoundScores:[]},players:team.players})),byePlayers:[]};
                const created=await this.playerService.generateScramble(leagueName,body).toPromise();
                if(!created||created.length!==teams.length||created.some(t=>!t||!(t.id>0))||new Set(created.map(t=>t.id)).size!==teams.length||created.some(t=>t.scrambleNumber!==created[0].scrambleNumber))throw new Error('The server did not confirm the complete scramble. Previous results are unchanged.');
                if(version!==this.generationVersion||this.leagueId!==leagueId)return;
                if(this.generationSignature()!==signature){this.generationFeedback='Inputs changed during generation. Please scramble again.';this.generationProblem(this.generationFeedback,'inputs-changed');return;}
                number=created[0].scrambleNumber;created.forEach((team,index)=>teams[index].kingQueenTeamId=team.id);
            }
            if(this.scoringScramble)this.clearScoreEditor();
            this.savedPrintSignature=null;this.teamSaveFeedback='';this.teamEditingSnapshot=null;this.showTeamSorting=false;this.scrambleSelected=false;this.showSaveRoundScores=false;
            this.listOfTeams=teams;this.byePlayers=result.byes.map(p=>selected.find(original=>original.id===p.id));this.teamCount=teams.length;this.scrambleNumber=number;
            this.topPlayerCount=result.retainedTopIds.length;this.lowPlayerCount=lowIds.filter(id=>topIds.indexOf(id)<0).length;this.generationResult=result;this.generatedInput=input;this.generatedLeagueId=leagueId;
            this.generatedConfiguration = this.updateConfigurationSignature();
            this.locked=this.lockedResults;this.resultsCollapsed=false;this.generationFeedback='';
            if(!this.isActionAllowed)this.generationFeedback='Preview only. Saving requires management access to this league.';
            this.announceGeneratedScramble();this.revealScrambleResults();this.cdr.detectChanges();
        }catch(error){if(version===this.generationVersion){this.generationFeedback=(error&&error.message&&!(error.status)?error.message:'History or generation service is unavailable. Please retry.')+' No new scramble was saved; your selections and previous results are retained.';this.generationProblem(this.generationFeedback);this.showSnackBar(this.generationFeedback,true);}}
        finally{if(version===this.generationVersion){this.generationBusy=false;this.cdr.detectChanges();}}
    }

    scoringScramble: KingQueenTeam = null;
    mobileScoreMatchIndex = 0;
    scoreEditorLoading = false;
    scoreListLoading = false;
    scoreListError = '';
    private scoreListReader: Subscription;
    private manageScoresActive = false;
    private scoreReopenLatest = false;
    private scoreTeams: Team[] = [];
    scoreByePlayers: Player[] = [];
    scoreRoundCount = 5;
    scoreRounds: number[] = [];
    onScoreRoundsChange(count: number): void {
        this.scoreRoundCount = count;
        this.scoreRounds = Array.from({ length: count }, (_, index) => index + 1);
    }
    scoreSaveBusy = false;
    scoreRefreshRequired = false;
    scoreEditorFeedback = '';
    scoreSubPending: {[key:string]:boolean} = {};
    @ViewChild('scoreScramblePicker') scoreScramblePicker:any;
    private scoreSnapshot:string=null;
    private scoreVersion=0;
    private scoreReader:Subscription;
    private scoreSaver:Subscription;
    private scoreRestoreLeague=false;
    private scoreDestroyed=false;
    private scoreSignature():string { return JSON.stringify({rounds:this.scoreRoundCount,scores:this.kingQueenRoundScores.map(row=>[row.kingQueenTeamId,row.roundId,row.roundScore===null||String(row.roundScore).trim()===''?null:Number(row.roundScore),row.roundWon])}); }
    get scoreEditsPending():boolean { return this.scoreSnapshot!==null&&this.scoreSignature()!==this.scoreSnapshot; }
    get scoreHiddenRounds():boolean {return this.kingQueenRoundScores.some(row=>row.roundId>this.scoreRoundCount);}
    get scoreSubBusy():boolean { return Object.keys(this.scoreSubPending).some(key=>this.scoreSubPending[key]); }
    trackScorePair(index:number,pair:Team[]):number {return pair[0].kingQueenTeamId;}
    trackScoreRoundGroup(index:number,group:number[]):number {return group[0];}
    get desktopScoreRoundGroups():number[][] {const groups:number[][]=[];for(let index=0;index<this.scoreRounds.length;index+=5)groups.push(this.scoreRounds.slice(index,index+5));return groups;}
    get mobileScorePairs():Team[][] { const pairs:Team[][]=[];const teams=this.scoringScramble?this.scoreTeams:this.listOfTeams;for(let i=0;i<teams.length;i+=2)pairs.push(teams.slice(i,i+2));return pairs; }
    get mobileScorePair():Team[] { return this.mobileScorePairs[this.mobileScoreMatchIndex]||[]; }
    selectScoreMatch(index:number):void { if(index>=0&&index<this.mobileScorePairs.length)this.mobileScoreMatchIndex=index; }
    compareScoreScrambles = (first: KingQueenTeam, second: KingQueenTeam): boolean =>
        first === second || (!!first && !!second && first.id === second.id);
    async requestScoreScramble(scramble:KingQueenTeam,selector:any):Promise<void> {
        if(!await this.retrieveScramble(scramble))selector.writeValue(this.scoringScramble);
    }
    private readonly confirmAction = injectConfirmation();
    private leagueChangeVersion = 0;

    private async confirmWorkspaceChanges(teams: boolean, scores: boolean): Promise<boolean> {
        if ((teams && this.teamSaveBusy) || (scores && (this.scoreSaveBusy || this.scoreSubBusy))) {
            this.scoreEditorFeedback = 'Wait for the current save to finish.';
            return false;
        }
        const version = this.generationVersion;
        const scoreVersion = this.scoreVersion;
        const leagueChange = this.leagueChangeVersion;
        const lost = [];
        if (teams && this.teamEditsPending) lost.push('Unsaved team and court changes will be discarded.');
        if (scores && this.scoreEditsPending) lost.push('Unsaved round scores and win flags will be discarded. Saved substitute changes are kept.');
        if (lost.length && !await this.confirmAction({
            title: 'Discard unsaved changes', message: lost.join(' '), action: 'Discard changes', tone: 'danger'
        })) return false;
        if (this.scoreDestroyed || version !== this.generationVersion || scoreVersion !== this.scoreVersion ||
            leagueChange !== this.leagueChangeVersion ||
            (teams && this.teamSaveBusy) || (scores && (this.scoreSaveBusy || this.scoreSubBusy))) return false;
        if (teams) this.cancelTeamEditing();
        return true;
    }
    private clearScoreEditor():void {
        this.scoreVersion++;if(this.scoreReader)this.scoreReader.unsubscribe();this.scoreEditorLoading=false;this.scoringScramble=null;this.scoreTeams=[];this.scoreSnapshot=null;this.scoreRefreshRequired=false;this.scoreEditorFeedback='';this.mobileScoreMatchIndex=0;
        this.retrievedListOfTeams=[];this.kingQueenRoundScores=[];this.scrambleSelected=false;this.showSaveRoundScores=false;
    }
    ngOnDestroy():void { this.managementAccess.unsubscribe(); this.scoreListReader?.unsubscribe(); this.generationVersion++; clearTimeout(this.scrambleNoticeTimer); if(this.existingPlayerBrowserRef)this.existingPlayerBrowserRef.close(); if(this.matchupResizeObserver)this.matchupResizeObserver.disconnect();if(this.matchupLayoutFrame!==null)cancelAnimationFrame(this.matchupLayoutFrame); if(this.matchupsDialogRef)this.matchupsDialogRef.close(); this.scoreDestroyed=true;if(this.playerEditRef)this.playerEditRef.close();if(this.playerImportRef)this.playerImportRef.close();this.scoreVersion++;if(this.scoreReader)this.scoreReader.unsubscribe();if(this.scoreSaver)this.scoreSaver.unsubscribe(); }
    refreshSavedScoreIds():void {
        if(!this.scoringScramble||this.scoreSaveBusy)return;
        this.verifySavedScores();
    }
    private verifySavedScores():void {
        const version=this.scoreVersion;this.scoreSaveBusy=true;
        this.scoreReader=this.playerService.getKingQueenTeamsByScrambleNumber(this.selectedLeague,this.scoringScramble.scrambleNumber).subscribe(response=>{
            if(version!==this.scoreVersion||this.scoreDestroyed)return;
            const saved:any[]=[];(response&&response.kingQueenTeams||[]).forEach(entry=>(entry.kingQueenTeam.kingQueenRoundScores||[]).forEach(row=>saved.push(row)));
            const matches=this.kingQueenRoundScores.map(row=>saved.filter(stored=>stored.kingQueenTeamId===row.kingQueenTeamId&&stored.roundId===row.roundId));
            if(matches.some(rows=>rows.length!==1||!(rows[0].id>0))){this.scoreSaveBusy=false;this.scoreRefreshRequired=true;this.scoreEditorFeedback='Scores were saved, but their saved record IDs could not be verified. Refresh saved records before saving again.';return;}
            this.kingQueenRoundScores.forEach((row,index)=>row.id=matches[index][0].id);
            this.scoreTeams.forEach(team=>team.kingQueenRoundScores=this.kingQueenRoundScores.filter(row=>row.kingQueenTeamId===team.kingQueenTeamId).map(row=>({...row})));
            this.scoreSaveBusy=false;this.scoreRefreshRequired=false;this.scoreSnapshot=this.scoreSignature();this.scoreEditorFeedback='Round scores saved successfully.';
            this.snackBar.open('Standings have been saved.','OK',{duration:5000,verticalPosition:'top',horizontalPosition:'center'});this.initializeStandings();
        },()=>{if(version===this.scoreVersion){this.scoreSaveBusy=false;this.scoreRefreshRequired=true;this.scoreEditorFeedback='Scores were saved, but saved records could not be refreshed. Refresh saved records before saving again.';}});
    }
    scheduleDrafts:any={};
    managementRoster: any[] = [];
    managementRosterSearch = '';
    managementRosterDivision = 'all';
    showAllManagementPlayers = false;
    managementRosterLoading = false;
    managementRosterError = '';
    managementRemovalPending = false;
    private managementRosterVersion = 0;
    private managementRosterLeague: number = null;
    private existingPlayerBrowserRef: MatDialogRef<ExistingPlayerBrowserComponent>;
    private playerImportRef: MatDialogRef<PlayerImportComponent>;
    private playerEditRef: MatDialogRef<any>;
    playerImportDraft: any = null;
    @ViewChild('removeMembershipDialog', { static: true }) removeMembershipDialog:TemplateRef<any>;
    editLeaguePlayer(player:any):void {
        if(!this.isActionAllowed||this.playerEditRef||this.managementRemovalPending)return;
        const leagueId=this.leagueId;
        this.playerEditRef=this.managementDialog.open(LeaguePlayerEditComponent,{width:'480px',maxWidth:'calc(100vw - 24px)',maxHeight:'94vh',restoreFocus:true,data:{leagueId,leagueName:this.selectedLeague,player}});
        this.playerEditRef.afterClosed().subscribe(result=>{this.playerEditRef=null;if(!result||this.leagueId!==leagueId||this.scoreDestroyed)return;if(result.remove){this.confirmRemoveFromLeague(result.remove,this.removeMembershipDialog);return;}this.recordManagementMemberships(leagueId,[result]);this.refreshManagementRoster();this.showSnackBar('Player changes saved.',false);});
    }

    private recordManagementMemberships(leagueId: number, results: any[]): void {
        if (this.scoreDestroyed || this.leagueId !== leagueId) return;
        const roster = new Map<number,any>(this.managementRoster.map(p => [p.id,p] as [number,any]));
        const known = new Set(this.queriedPlayers.map(p=>p.id));
        const maleIds = new Set(this.malePlayers1.map(p=>p.id)), femaleIds = new Set(this.femalePlayers1.map(p=>p.id));
        results.forEach(result => {
            const player = { ...result.player, managementDivision: result.leagueDivisionName || '', leagueDivisionId: result.leagueDivisionId };
            // Preserve existing selection flags/references while refreshing names
            // held by this component. Other pages retrieve the global profile by ID.
            [this.queriedPlayers,this.malePlayers1,this.femalePlayers1,this.selectedList].forEach(list=>list.filter(p=>p.id===player.id).forEach(p=>{p.firstName=player.firstName;p.lastName=player.lastName;}));
            roster.set(player.id, player);
            if (!known.has(player.id)) { this.queriedPlayers.push(player); known.add(player.id); }
            const ids=player.isMale?maleIds:femaleIds, list=player.isMale?this.malePlayers1:this.femalePlayers1;
            if (!ids.has(player.id)) { list.push(player); ids.add(player.id); }
        });
        this.managementRoster=Array.from(roster.values()).sort((a,b)=>(a.firstName+' '+a.lastName).localeCompare(b.firstName+' '+b.lastName));
        this.malePlayers1.sort((a,b)=>a.lastName.localeCompare(b.lastName)); this.femalePlayers1.sort((a,b)=>a.lastName.localeCompare(b.lastName));
        this.cdr.detectChanges();
    }
    openPlayerImport(): void {
        if (!this.isActionAllowed || !this.leagueId || this.playerImportRef || this.existingPlayerBrowserRef || this.managementRosterLoading || this.managementRosterError) return;
        const leagueId=this.leagueId;
        this.playerImportRef=this.managementDialog.open(PlayerImportComponent, {width:'94vw',maxWidth:'96vw',height:'94vh',maxHeight:'96vh',panelClass:'player-import-panel',restoreFocus:true,
            data:{leagueId,leagueName:this.selectedLeague,divisionId:this.selectedLeagueDivisionIdForAddPlayer,
                draft:this.playerImportDraft&&this.playerImportDraft.leagueId===leagueId?this.playerImportDraft:null,
                onImported:results=>this.recordManagementMemberships(leagueId,results),
                onDraft:draft=>{if(!this.scoreDestroyed&&this.leagueId===leagueId)this.playerImportDraft=draft ? {...draft,leagueId} : null;}}});
        this.playerImportRef.afterClosed().subscribe(()=>this.playerImportRef=null);
    }

    openExistingPlayerBrowser(): void {
        if (!this.isActionAllowed || !this.leagueId || this.existingPlayerBrowserRef || this.playerImportRef || this.managementRosterLoading || this.managementRosterError) return;
        const leagueId = this.leagueId, leagueName = this.selectedLeague;
        this.existingPlayerBrowserRef = this.managementDialog.open(ExistingPlayerBrowserComponent, {
            width: '94vw', maxWidth: '96vw', height: '94vh', maxHeight: '96vh',
            panelClass: 'existing-player-browser-panel', restoreFocus: true,
            data: { leagueId, leagueName, divisionId: this.selectedLeagueDivisionIdForAddPlayer,
                onAdded: result => this.recordManagementMemberships(leagueId,[result]) }
        });
        this.existingPlayerBrowserRef.afterClosed().subscribe(() => this.existingPlayerBrowserRef = null);
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes.workspaceSection && this.workspaceSection !== 'league-management' && this.playerEditRef) this.playerEditRef.close();
        if (changes.workspaceSection && this.workspaceSection !== 'league-management' && this.playerImportRef) this.playerImportRef.close();
        if (changes.workspaceSection && this.workspaceSection !== 'league-management' && this.existingPlayerBrowserRef) this.existingPlayerBrowserRef.close();
        if (changes.workspaceSection && this.workspaceSection === 'league-management') { this.refreshManagementRoster(); }
    }
    get filteredManagementRoster(): any[] {
        const query = this.managementRosterSearch.trim().toLowerCase();
        if (!query && !this.showAllManagementPlayers) { return []; }
        return this.managementRoster.filter(p => (p.firstName + ' ' + p.lastName).toLowerCase().indexOf(query) >= 0 && (this.managementRosterDivision==='all'||String(p.leagueDivisionId||0)===this.managementRosterDivision));
    }
    toggleManagementRoster(): void {
        this.managementRosterSearch = '';
        this.showAllManagementPlayers = !this.showAllManagementPlayers;
    }
    trackManagementPlayer(index: number, player: any): number { return player.id; }
    refreshManagementRoster(): void {
        if (this.workspaceSection !== 'league-management' || !this.leagueId || !this.selectedLeague) { return; }
        const leagueId = this.leagueId, leagueName = this.selectedLeague, version = ++this.managementRosterVersion;
        if (this.managementRosterLeague !== leagueId) {
            this.managementRoster = []; this.managementRosterSearch = ''; this.managementRosterDivision='all';this.showAllManagementPlayers = false; this.managementRosterLeague = leagueId;
        }
        this.managementRosterLoading = true; this.managementRosterError = '';
        const failed = () => {
            if (version !== this.managementRosterVersion || this.leagueId !== leagueId) return;
            this.managementRosterLoading = false;
            this.managementRosterError = 'Unable to load league players. Please retry.';
        };
        this.playerService.leagueRosterContext(leagueId).subscribe(context => {
            if (version !== this.managementRosterVersion || this.leagueId !== leagueId) { return; }
            if (!Array.isArray(context?.players) || !Array.isArray(context?.members) || !Array.isArray(context?.divisions)) {
                failed();
                return;
            }
            this.managementRoster = context.players.filter(player=>context.members.some(m=>m.playerId===player.id)).map(player=>{
                const member=context.members.find(m=>m.playerId===player.id),division=context.divisions.find(d=>d.id===member.divisionId);
                return {...player,leagueDivisionId:member.divisionId,managementDivision:division?(division.name||division.code):''};
            });
            this.managementRoster.sort((a,b)=>(a.firstName+' '+a.lastName).localeCompare(b.firstName+' '+b.lastName)||a.id-b.id);
            this.managementRosterLoading = false;
        }, failed);
    }
    confirmRemoveFromLeague(player: any, template: TemplateRef<any>): void {
        if (!this.isActionAllowed || this.managementRemovalPending) { return; }
        // ID-based removal is authoritative; retain the ambiguity guard for legacy name-only records.
        if (!(player.id>0) && this.managementRoster.filter(p => p.firstName === player.firstName && p.lastName === player.lastName).length !== 1) {
            this.showSnackBar('This player name is ambiguous in the league. No player was removed.', true); return;
        }
        const leagueId = this.leagueId, leagueName = this.selectedLeague;
        this.managementDialog.open(template, { width: '420px', maxWidth: 'calc(100vw - 32px)', data: { player, leagueName } }).afterClosed().subscribe(confirmed => {
            if (!confirmed) { return; }
            if (this.leagueId !== leagueId || this.selectedLeague !== leagueName || !this.isActionAllowed) {
                this.showSnackBar('League or administration access changed. Please select the player again.', true); return;
            }
            this.selectedPlayerToDelete = player; this.managementRemovalPending = true; this.deleteSelectedPlayer();
        });
    }
    @Input() workspaceSection = 'scrambler';
    resultsCollapsed = false;
    private savedPrintSignature: string = null;
    private savedPrintTeams: Team[] = null;
    private savedPrintLeague: string = null;
    private originalPlayerGenders = new WeakMap<Player, boolean>();
    private getPrintSignature(): string {
        return JSON.stringify({ teams: this.listOfTeams.map(t => t.players.map(p => [p.id, p.isMale])), byes: this.byePlayers.map(p => p.id) });
    }
    private rememberSavedTeams(): void {
        this.savedPrintTeams = this.listOfTeams;
        this.savedPrintLeague = this.selectedLeague;
        this.savedPrintSignature = this.getPrintSignature();
    }
    get isScrambleSaved(): boolean {
        return this.listOfTeams.length > 0 && this.savedPrintTeams === this.listOfTeams &&
            this.savedPrintLeague === this.selectedLeague && this.savedPrintSignature !== null &&
            this.savedPrintSignature === this.getPrintSignature();
    }
    get canPrintMatchups(): boolean {
        return this.isScrambleSaved && !this.teamEditsPending && !this.teamSaveBusy;
    }
    isPlayerGenderSwapped(player: Player): boolean {
        return this.originalPlayerGenders.has(player) && this.originalPlayerGenders.get(player) !== player.isMale;
    }
    private teamEditingSnapshot: { team: Team; players: Player[]; court: string }[] = null;
    get canCancelTeamEditing(): boolean { return this.teamEditingSnapshot !== null; }
    get teamEditsPending(): boolean {
        return !!this.teamEditingSnapshot && this.teamEditingSnapshot.some(entry =>
            entry.team.players.map(p => p.id).join(',') !== entry.players.map(p => p.id).join(',') || this.getMatchCourt(entry.team) !== entry.court);
    }
    @ViewChild('matchupDiv') matchupDiv!: ElementRef;
    @ViewChild('saveTeamsDiv', { static: true }) saveTeamsDiv!: ElementRef;
    @ViewChild('tabGroup', { static: true }) tabGroup: MatTabGroup; // ViewChild reference
    selectedRounds: number = 5; // Default to 5 rounds
    processedStandings: { playerName: string; scores: { roundId: number; score: number | string }[] }[] = [];
    rounds: number[] = [];
    divisionsLoading: boolean = false;
    divisionsLoadedOnce: boolean = false;
    searchTerm: string = '';
    searchedPlayers: any[] = [];
    LeagueDivisionForm: UntypedFormGroup;
    selectedPlayer: any = null;
    searchTermDelete: string = '';
    leagueDay: string = 'Monday';
    searchedPlayersToDelete: any[] = [];
    selectedPlayerToDelete: any = null;
    private originalStandings: PlayerScoreGroup[] | null = null;
    standingsRounds: number[] = [];
    roundScores: { [teamId: number]: { RoundScore: number; RoundWon: boolean }[] } = {};
    kingQueenRoundScores: KingQueenRoundScore[] = [];
    selectedMatchupsPerPage: string = '6';
    showSaveRoundScores: boolean = false;
    allowScrambleWithNoDuplicates: boolean = false;
    retrievedPlayersBefore: boolean = false;
    scrambleSelected: boolean = false;
    showPlayerTeams = false; // Controls the visibility of the player teams section
    showTeamFormation = false; // Controls the visibility of the team formation section
    userRole: string;
    numberOfSubsAllowed: number = 100; // Default value
    dropLowest: number = 0; // Default value
    subScorePercent: number = 100; // Default value
    totalPlayers: Player[];
    players: Player[];
    selectedMalePlayers: Player[];
    byePlayers: Player[] = new Array();
    malePlayers: Player[] = new Array();
    femalePlayers: Player[] = new Array();
    malePlayersDisplayCount: Player[] = new Array();
    femalePlayersDisplayCount: Player[] = new Array();
    totalRandomPlayers: Player[] = new Array();
    displayTopPlayers: Player[] = new Array();
    totalTopPlayers: Player[] = new Array();
    totalTopPlayersTemp: Player[] = new Array();
    displayLowPlayers: Player[] = new Array();
    totalLowPlayers: Player[] = new Array();
    totalLowPlayersTemp: Player[] = new Array();
    totalPlayersTemp: Player[] = new Array();
    listOfTeams: Team[] = new Array();
    retrievedListOfTeams: Team[] = new Array();
    uniqueScrambleNumbers: number[] = [];
    matchups: Team[] = new Array();
    selectedList: Player[] = new Array();
    selectedRetrieveScrambleList: KingQueenTeam[] = new Array();
    malePlayers1: Player[] = new Array();
    femalePlayers1: Player[] = new Array();
    fourPlayerTeams: number;
    threePlayerTeams: number;
    twoPlayerTeams: number;
    fivePlayerTeams: number;
    sixPlayerTeams: number;
    tenPlayerTeams: number;
    ninePlayerTeams: number;
    sevenPlayerTeams: number;
    eightPlayerTeams: number;
    leftoverPlayers: number;
    queriedPlayers: Player[] = new Array();
    queriedScrambles: KingQueenTeam[] = new Array();
    leaguesAvailable: Leagues[] = [];
    leagueDivisionsForSelectedLeague: { id: number; code: string; name: string; sortOrder: number }[] = [];
    selectedLeagueDivisionIdForAddPlayer: number = 0;   // used when adding an existing/new player
    selectedLeagueDivisionIdForNewPlayer: number = 0;
    leagueId: number;
    selectedLeagueDto: Leagues;
    gendersPossible: Gender[] = [{ value: 'Female', isMale: false }, { value: 'Male', isMale: true }];
    isSub: boolean;
    loggedIn: boolean = false;
    selectedGender: Gender;
    player: Player;
    randomMalePlayer: Player;
    randomFemalePlayer: Player;
    randomPlayer: Player;
    randomTopPlayer: Player;
    randomLowPlayer: Player;
    addedPlayer: Player;
    isActionAllowed: boolean = false;
    private managementAccess = new Subscription();
    private settingsDirty = false;
    private settingsSaving = false;
    managerEmail = '';
    managerEmailDirty = false;
    managerAssignmentPending = false;

    get canCreateLeague(): boolean {
        return this.userRole === 'Admin' || this.userRole === 'Manager';
    }

    revealManagementTab(workspace: HTMLElement): void {
        requestAnimationFrame(() => {
            workspace.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
                ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        });
    }

    setLeagueManager(assigned: boolean): void {
        if (this.userRole !== 'Admin' || !this.leagueId || this.managerAssignmentPending || !this.managerEmail.trim()) return;
        this.managerAssignmentPending = true;
        const submittedEmail = this.managerEmail;
        this.loginService.setLeagueManager(this.leagueId, this.managerEmail.trim(), assigned).subscribe({
            next: () => {
                this.managerAssignmentPending = false;
                if (submittedEmail === this.managerEmail) this.managerEmailDirty = false;
                this.showSnackBar(assigned ? 'League access granted.' : 'League access revoked.');
            },
            error: error => {
                this.managerAssignmentPending = false;
                this.showSnackBar(error.status === 404 ? 'No matching manager account or league was found.' : 'Could not update league access.', true);
            }
        });
    }
    teamsNeededTwo: number = 0;
    teamsNeededThree: number = 0;
    teamsNeededFour: number = 0;
    remainderTwo: number = 0;
    remainderThree: number = 0;
    remainderFour: number = 0;
    listOfScrambleNumbers: number[] = [];
    listOfRetrievedScrambleNumbers: number[] = [];
    listOfByePlayers: Player[] = [];
    teamSizePossible: number[] = [2, 3, 4, 5];
    maxNumberOfTeams: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26];
    femalePlayerCount: number;
    malePlayerCount: number;
    topPlayerCount: number;
    lowPlayerCount: number;
    randomPlayerCount: number;
    private selectedListChanged: Subject<void> = new Subject<void>();
    numberOfPlayersNeededTwo: number;
    numberOfPlayersNeededThree: number;
    numberOfPlayersNeededFour: number;
    brackets: number;
    teamCount: number;
    teamSize: number;
    numberOfTeams: number;
    innerTabIndex: number = 0;
    maxTeamSize: number;
    scrambleNumber: number;
    containsMale: boolean = false;
    teamConfigurationMode: 'size' | 'count' = 'size';
    private rememberedTeamSize = 4;
    private rememberedTeamCount: number = null;
    containsFemale: boolean = false;
    lockedResults: boolean = false;
    locked: boolean = false;
    hidePlayers: boolean = false;
    leagueCreationPending = false;
    managementTabIndex = 0;
    managementAccessLoading = true;
    creationError = '';
    private createdLeagueId: number | null = null;
    showNewPlayerForm: boolean = false;
    isSmallScreen = false;
    hideListOptions: boolean;
    hideInputOptions: boolean;
    selectedOption: boolean = false;
    isMale1: boolean;
    completeRandom: false;
    playerLoading: boolean;
    lastResult: PlayerScoresResponse;
    leagueName: string;
    selectedLeague: string;
    standings: PlayerScoreGroup[];
    femaleStandings: PlayerScoreGroup[];
    maleStandings: PlayerScoreGroup[];
    retrievedStandingsType: string;
    showTeamSorting: boolean = false;
    hasSignedInPlayersAvailable: boolean = false;
    fetchClicked: boolean = false;
    // Apply-top buttons state
    applyClicked: boolean = false;
    hasTopPlayersAvailable: boolean = false;
    get applyButtonsEnabled(): boolean {
        return !!(this.selectedList && this.selectedList.length > 0);
    }
    PlayerForm = new UntypedFormGroup({
        firstName: new UntypedFormControl(),
        lastName: new UntypedFormControl(),
        isMale: new UntypedFormControl(),
        leagueName: new UntypedFormControl(),
        isSub: new UntypedFormControl(),
        selectedGender: new UntypedFormControl()
    });
    deletePlayerForm = new UntypedFormGroup({
        firstName: new UntypedFormControl(),
        lastName: new UntypedFormControl(),
    });
    LeagueForm = new UntypedFormGroup({
        newLeagueName: new UntypedFormControl(),
    });

    constructor(
        http: HttpClient,
        @Inject('BASE_URL') baseUrl: string,
        private cdr: ChangeDetectorRef,
        public playerService: PlayerService,
        public leagueService: LeagueService,
        public loginService: LoginService,
        private snackBar: MatSnackBar,
        private managementDialog: MatDialog,
        private authService: AuthService
    ) {
        this.teamSize = this.rememberedTeamSize;
        protectPendingWork(() => this.generationBusy || this.teamSaveBusy || this.scoreSaveBusy ||
            this.teamEditsPending || this.scoreEditsPending || (this.listOfTeams.length > 0 && !this.isScrambleSaved) ||
            this.hasPendingScrambleConfiguration() ||
            this.settingsDirty || this.settingsSaving || (this.managerEmailDirty && !!this.managerEmail.trim()) || this.managerAssignmentPending || this.leagueCreationPending ||
            this.managementRemovalPending || Object.values(this.scheduleDrafts).some(draft =>
                Object.values((draft as { views: Record<string, { dirty: boolean }> }).views).some(view => view.dirty)) ||
            !!this.playerImportDraft);

        this.selectedListChanged.subscribe(() => {
            this.setTeamCount();
        });

        // Add Division form (no FormBuilder)
        this.LeagueDivisionForm = new UntypedFormGroup({
            code: new UntypedFormControl('', [Validators.required]),
            name: new UntypedFormControl('', [Validators.required]),
            sortOrder: new UntypedFormControl(1, [Validators.required]),
        });
    }

    updateSelectedList(): void {
        this.selectedListChanged.next(); // Notify listeners
        this.applyClicked = false;
    }

    scrambleNotice = false;
    private scrambleNoticeTimer: any;
    private announceGeneratedScramble(): void {
        clearTimeout(this.scrambleNoticeTimer);
        this.scrambleNotice = true;
        this.scrambleNoticeTimer = setTimeout(() => this.scrambleNotice = false, 4500);
    }
    private revealScrambleResults(): void {
        if (!this.listOfTeams.length || this.workspaceSection !== 'scrambler') return;
        this.resultsCollapsed = false;
        this.cdr.detectChanges();
        this.queueMatchupLayout();
        const teams = this.listOfTeams;
        requestAnimationFrame(() => {
            if (this.scoreDestroyed || this.matchupsDialogRef || this.listOfTeams !== teams || !this.saveTeamsDiv) return;
            const section = this.saveTeamsDiv.nativeElement as HTMLElement;
            const bounds = section.getBoundingClientRect();
            const nav = document.querySelector('app-nav-menu nav');
            const navStyle = nav && getComputedStyle(nav);
            const top = nav && (navStyle.position === 'fixed' || navStyle.position === 'sticky') ? Math.max(12, nav.getBoundingClientRect().bottom + 12) : 12;
            if (bounds.top >= top && bounds.bottom <= window.innerHeight + 1) return;
            section.style.setProperty('scroll-margin-top', top + 'px');
            section.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        });
    }

    @ViewChild('matchupsDialog', { static: true }) matchupsDialog: TemplateRef<any>;
    private matchupsDialogRef: MatDialogRef<any>;
    matchupCompactNames = true;
    private matchupResizeObserver: any;
    private matchupLayoutFrame: number = null;
    private queueMatchupLayout(): void {
        if (!this.matchupsDialogRef || this.matchupLayoutFrame !== null) return;
        this.matchupLayoutFrame = requestAnimationFrame(() => {
            this.matchupLayoutFrame = null;
            if (this.scoreDestroyed || !this.matchupsDialogRef) return;
            const content = document.querySelector('.matchups-dialog-panel mat-dialog-content') as HTMLElement;
            if (!content) return;
            const style = getComputedStyle(content);
            const width = content.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
            const compact = width < 600;
            if (compact !== this.matchupCompactNames) { this.matchupCompactNames = compact; this.cdr.detectChanges(); }
            // Minimum card width grows when actual unbroken names need more space.
            const cell = content.querySelector('.viewer-player-row td') as HTMLElement;
            const canvas = document.createElement('canvas').getContext('2d');
            let minimum = 550;
            if (cell && canvas && !compact) {
                const font = getComputedStyle(cell);
                canvas.font = font.fontSize + ' ' + font.fontFamily;
                let first = 0, last = 0;
                this.listOfTeams.forEach(team => team.players.forEach(player => {
                    String(player.firstName || '').split(/[\s-]+/).forEach(word => first = Math.max(first, canvas.measureText(word).width + 4));
                    String(player.lastName || '').split(/[\s-]+/).forEach(word => last = Math.max(last, canvas.measureText(word).width + 4));
                }));
                const names = Math.max(first / .4, last / .6);
                minimum = Math.max(550, Math.ceil(2 * Math.max(names / .85, names + 42) + 78));
            }
            content.style.setProperty('--matchup-min-width', minimum + 'px');
            // Match row heights across both opposing rosters, including wrapped whole words.
            Array.prototype.forEach.call(content.querySelectorAll('.generated-matchups mat-card'), (card: HTMLElement) => {
                let height = 34;
                Array.prototype.forEach.call(card.querySelectorAll('.viewer-player-row > td'), (entry: HTMLElement) => height = Math.max(height, Math.ceil(entry.scrollHeight) + 8));
                card.style.setProperty('--matchup-player-height', height + 'px');
            });
        });
    }

    private matchCourts = new Map<Team, string>();
    teamSaveBusy = false;
    teamSaveFeedback = '';
    get matchupCount(): number { return Math.ceil(this.listOfTeams.length / 2); }
    get canSaveMatchupTeams(): boolean { return this.isActionAllowed && !this.generationBusy && !this.teamSaveBusy && (!this.scrambleSelected || this.listOfRetrievedScrambleNumbers.length === 1) && this.listOfTeams.length > 0 && this.listOfTeams.every(team => team.kingQueenTeamId > 0); }
    getMatchCourt(team: Team): string { return this.matchCourts.get(team) || ''; }
    setMatchCourt(team: Team, value: string): void { if (!this.teamSaveBusy) this.matchCourts.set(team, value); }
    openMatchups(edit: boolean = false): void {
        if (!this.listOfTeams.length) return;
        if (!this.matchupsDialogRef) {
            const opener = document.activeElement as HTMLElement;
            const scrollPosition = { left: window.scrollX, top: window.scrollY };
            this.teamSaveFeedback = '';
            this.matchupCompactNames = (window.innerWidth <= 767 ? window.innerWidth - 16 : Math.min(window.innerWidth * .95, 1600) - 32) < 600;
            this.matchupsDialogRef = this.managementDialog.open(this.matchupsDialog, {
                width: '95vw', maxWidth: '1600px', maxHeight: '96vh',
                panelClass: 'matchups-dialog-panel', disableClose: true, closeOnNavigation: false, autoFocus: true, restoreFocus: false
            });
            this.matchupsDialogRef.backdropClick().subscribe(() => this.closeMatchups());
            this.matchupsDialogRef.keydownEvents().subscribe(event => { if (event.key === 'Escape') { event.preventDefault(); this.closeMatchups(); } });
            this.matchupsDialogRef.afterOpened().subscribe(() => {
                this.queueMatchupLayout();
                if((document as any).fonts)(document as any).fonts.ready.then(() => this.queueMatchupLayout());
                const Observer = (window as any).ResizeObserver;
                const content = document.querySelector('.matchups-dialog-panel mat-dialog-content');
                if (Observer && content) { this.matchupResizeObserver = new Observer(() => this.queueMatchupLayout()); this.matchupResizeObserver.observe(content); const cards = content.querySelector('.generated-matchups'); if(cards)this.matchupResizeObserver.observe(cards); }
            });
            this.matchupsDialogRef.afterClosed().subscribe(() => {
                if(this.matchupResizeObserver)this.matchupResizeObserver.disconnect();
                this.matchupResizeObserver=null; this.matchupsDialogRef = null;
                // Restore the opener without MDC's focus-induced page scrolling.
                if (opener && opener.isConnected) opener.focus({ preventScroll: true });
                window.scrollTo(scrollPosition.left, scrollPosition.top);
            });
        }
        if (edit && !this.showTeamSorting && this.isActionAllowed) { this.teamSaveFeedback = ''; this.toggleTeamSorting(); }
        this.queueMatchupLayout();
    }
    cancelMatchupChanges(): Promise<boolean> {
        return this.confirmWorkspaceChanges(true, false);
    }
    async closeMatchups(): Promise<void> {
        if (await this.cancelMatchupChanges()) this.matchupsDialogRef?.close();
    }

    toggleTeamSorting(): void {
        if (!this.showTeamSorting && !this.teamEditingSnapshot) {
            this.teamEditingSnapshot = this.listOfTeams.map(team => ({ team, players: team.players.slice(), court: this.getMatchCourt(team) }));
        }
        this.showTeamSorting = !this.showTeamSorting;
    }

    cancelTeamEditing(): void {
        if (this.teamEditingSnapshot) {
            this.teamEditingSnapshot.forEach(entry => { entry.team.players = entry.players.slice(); this.matchCourts.set(entry.team, entry.court); });
        }
        this.teamEditingSnapshot = null;
        this.showTeamSorting = false;
        this.queueMatchupLayout();
    }

    requestRetrieveScramble(scramble: KingQueenTeam): void {
        void this.retrieveScramble(scramble);
    }

    requestRetrieveMultipleScrambles(): void {
        void this.retrieveMultipleScrambles();
    }

    async requestResetAll(): Promise<void> {
        if (this.locked) { this.reset(); return; }
        const league = this.leagueId, version = this.generationVersion;
        if (!await this.confirmAction({
            title: 'Reset players', message: 'Clear Top, Low and Bye selections and generated teams? Checked roster players will stay selected.',
            action: 'Reset players', tone: 'danger'
        }) || league !== this.leagueId || version !== this.generationVersion || this.teamSaveBusy) return;
        this.generationVersion++;this.generationBusy=false;
        this.reset();
        this.teamEditingSnapshot = null;
        this.showTeamSorting = false;
    }

    async requestResetPreferences(kind: 'top' | 'low' | 'bye'): Promise<void> {
        const league = this.leagueId;
        if (!await this.confirmAction({
            title: 'Clear ' + kind + ' selections', message: 'Checked roster players will stay selected.',
            action: 'Clear selections', tone: 'danger'
        }) || league !== this.leagueId) return;
        if (kind === 'top') { this.resetTopPlayers(); }
        else if (kind === 'low') { this.resetLowPlayers(); }
        else { this.resetByePlayers(); }
    }

    switchPlayerTeam(player: any, selectedSortingId: string, currentSortingId: number): void {
        if(this.teamSaveBusy || !this.showTeamSorting)return;
        if(!this.listOfTeams.some(team=>team.sortingId===Number(selectedSortingId)) || Number(selectedSortingId)===currentSortingId)return;
        const currentTeam = this.listOfTeams.find(team => team.sortingId === currentSortingId);
        if (currentTeam) {
            currentTeam.players = currentTeam.players.filter(p => p.id !== player.id);
        }

        const newTeam = this.listOfTeams.find(team => team.sortingId === Number(selectedSortingId));
        if (newTeam) {
            newTeam.players.push(player);
            this.queueMatchupLayout();
        }
    }

    private initializeSettings(): void {
        this.loginService.getSettingValue('numberOfSubsAllowed', this.leagueId).subscribe(
            (numberOfSubsAllowedValue) => {
                this.numberOfSubsAllowed = this.parseValueAsNumber(numberOfSubsAllowedValue, 100); // Default is 100

                this.loginService.getSettingValue('dropLowest', this.leagueId).subscribe(
                    (dropLowestValue) => {
                        this.dropLowest = this.parseValueAsNumber(dropLowestValue, 0); // Default is 0

                        this.loginService.getSettingValue('subScorePercent', this.leagueId).subscribe(
                            (subScorePercentValue) => {
                                this.subScorePercent = this.parseValueAsNumber(subScorePercentValue, 100); // Default is 100

                                this.loginService.getSettingValue('standingsType', this.leagueId).subscribe(
                                    (newStandingsType) => {
                                        this.retrievedStandingsType = newStandingsType;
                                        if (this.retrievedStandingsType !== this.standingsType) {
                                            this.toggleStandingsType(); // Call toggleStandingsType if it changed
                                        } else {
                                            this.processStandings(this.lastResult, this.getCurrentOptions()); // Call processStandings otherwise
                                        }

                                        // Corrected: Fetch dayOfLeague after standingsType is processed
                                        this.loginService.getSettingValue('dayOfLeague', this.leagueId).subscribe(
                                            (dayOfLeagueValue) => {
                                                this.leagueDay = dayOfLeagueValue || 'Monday'; // Default to 'Monday'
                                            },
                                            (error) => console.error('Error fetching dayOfLeague:', error)
                                        );

                                    },
                                    (error) => console.error('Error fetching standingsType:', error)
                                );
                            },
                            (error) => console.error('Error fetching subScorePercent:', error)
                        );
                    },
                    (error) => console.error('Error fetching dropLowest:', error)
                );
            },
            (error) => console.error('Error fetching numberOfSubsAllowed:', error)
        );
    }


    private parseValueAsNumber(value: any, defaultValue: number): number {
        if (typeof value === 'number') {
            return value; // Already a number
        }
        if (typeof value === 'string' && !isNaN(parseFloat(value))) {
            return parseFloat(value); // Convert string to number
        }
        console.warn(`Value "${value}" could not be parsed as a number. Using default: ${defaultValue}`);
        return defaultValue; // Fallback to default
    }


    private async awaitSettingsAndInitialize(): Promise<void> {
        await this.initializeSettings();
    }


    swapGender(player: any): void {
        if (!this.originalPlayerGenders.has(player)) { this.originalPlayerGenders.set(player, player.isMale); }
        player.isMale = !player.isMale; // Toggles the value
    }

    toggleNewPlayerForm(): void {
        this.showNewPlayerForm = !this.showNewPlayerForm;
    }

    // Add this helper method somewhere in the class (e.g. after onLeagueChanged or near other helpers)
    checkForSignedInPlayers(): void {
        if (!this.leagueId) {
            this.hasSignedInPlayersAvailable = false;
            return;
        }

        const today = new Date();
        this.playerService.getSelectedPlayersAsPlayers(this.leagueId, today).subscribe(
            (players: Player[]) => {
                this.hasSignedInPlayersAvailable = Array.isArray(players) && players.length > 0;
            },
            (error) => {
                console.error('Error checking for signed-in players:', error);
                this.hasSignedInPlayersAvailable = false;
            }
        );
    }

    public hasTopPlayers(leagueId: number): Observable<boolean> {
        return this.playerService.hasTopPlayers(leagueId);
    }

    onSearchPlayer(event: any) {
        const value = event.target.value;
        if (value.length > 2) {
            this.playerService.searchPlayers(value).subscribe(
                (results) => (this.searchedPlayers = results),
                (error) => console.error(error)
            );
        } else {
            this.searchedPlayers = [];
        }
    }

    onPlayerSelected(player: any) {
        this.selectedPlayer = player;
    }

    onBlurPlayerInput(): void {
        if (!this.searchTerm || !this.searchedPlayers || this.searchedPlayers.length === 0) {
            this.selectedPlayer = null;
            return;
        }

        const typedText = this.searchTerm.trim().toLowerCase();

        // Find exact match in the searchedPlayers
        const matchedPlayer = this.searchedPlayers.find(player => {
            const fullName = (player.firstName + ' ' + player.lastName).toLowerCase();
            return fullName === typedText;
        });

        if (matchedPlayer) {
            this.selectedPlayer = matchedPlayer;
        } else {
            // No exact match
            this.selectedPlayer = null;
        }
    }

    onBlurDeletePlayerInput(): void {
        if (!this.searchTermDelete || !this.searchedPlayersToDelete || this.searchedPlayersToDelete.length === 0) {
            this.selectedPlayerToDelete = null;
            return;
        }

        const typedText = this.searchTermDelete.trim().toLowerCase();

        const matchedPlayer = this.searchedPlayersToDelete.find(player => {
            const fullName = (player.firstName + ' ' + player.lastName).toLowerCase();
            return fullName === typedText;
        });

        if (matchedPlayer) {
            this.selectedPlayerToDelete = matchedPlayer;
        } else {
            this.selectedPlayerToDelete = null;
        }
    }



    leagueDivisions: LeagueDivisionDto[] = [];
    selectedLeagueDivisionId: number = 0;

    loadDivisionsForSelectedLeague(): void {
        this.divisionsLoading = true;
        this.divisionsLoadedOnce = true;

        this.leagueDivisionsForSelectedLeague = [];
        this.selectedLeagueDivisionIdForAddPlayer = 0;
        this.selectedLeagueDivisionIdForNewPlayer = 0;

        if (this.selectedLeagueDto == null) {
            this.divisionsLoading = false;
            return;
        }

        if (this.selectedLeagueDto.leagueName == null) {
            this.divisionsLoading = false;
            return;
        }

        if (this.selectedLeagueDto.leagueName === '') {
            this.divisionsLoading = false;
            return;
        }

        this.playerService.getLeagueDivisions(this.selectedLeagueDto.leagueName).subscribe(
            (result: any[]) => {
                const mapped: { id: number; code: string; name: string; sortOrder: number }[] = [];

                if (result != null) {
                    for (let i = 0; i < result.length; i++) {
                        const r: any = result[i];

                        let id = 0;
                        let code = '';
                        let name = '';
                        let sortOrder = 0;

                        if (r != null) {
                            if (r.id != null) {
                                id = r.id;
                            }
                            if (r.code != null) {
                                code = r.code;
                            }
                            if (r.name != null) {
                                name = r.name;
                            }
                            if (r.sortOrder != null) {
                                sortOrder = r.sortOrder;
                            }
                        }

                        if (name === '') {
                            name = code;
                        }

                        mapped.push({
                            id: id,
                            code: code,
                            name: name,
                            sortOrder: sortOrder
                        });
                    }
                }

                this.leagueDivisionsForSelectedLeague = mapped;

                this.selectedLeagueDivisionIdForAddPlayer = 0;
                this.selectedLeagueDivisionIdForNewPlayer = 0;

                this.divisionsLoading = false;
            },
            (error) => {
                console.error('loadDivisionsForSelectedLeague error', error);

                this.leagueDivisionsForSelectedLeague = [];
                this.selectedLeagueDivisionIdForAddPlayer = 0;
                this.selectedLeagueDivisionIdForNewPlayer = 0;

                this.divisionsLoading = false;
            }
        );
    }


    onLeagueSelected(league: Leagues): void {
        this.selectedLeagueDto = league;

        if (this.selectedLeagueDto != null) {
            this.leagueName = this.selectedLeagueDto.leagueName;
            this.leagueId = this.selectedLeagueDto.id;
            this.loadDivisionsForSelectedLeague();
            this.checkForSignedInPlayers();
            this.playerService.hasTopPlayers(this.leagueId).subscribe(
                available => this.hasTopPlayersAvailable = available,
                err => {
                    console.error('Error checking top players availability', err);
                    this.hasTopPlayersAvailable = false;
                }
            );
        }

    }

    /*
    Now update addExistingPlayer() to send division id.
    */
    addExistingPlayer() {
        if (this.selectedPlayer && this.selectedLeague) {

            let leagueDivisionId = 0;
            if (this.selectedLeagueDivisionIdForAddPlayer != null) {
                leagueDivisionId = this.selectedLeagueDivisionIdForAddPlayer;
            }

            this.playerService
                .AddPlayer(this.selectedPlayer, this.selectedLeague, leagueDivisionId)
                .subscribe(
                    (result) => {
                        this.player = result;
                        this.containsFemale = false;
                        this.containsMale = false;

                        for (var i = 0; i < this.malePlayers1.length; i++) {
                            if (
                                this.malePlayers1[i].firstName === result.firstName &&
                                this.malePlayers1[i].lastName === result.lastName
                            ) {
                                this.containsMale = true;
                                break;
                            }
                        }

                        for (var i = 0; i < this.femalePlayers1.length; i++) {
                            if (
                                this.femalePlayers1[i].firstName === result.firstName &&
                                this.femalePlayers1[i].lastName === result.lastName
                            ) {
                                this.containsFemale = true;
                                break;
                            }
                        }

                        if (this.containsMale || this.containsFemale) {
                            this.showSnackBar("Player already in the list.");
                        } else {
                            if (result.isMale) {
                                this.malePlayers1.push(result);
                                this.malePlayers1.sort((a, b) => a.lastName.localeCompare(b.lastName));
                            } else {
                                this.femalePlayers1.push(result);
                                this.femalePlayers1.sort((a, b) => a.lastName.localeCompare(b.lastName));
                            }

                            this.showSnackBar("Player added successfully!");
                        }
                        this.refreshManagementRoster();
                    },
                    (error) => {
                        console.error(error);
                        this.showSnackBar("An error occurred while adding the player.");
                    }
                );
        } else {
            this.showSnackBar("Please select a player and a league.");
        }
    }

    addLeagueDivision(): void {
        if (this.selectedLeagueDto == null) {
            this.showSnackBar('Please select a league first.');
            return;
        }

        if (this.LeagueDivisionForm == null) {
            this.showSnackBar('Division form is not ready.');
            return;
        }

        if (this.LeagueDivisionForm.invalid) {
            this.showSnackBar('Please fill out Code, Name, and Sort Order.');
            return;
        }

        if (!this.isActionAllowed) return;

        const code = this.LeagueDivisionForm.get('code').value;
        const name = this.LeagueDivisionForm.get('name').value;
        const sortOrder = this.LeagueDivisionForm.get('sortOrder').value;

        const payload = {
            leagueId: this.selectedLeagueDto.id,
            code: code,
            name: name,
            sortOrder: sortOrder
        };

        this.playerService.addLeagueDivision(payload).subscribe(
            (result) => {
                this.showSnackBar('Division added successfully!');

                this.LeagueDivisionForm.patchValue({
                    code: '',
                    name: '',
                    sortOrder: 1,
                });

                this.loadDivisionsForSelectedLeague();
            },
            (error) => {
                console.error('addLeagueDivision error', error);
                this.showSnackBar('An error occurred while adding the division.');
            }
        );
    }

    displayPlayer(player: any): string {
        return player ? `${player.firstName} ${player.lastName}` : '';
    }

    onSearchPlayerToDelete(event: any) {
        const value = event.target.value;
        if (value.length > 2) {
            this.playerService.searchPlayersInLeague(value, this.selectedLeague).subscribe(
                (results) => (this.searchedPlayersToDelete = results),
                (error) => console.error(error)
            );
        } else {
            this.searchedPlayersToDelete = [];
        }
    }

    // Set the selected player to delete
    onDeletePlayerSelected(player: any) {
        this.selectedPlayerToDelete = player;
    }

    // Delete the selected player from the league
    deleteSelectedPlayer() {
        const target = this.selectedPlayerToDelete, targetLeague = this.selectedLeague;
        if (this.selectedPlayerToDelete && this.selectedLeague) {
            this.playerService
                .DeletePlayer(this.selectedPlayerToDelete, this.selectedLeague)
                .subscribe(
                    (result) => {
                        this.managementRemovalPending = false;
                        if (this.selectedLeague !== targetLeague) { this.refreshManagementRoster(); return; }
                        if (result) {
                            // Remove player from the local lists
                            const maleIndex = this.malePlayers1.findIndex(
                                (p) =>
                                    (target.id>0 ? p.id===target.id : p.firstName===target.firstName && p.lastName===target.lastName)
                            );

                            if (maleIndex !== -1) {
                                this.malePlayers1.splice(maleIndex, 1);
                            }

                            const femaleIndex = this.femalePlayers1.findIndex(
                                (p) =>
                                    (target.id>0 ? p.id===target.id : p.firstName===target.firstName && p.lastName===target.lastName)
                            );

                            if (femaleIndex !== -1) {
                                this.femalePlayers1.splice(femaleIndex, 1);
                            }

                            this.snackBar.open('Player removed from league successfully!', 'Close', { duration: 3000, panelClass: ['custom-snackbar'] });
                            this.selectedPlayerToDelete = null;
                            this.refreshManagementRoster();
                        } else {
                            this.snackBar.open('Player not found in the league.', 'Close', { duration: 3000, panelClass: ['red-snackbar'] });
                        }
                    },
                    (error) => {
                        console.error(error);
                        this.snackBar.open('An error occurred while deleting the player.', 'Close', { duration: 3000, panelClass: ['red-snackbar'] });
                        this.managementRemovalPending = false;
                    }
                );
        } else {
            this.snackBar.open('Please select a player to delete.', 'Close', { duration: 3000, panelClass: ['red-snackbar'] });
            this.managementRemovalPending = false;
        }
    }


    initializeRounds(): void {
        this.rounds = Array.from({ length: this.selectedRounds }, (_, index) => index + 1);
    }

    handlePlayerAction(player: any, action: string): void {
        switch (action) {
            case 'setTopPlayer':
                this.addPlayerToTopPlayerList(player);
                break;
            case 'removeTopPlayer':
                this.removePlayerFromTopPlayerList(player);
                break;
            case 'setLowPlayer':
                this.addPlayerToLowPlayerList(player);
                break;
            case 'removeLowPlayer':
                this.removePlayerFromLowPlayerList(player);
                break;
            case 'setByePlayer':
                this.addPlayerToByeList(player);
                break;
            case 'removeByePlayer':
                this.removePlayerFromByeList(player);
                break;
            case 'swapGender':
                this.swapGender(player);
                break;
        }
    }

    initializeStandingsRounds(): void {
        // Flatten all scores manually and sort by roundId
        const allScores: { roundId: number; score: number }[] = [];
        this.standings.forEach(playerGroup => {
            playerGroup.scores.forEach(score => {
                allScores.push(score);
            });
        });
        const sortedRounds = Array.from(new Set(allScores.map(score => score.roundId))).sort((a, b) => a - b);

        // Determine the total rounds based on selectedRounds or maximum roundId
        const totalRounds = this.selectedRounds || Math.max(...sortedRounds);
        const rounds = [];
        for (let i = 1; i <= totalRounds; i++) {
            rounds.push(i);
        }

        // Process standings for each player
        this.processedStandings = this.standings.map(playerGroup => {
            const scores = [];
            rounds.forEach(round => {
                const matchingScore = playerGroup.scores.find(s => s.roundId === round);
                scores.push({
                    roundId: round,
                    score: matchingScore ? matchingScore.score : '-' // Default to '-' if no score exists for the round
                });
            });
            return { playerName: playerGroup.playerName, scores };
        });
        this.sortStandingsWithUpdates('totalScore');
    }


    initializeScores(): void {
        this.kingQueenRoundScores = []; // Reset the array

        for (const team of this.scoringScramble ? this.scoreTeams : this.retrievedListOfTeams) {

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
                for (let roundIndex = 0; roundIndex < (this.scoringScramble ? this.scoreRoundCount : this.selectedRounds); roundIndex++) {
                    this.kingQueenRoundScores.push({
                        id: 0, // Default for new scores
                        roundId: roundIndex + 1,
                        kingQueenTeamId: team.kingQueenTeamId,
                        roundScore: null,
                        roundWon: false
                    });
                }
            }
        }

        this.recalculateRoundWinners();
    }


    getScore(teamId: number, roundId: number): any {
        return this.kingQueenRoundScores.find(score => score.kingQueenTeamId === teamId && score.roundId === roundId);
    }


    ngOnInit() {
        this.completeRandom = false;
        this.displayTopPlayers = [];
        this.displayLowPlayers = [];
        this.hideInputOptions = false;
        this.hideListOptions = false;
        this.checkScreenSize();

        // Subscribe to window resize events to update isSmallScreen
        window.addEventListener('resize', () => {
            this.checkScreenSize();
        });

        this.playerLoading = false;

        this.leagueService.selectedLeague$.subscribe(async (selectedLeague) => {
            if (selectedLeague.leagueId !== this.leagueId) this.settingsDirty = false;
            if(this.scoreDestroyed||this.scoreRestoreLeague)return;
            const change = ++this.leagueChangeVersion;
            if(this.scoringScramble&&selectedLeague.leagueId===this.leagueId&&selectedLeague.leagueName===this.selectedLeague)return;
            if(this.leagueId&&selectedLeague.leagueId>0&&selectedLeague.leagueId!==this.leagueId){
                const accepted = await this.confirmWorkspaceChanges(true, true);
                if (change !== this.leagueChangeVersion || this.scoreDestroyed) return;
                if(!accepted){this.scoreRestoreLeague=true;this.leagueService.setSelectedLeague(this.leagueId);this.scoreRestoreLeague=false;return;}
                this.clearScoreEditor();
                this.scoreReopenLatest = false;
                this.queriedScrambles = [];
            }
            if (selectedLeague.leagueId !== null && selectedLeague.leagueName !== null) {
                this.leagueId = selectedLeague.leagueId;
                this.selectedLeague = selectedLeague.leagueName;
                this.selectedLeagueDto = {
                    id: selectedLeague.leagueId,
                    leagueName: selectedLeague.leagueName
                };
                this.loadDivisionsForSelectedLeague();

                this.onLeagueChanged();
            } else {
                this.playerService.GetAllMalePlayers().subscribe(
                    (result) => {
                        this.malePlayers1 = result;
                        this.malePlayerCount = result.length;
                    },
                    (error) => console.error(error)
                );

                this.playerService.GetAllFemalePlayers().subscribe(
                    (result) => {
                        this.femalePlayers1 = result;
                        this.femalePlayerCount = result.length;
                        this.awaitSettingsAndInitialize();
                    },
                    (error) => console.error(error)
                );
            }
        });


        // Fetch number of brackets
        this.playerService.GetNumberOfBrackets().subscribe(
            (result) => {
                this.brackets = result;
            },
            (error) => console.error(error)
        );

        // Fetch all players
        this.playerService.GetPlayers().subscribe(
            (result) => {
                this.totalPlayers = result;
            },
            (error) => console.error(error)
        );

        this.managementAccess.add(combineLatest([
            this.authService.authenticationState$, this.leagueService.selectedLeague$
        ]).pipe(switchMap(([loggedIn, league]) => {
            this.loggedIn = !!loggedIn;
            this.managementAccessLoading = loggedIn !== false;
            this.isActionAllowed = false;
            if (!loggedIn) this.userRole = '';
            return loggedIn ? this.loginService.getManagementAccess(league.leagueId)
                : of({ role: '', canManage: false });
        })).subscribe(access => {
            this.userRole = access.role;
            this.isActionAllowed = access.canManage;
            this.managementAccessLoading = false;
            if (this.createdLeagueId !== null && this.createdLeagueId === this.leagueId) {
                this.createdLeagueId = null;
                this.leagueCreationPending = false;
                if (access.canManage) this.managementTabIndex = 4;
                else this.creationError = 'League created. Its management access could not be loaded.';
            }
        }));
        this.managementAccess.add(this.authService.authenticationState$.pipe(switchMap(loggedIn =>
            loggedIn ? this.leagueService.getLeagues() : this.playerService.GetLeagues()
        ), catchError(() => of([]))).subscribe(leagues => { this.leaguesAvailable = leagues; }));
    }

    ngAfterViewInit() {
        // At this point, targetDiv is guaranteed to be initialized
    }

    clearStandings() {
        this.standings = [];
        this.maleStandings = [];
        this.femaleStandings = [];
        this.standingsRounds = [];
    }

    onLeagueChanged() {
        if (this.playerImportRef && this.playerImportRef.componentInstance.data.leagueName !== this.selectedLeague) this.playerImportRef.close();
        if (this.existingPlayerBrowserRef && this.existingPlayerBrowserRef.componentInstance.data.leagueName !== this.selectedLeague) this.existingPlayerBrowserRef.close();
        if (!this.selectedLeague) {
            return;
        }

        this.generationVersion++; this.generationBusy=false; this.generationResult=null; this.generationAttempt=null; this.generatedInput=null; this.generationFeedback=''; this.configuredTopPriorities=[];
        const contextVersion=this.generationVersion;
        this.initialRosterLoading = true;
        this.initialRosterError = '';
        // Results locks and selections belong to their league, not the next league loaded.
        this.locked=false;this.lockedResults=false;this.selectedList=[];this.queriedPlayers=[];this.savedPrintSignature=null;
        this.listOfScrambleNumbers=[]; this.listOfRetrievedScrambleNumbers=[]; this.retrievedListOfTeams=[];
        this.playerLoading = true;

        // Clear and reset relevant properties
        this.clearStandings();
        this.reset();

        const selectedLeague = this.leaguesAvailable.find((league) => league.leagueName === this.selectedLeague);

        if (selectedLeague) {
            this.selectedLeagueDto = selectedLeague;
            this.leagueId = selectedLeague.id;
            this.loadDivisionsForSelectedLeague();
        }

        this.refreshManagementRoster();
        // Reset fetch state when switching leagues
        this.fetchClicked = false;
        this.checkForSignedInPlayers();
        if (this.leagueId) {
            this.playerService.hasTopPlayers(this.leagueId).subscribe(
                available => this.hasTopPlayersAvailable = available,
                err => {
                    console.error('Error checking top players availability', err);
                    this.hasTopPlayersAvailable = false;
                }
            );
        }
        // Fetch players for the selected league
        this.playerService.SelectLeague(this.selectedLeague).subscribe((result) => {
            if(contextVersion!==this.generationVersion||this.scoreDestroyed)return;
            this.queriedPlayers = result;
            this.malePlayers1 = result.filter((player) => player.isMale);
            this.femalePlayers1 = result.filter((player) => !player.isMale);
            this.malePlayerCount = this.malePlayers1.length;
            this.femalePlayerCount = this.femalePlayers1.length;

            this.playerLoading = false;
            this.initialRosterLoading = false;
            this.awaitSettingsAndInitialize();
        }, () => {
            if (contextVersion !== this.generationVersion || this.scoreDestroyed) return;
            this.playerLoading = this.initialRosterLoading = false;
            this.initialRosterError = 'Unable to load the league roster.';
        });

        this.loadLeagueScrambles();

        // Initialize standings
        this.initializeStandings();
    }

    initialRosterLoading = false;
    initialRosterError = '';

    selectLeague() { this.onLeagueChanged(); }

    getTooltipText(): string {
        if (this.allowScrambleWithNoDuplicates) {
            return ''; // Tooltip disabled when scrambling with no duplicates is allowed
        }
        if (!this.selectedList || this.selectedList.length === 0) {
            return 'Button is disabled because no players are selected.';
        }
        if (!this.retrievedPlayersBefore) {
            return 'Retrieve players first to enable this action.';
        }
        return 'Retrieve players again to re-enable this action.'; // Tooltip for re-enable state
    }

    initializeStandings(): void {
        this.playerService.getStandingsByLeague(this.selectedLeague).subscribe(
            result => {
                this.lastResult = result;

                this.processStandings(result, this.getCurrentOptions());
            },
            error => {
                console.error("Error fetching standings:", error); // Log any errors
                this.playerLoading = false; // Ensure loading state is reset
            }
        );
    }

    loadLeagueScrambles(): void {
        this.scoreListReader?.unsubscribe();
        const leagueId = this.leagueId;
        const league = this.selectedLeague;
        this.scoreListLoading = true;
        this.scoreListError = '';
        this.scoreListReader = this.playerService.SelectedLeagueScrambles(league).subscribe({
            next: scrambles => {
                if (this.scoreDestroyed || leagueId !== this.leagueId || league !== this.selectedLeague) return;
                this.queriedScrambles = scrambles;
                this.scoreListLoading = false;
                this.selectDefaultScoreScramble();
            },
            error: () => {
                this.scoreListLoading = false;
                this.scoreListError = 'Saved scrambles could not be loaded.';
            }
        });
    }

    private selectDefaultScoreScramble(): void {
        if (!this.manageScoresActive || this.scoreEditorLoading || this.scoreSaveBusy || this.scoreSubBusy ||
            this.scoreEditsPending || (this.scoringScramble && !this.scoreReopenLatest)) return;
        const latest = this.queriedScrambles.reduce<KingQueenTeam | null>((best, candidate) => {
            if (!best) return candidate;
            const date = new Date(candidate.dateOfTeam).getTime();
            const bestDate = new Date(best.dateOfTeam).getTime();
            return date > bestDate || (date === bestDate && candidate.id > best.id) ? candidate : best;
        }, null);
        if (latest) this.retrieveScramble(latest, true);
    }

    onTabChange(event: MatTabChangeEvent): void {
        this.manageScoresActive = event.tab.textLabel === 'Manage Scores';
        if (this.manageScoresActive) {
            if (!this.scoreListLoading && (!this.scoringScramble || this.scoreReopenLatest)) this.loadLeagueScrambles();
        } else if (event.tab.textLabel === 'Standings') {
            // Initialize standings for the Standings tab
            this.innerTabIndex = 0;
            if (this.retrievedStandingsType !== this.standingsType) {
                this.toggleStandingsType(); // Call toggleStandingsType if it changed
            } else {
                this.processStandings(this.lastResult, this.getCurrentOptions()); // Call processStandings otherwise
            }
        }
    }

    standingsType: 'round' | 'matchup' = 'round'; // Default to 'round'

    toggleStandingsType(): void {
        if (this.standingsType === 'round') {
            this.standingsType = 'matchup';
            this.playerService.getStandingsByLeagueMatchup(this.selectedLeague).subscribe(
                result => {
                    this.lastResult = result;
                    this.processStandings(result, this.getCurrentOptions()); // Reuse processStandings logic
                },
                error => {
                    console.error("Error fetching matchup standings:", error);
                    this.playerLoading = false;
                }
            );
        } else {
            this.standingsType = 'round';
            this.playerService.getStandingsByLeague(this.selectedLeague).subscribe(
                result => {
                    this.lastResult = result;
                    this.processStandings(result, this.getCurrentOptions()); // Reuse processStandings logic
                },
                error => {
                    console.error("Error fetching round standings:", error);
                    this.playerLoading = false;
                }
            );
        }
    }

    // Method to toggle visibility
    togglePlayersVisibility(): void {
        this.showPlayerTeams = !this.showPlayerTeams;
    }

    toggleTeamFormationVisibility(): void {
        this.showTeamFormation = !this.showTeamFormation;
    }

    // Helper method to get the current options
    private getCurrentOptions(): { dropLowestNumber: number; numberOfSubsAllowed: number; subScorePercent: number } {
        return {
            dropLowestNumber: this.dropLowest,
            numberOfSubsAllowed: this.numberOfSubsAllowed,
            subScorePercent: this.subScorePercent
        };
    }

    // Handle Drop Lowest Scores change
    onDropLowestChange(selectedDrop: string): void {
        this.settingsDirty = true;
        this.dropLowest = parseInt(selectedDrop, 10); // Convert the string to a number
        this.processStandings(this.lastResult, this.getCurrentOptions());
        this.sortStandingsWithUpdates('totalScore');
    }

    // Handle Number of Subs Allowed change
    onNumberOfSubsChange(value: number): void {
        this.settingsDirty = true;
        this.numberOfSubsAllowed = value;
        this.processStandings(this.lastResult, this.getCurrentOptions());
        this.sortStandingsWithUpdates('totalScore');
    }

    // Handle Percent of Score for Subs change
    onSubScorePercentChange(value: number): void {
        this.settingsDirty = true;
        this.subScorePercent = value;
        this.processStandings(this.lastResult, this.getCurrentOptions());
        this.sortStandingsWithUpdates('totalScore');
    }

    saveSettings(): void {
        if (!this.isActionAllowed) {
            this.showSnackBar('You do not have access to save these league settings.', true);
            return;
        }
        const settings = [
            { settingName: 'dropLowest', settingValue: this.dropLowest },
            { settingName: 'numberOfSubsAllowed', settingValue: this.numberOfSubsAllowed },
            { settingName: 'subScorePercent', settingValue: this.subScorePercent },
            { settingName: 'dayOfLeague', settingValue: this.leagueDay },
            { settingName: 'standingsType', settingValue: this.standingsType },
        ];

        // Create an array of promises for each setting update
        const updatePromises = settings.map(setting =>
            this.loginService.updateSetting(setting.settingName, setting.settingValue.toString(), this.leagueId).toPromise()
        );

        // Wait for all updates to complete
        this.settingsSaving = true;
        const leagueId = this.leagueId;
        const savedValues = JSON.stringify(settings.map(setting => setting.settingValue));
        Promise.all(updatePromises)
            .then(results => {
                if (leagueId === this.leagueId && results.every(result => result === true) &&
                    savedValues === JSON.stringify([this.dropLowest, this.numberOfSubsAllowed, this.subScorePercent, this.leagueDay, this.standingsType])) {
                    this.settingsDirty = false;
                }
                this.snackBar.open('Standings have been saved.', 'OK', {
                    duration: 5000, // Optional: Auto-close after 5 seconds
                    verticalPosition: 'top',
                    horizontalPosition: 'center',
                    panelClass: ['custom-snackbar']
                });
            })
            .catch(error => {
                console.error('Error saving settings:', error);
            }).finally(() => { this.settingsSaving = false; });
    }


    onStandingsTypeChange(selectedType: string): void {
        this.settingsDirty = true;
        this.standingsType = selectedType as 'round' | 'matchup';
    }

    private processStandings(
        result: any,
        options: { dropLowestNumber?: number; numberOfSubsAllowed?: number; subScorePercent?: number } = {}
    ): void {
        if (result != null && result.message != 'No valid rounds found in the league.') {
            // Save the original scores only once
            if (!this.originalStandings) {
                if (result.playerScores != null) {
                    this.originalStandings = JSON.parse(JSON.stringify(result.playerScores)); // Deep copy to preserve original data
                }
            }

            // Reset standings to the original scores
            if (this.lastResult == null) {
                this.standings = JSON.parse(JSON.stringify(this.originalStandings));
            }
            else {
                this.standings = this.lastResult.playerScores;
            }

            if (this.standings && this.standings.length > 0) {
                // Separate standings by gender
                this.maleStandings = this.standings.filter(player => player.isMale);
                this.femaleStandings = this.standings.filter(player => !player.isMale);

                const calculateStandings = (standings: PlayerScoreGroup[]) =>
                    standings.map(player => {
                        // Create a copy of the original scores for modification
                        const updatedScores = player.scores.map(score => ({ ...score, isDropped: false, isReduced: false }));

                        const totalScoreBeforeReduction = updatedScores
                            .filter(score => !score.isDropped) // Exclude dropped scores
                            .reduce((sum, score) => sum + score.score, 0);


                        // Filter sub-scores from the updated scores
                        const subScores = updatedScores.filter(score => score.isSubScore);

                        const sortedSubScores = subScores;//subScores.slice().sort((a, b) => b.roundId - a.roundId);

                        // Adjust sub-scores beyond the allowed limit
                        sortedSubScores.forEach((subScore, subIndex) => {
                            const isReduced = subIndex >= options.numberOfSubsAllowed;
                            // Find and update the matching score in updatedScores
                            const matchingScoreIndex = updatedScores.findIndex(score => score === subScore);
                            if (matchingScoreIndex !== -1) {
                                updatedScores[matchingScoreIndex] = {
                                    ...updatedScores[matchingScoreIndex],
                                    score: isReduced
                                        ? (updatedScores[matchingScoreIndex].score * options.subScorePercent) / 100
                                        : updatedScores[matchingScoreIndex].score,
                                    isReduced: isReduced
                                };
                            }
                        });

                        // Sort scores in ascending order (after reduction) for dropping the lowest ones
                        const sortedScores = updatedScores.slice().sort((a, b) => a.score - b.score);

                        // Mark the lowest scores to drop
                        sortedScores.slice(0, options.dropLowestNumber).forEach(droppedScore => {
                            const matchingScoreIndex = updatedScores.findIndex(score => score === droppedScore);
                            if (matchingScoreIndex !== -1) {
                                updatedScores[matchingScoreIndex] = {
                                    ...updatedScores[matchingScoreIndex],
                                    isDropped: true
                                };
                            }
                        });

                        // Calculate total score
                        const totalScore = updatedScores
                            .filter(score => !score.isDropped)
                            .reduce((sum, score) => sum + score.score, 0);

                        // Calculate total wins
                        const totalWins = updatedScores
                            .filter(score => !score.isDropped)
                            .reduce((sum, score) => sum + score.roundWon, 0);

                        // Return updated player
                        return {
                            ...player,
                            scores: updatedScores, // Include updated scores with `isDropped` and `isReduced`
                            totalScore: totalScore,
                            totalWins: totalWins,
                            totalScoreBeforeReduction: totalScoreBeforeReduction
                        };
                    }).sort((a, b) => {
                        // Sort by total wins descending, then by total score descending
                        if (b.totalWins !== a.totalWins) {
                            return b.totalWins - a.totalWins;
                        }
                        return b.totalScore - a.totalScore;
                    });


                this.maleStandings = calculateStandings(this.maleStandings);
                this.femaleStandings = calculateStandings(this.femaleStandings);

                // Generate standingsRounds array
                this.standingsRounds = [];
                for (let i = 0; i < result.maxRounds; i++) {
                    this.standingsRounds.push(i + 1);
                }

                this.initializeStandingsRounds(); // Initialize rounds for standings
            }
        }
        this.playerLoading = false;
    }

    async applyTopPlayersFromMaleStandings(): Promise<void> {
        await this.applyRankedTopPlayers(true);
    }

    private async applyRankedTopPlayers(maleStandingsOnly: boolean): Promise<void> {
        if(this.generationBusy)return;
        const league=this.leagueId,signature=this.generationSignature();
        try {
            const count=this.currentGenerationCount(), priorities=await this.loadGenerationTopPriorities(league);
            if(this.leagueId!==league||this.generationSignature()!==signature)return;
            const standings=[...(this.maleStandings||[]),...(this.femaleStandings||[])];
            const candidates=this.selectedList.filter(p=>!p.isByePlayer&&(maleStandingsOnly
                ? p.isMale&&(this.maleStandings||[]).some(s=>s.playerId===p.id)
                : priorities.some(priority=>priority.playerId===p.id)));
            if(!candidates.length){this.showSnackBar('No eligible selected players have '+(maleStandingsOnly?'male standings.':'configured Top Player entries.'),true);return;}
            const retained=rankTopPlayers(candidates,priorities,standings).slice(0,count);
            this.selectedList.concat(this.malePlayers1,this.femalePlayers1).forEach(p=>p.isTopPlayer=false);
            this.totalTopPlayers=[];this.displayTopPlayers=[];
            retained.forEach(p=>this.addPlayerToTopPlayerList(this.selectedList.find(player=>player.id===p.id)));
            this.applyClicked=true;
        }catch(error){this.showSnackBar('Top player priorities could not be applied. Selections are unchanged.',true);}
    }

    legacyApplyTopPlayersFromMaleStandings(): void {
        const maxPlayers = this.teamCount;

        if (maxPlayers == null || maxPlayers <= 0) {
            console.error('applyTopPlayersFromMaleStandings: teamCount is not set or invalid.');
            return;
        }

        if (this.malePlayers1 != null) {
            this.malePlayers1.forEach(m => m.isTopPlayer = false);
        }

        if (this.femalePlayers1 != null) {
            this.femalePlayers1.forEach(f => f.isTopPlayer = false);
        }

        this.totalTopPlayers = [];
        this.displayTopPlayers = [];

        if (this.maleStandings == null || this.maleStandings.length === 0) {
            console.error('applyTopPlayersFromMaleStandings: maleStandings is empty. Standings may not be loaded yet.');
            return;
        }

        if (this.selectedList == null || this.selectedList.length === 0) {
            console.error('applyTopPlayersFromMaleStandings: selectedList is empty.');
            return;
        }

        const isGold = (s: any): boolean => {
            let code = '';
            let name = '';

            if (s != null && s.leagueDivisionCode != null) {
                code = ('' + s.leagueDivisionCode).toUpperCase();
            }
            if (s != null && s.leagueDivisionName != null) {
                name = ('' + s.leagueDivisionName).toUpperCase();
            }

            if (code === 'GM') {
                return true;
            }

            if (name === 'GOLD MALE') {
                return true;
            }

            if (name.indexOf('GOLD') >= 0) {
                return true;
            }

            return false;
        };

        const standingsEligible: any[] = [];

        for (let i = 0; i < this.maleStandings.length; i++) {
            const s: any = this.maleStandings[i];
            if (s == null) {
                continue;
            }

            let matchedPlayer: Player = null;

            for (let j = 0; j < this.selectedList.length; j++) {
                const sp = this.selectedList[j];
                if (sp != null && sp.id === s.playerId) {
                    matchedPlayer = sp;
                    break;
                }
            }

            if (matchedPlayer == null) {
                continue;
            }

            if (matchedPlayer.isMale !== true) {
                continue;
            }

            standingsEligible.push(s);
        }

        // Sort by: 1) king/queen score (totalScore) desc
        //          2) GOLD status (gold before non-gold)  even if gold total points are lower
        //          3) totalScoreBeforeReduction desc
        //          4) playerName as deterministic fallback
        const sortedEligible = standingsEligible.slice().sort((a: any, b: any) => {
            const aKq = a != null && a.totalScore != null ? a.totalScore : 0;
            const bKq = b != null && b.totalScore != null ? b.totalScore : 0;

            if (bKq !== aKq) {
                return bKq - aKq;
            }

            const aGold = isGold(a);
            const bGold = isGold(b);

            if (aGold && !bGold) {
                return -1; // a (gold) before b
            }
            if (!aGold && bGold) {
                return 1; // b (gold) before a
            }

            const aTotal = a != null && a.totalScoreBeforeReduction != null ? a.totalScoreBeforeReduction : 0;
            const bTotal = b != null && b.totalScoreBeforeReduction != null ? b.totalScoreBeforeReduction : 0;

            if (bTotal !== aTotal) {
                return bTotal - aTotal;
            }

            const nameA = (a.playerName || '').toLowerCase();
            const nameB = (b.playerName || '').toLowerCase();
            if (nameA > nameB) return 1;
            if (nameA < nameB) return -1;
            return 0;
        });

        const selectedTopPlayers: Player[] = [];

        let idx = 0;

        while (idx < sortedEligible.length && selectedTopPlayers.length < maxPlayers) {
            const current = sortedEligible[idx];

            const currentKq = current != null && current.totalScore != null ? current.totalScore : 0;
            const currentTotal = current != null && current.totalScoreBeforeReduction != null ? current.totalScoreBeforeReduction : 0;

            const tieGroup: any[] = [];
            tieGroup.push(current);

            let nextIdx = idx + 1;

            // Group only exact ties on king/queen score and (after gold priority) total before reduction.
            // This keeps gold priority enforced by the sort above, while still handling exact duplicates deterministically.
            while (nextIdx < sortedEligible.length) {
                const next = sortedEligible[nextIdx];

                const nextKq = next != null && next.totalScore != null ? next.totalScore : 0;
                const nextTotal = next != null && next.totalScoreBeforeReduction != null ? next.totalScoreBeforeReduction : 0;

                // consider equal if both KQ and totalBeforeReduction match
                if (nextKq === currentKq && nextTotal === currentTotal) {
                    tieGroup.push(next);
                    nextIdx++;
                } else {
                    break;
                }
            }

            if (tieGroup.length === 1) {
                const standingPlayer = tieGroup[0];

                let matchedPlayer: Player = null;

                for (let j = 0; j < this.selectedList.length; j++) {
                    const sp = this.selectedList[j];
                    if (sp != null && sp.id === standingPlayer.playerId) {
                        matchedPlayer = sp;
                        break;
                    }
                }

                if (matchedPlayer != null && selectedTopPlayers.length < maxPlayers) {
                    let alreadyAdded = false;

                    for (let k = 0; k < selectedTopPlayers.length; k++) {
                        if (selectedTopPlayers[k] != null && selectedTopPlayers[k].id === matchedPlayer.id) {
                            alreadyAdded = true;
                            break;
                        }
                    }

                    if (!alreadyAdded) {
                        selectedTopPlayers.push(matchedPlayer);
                    }
                }
            }
            else {
                // tieGroup contains exact KQ+total ties. Keep existing tie-resolution:
                // prefer gold players within the tieGroup, otherwise randomize non-gold order.
                const goldGroup: any[] = [];
                const nonGoldGroup: any[] = [];

                for (let t = 0; t < tieGroup.length; t++) {
                    const s = tieGroup[t];
                    if (isGold(s)) {
                        goldGroup.push(s);
                    }
                    else {
                        nonGoldGroup.push(s);
                    }
                }

                for (let t = 0; t < goldGroup.length && selectedTopPlayers.length < maxPlayers; t++) {
                    const standingPlayer = goldGroup[t];

                    let matchedPlayer: Player = null;

                    for (let j = 0; j < this.selectedList.length; j++) {
                        const sp = this.selectedList[j];
                        if (sp != null && sp.id === standingPlayer.playerId) {
                            matchedPlayer = sp;
                            break;
                        }
                    }

                    if (matchedPlayer != null) {
                        let alreadyAdded = false;

                        for (let k = 0; k < selectedTopPlayers.length; k++) {
                            if (selectedTopPlayers[k] != null && selectedTopPlayers[k].id === matchedPlayer.id) {
                                alreadyAdded = true;
                                break;
                            }
                        }

                        if (!alreadyAdded) {
                            selectedTopPlayers.push(matchedPlayer);
                        }
                    }
                }

                if (selectedTopPlayers.length < maxPlayers && nonGoldGroup.length > 0) {
                    const shuffled = nonGoldGroup.slice();

                    for (let a = shuffled.length - 1; a > 0; a--) {
                        const r = Math.floor(Math.random() * (a + 1));
                        const tmp = shuffled[a];
                        shuffled[a] = shuffled[r];
                        shuffled[r] = tmp;
                    }

                    for (let t = 0; t < shuffled.length && selectedTopPlayers.length < maxPlayers; t++) {
                        const standingPlayer = shuffled[t];

                        let matchedPlayer: Player = null;

                        for (let j = 0; j < this.selectedList.length; j++) {
                            const sp = this.selectedList[j];
                            if (sp != null && sp.id === standingPlayer.playerId) {
                                matchedPlayer = sp;
                                break;
                            }
                        }

                        if (matchedPlayer != null) {
                            let alreadyAdded = false;

                            for (let k = 0; k < selectedTopPlayers.length; k++) {
                                if (selectedTopPlayers[k] != null && selectedTopPlayers[k].id === matchedPlayer.id) {
                                    alreadyAdded = true;
                                    break;
                                }
                            }

                            if (!alreadyAdded) {
                                selectedTopPlayers.push(matchedPlayer);
                            }
                        }
                    }
                }
            }

            idx = nextIdx;
        }

        for (let i = 0; i < selectedTopPlayers.length; i++) {
            const p = selectedTopPlayers[i];
            if (p != null) {
                this.addPlayerToTopPlayerList(p);
            }
        }
        this.applyClicked = true;
        if (selectedTopPlayers.length < maxPlayers) {
            console.log(
                'applyTopPlayersFromMaleStandings: Not enough eligible males found in selectedList using standings order + tie-division priority. Needed: ' +
                maxPlayers +
                ', Found: ' +
                selectedTopPlayers.length
            );
        }
    }


    // This method should be called whenever a new `result` is received
    setNewStandings(result: any): void {
        this.originalStandings = JSON.parse(JSON.stringify(result.playerScores)); // Deep copy of initial standings
        this.processStandings(result, this.getCurrentOptions());
    }

    sortStandings(column: string) {
        if (this.sortColumn === column) {
            // Toggle sort direction if the same column is clicked
            this.sortDirection = this.sortDirection === 'desc' ? 'asc' : 'desc';
        } else {
            // Set new column and default to ascending
            this.sortColumn = column;
            this.sortDirection = 'desc';
        }
        this.sortMaleStandings(column);
        this.sortFemaleStandings(column);
    }

    sortStandingsWithUpdates(column: string) {

        this.sortDirection = 'desc';

        this.sortMaleStandings(column);
        this.sortFemaleStandings(column);
    }

    sortColumn: string = ''; // Currently sorted column
    sortDirection: 'asc' | 'desc' = 'asc'; // Track sort direction

    sortMaleStandings(column: string) {

        const compare = (a: any, b: any): number => {
            // Helper to get primary value
            const getPrimary = (obj: any) => {
                if (column === 'playerName') {
                    return (obj.playerName || '').toLowerCase();
                }
                return obj[column] !== undefined && obj[column] !== null ? obj[column] : 0;
            };

            const primaryA = getPrimary(a);
            const primaryB = getPrimary(b);

            // String comparison for playerName
            if (column === 'playerName') {
                if (primaryA > primaryB) return this.sortDirection === 'asc' ? 1 : -1;
                if (primaryA < primaryB) return this.sortDirection === 'asc' ? -1 : 1;
                return 0;
            }

            // Numeric comparison for other columns
            const numA = Number(primaryA) || 0;
            const numB = Number(primaryB) || 0;

            if (numA !== numB) {
                return this.sortDirection === 'asc' ? (numA - numB) : (numB - numA);
            }

            // Tie-breaker #1: totalScoreBeforeReduction (use when primary equals)
            const tieA = Number(a.totalScoreBeforeReduction || 0);
            const tieB = Number(b.totalScoreBeforeReduction || 0);
            if (tieA !== tieB) {
                // always prefer higher totalScoreBeforeReduction when descending, and vice versa
                return this.sortDirection === 'asc' ? (tieA - tieB) : (tieB - tieA);
            }

            // Tie-breaker #2: final fallback to playerName (stable, deterministic)
            const nameA = (a.playerName || '').toLowerCase();
            const nameB = (b.playerName || '').toLowerCase();
            if (nameA > nameB) return 1;
            if (nameA < nameB) return -1;
            return 0;
        };

        this.maleStandings = [...this.maleStandings].sort(compare);
    }

    // Sorting for female standings
    sortFemaleStandings(column: string) {
        const compare = (a: any, b: any): number => {
            const getPrimary = (obj: any) => {
                if (column === 'playerName') {
                    return (obj.playerName || '').toLowerCase();
                }
                return obj[column] !== undefined && obj[column] !== null ? obj[column] : 0;
            };

            const primaryA = getPrimary(a);
            const primaryB = getPrimary(b);

            if (column === 'playerName') {
                if (primaryA > primaryB) return this.sortDirection === 'asc' ? 1 : -1;
                if (primaryA < primaryB) return this.sortDirection === 'asc' ? -1 : 1;
                return 0;
            }

            const numA = Number(primaryA) || 0;
            const numB = Number(primaryB) || 0;

            if (numA !== numB) {
                return this.sortDirection === 'asc' ? (numA - numB) : (numB - numA);
            }

            // Tie-breaker: totalScoreBeforeReduction
            const tieA = Number(a.totalScoreBeforeReduction || 0);
            const tieB = Number(b.totalScoreBeforeReduction || 0);
            if (tieA !== tieB) {
                return this.sortDirection === 'asc' ? (tieA - tieB) : (tieB - tieA);
            }

            const nameA = (a.playerName || '').toLowerCase();
            const nameB = (b.playerName || '').toLowerCase();
            if (nameA > nameB) return 1;
            if (nameA < nameB) return -1;
            return 0;
        };

        this.femaleStandings = [...this.femaleStandings].sort(compare);
    }



    onRoundsChange(newRounds: number): void {

        this.selectedRounds = newRounds; // Update the selected number of rounds
        this.updateRounds(); // Adjust the rounds dynamically
        if(!this.scoringScramble)this.initializeScores();
    }

    updateRounds(): void {
        // Update rounds array
        this.rounds = Array.from({ length: this.selectedRounds }, (_, index) => index + 1);

        const team = this.scoringScramble ? this.scoreTeams : (this.retrievedListOfTeams && this.retrievedListOfTeams.length > 0)
            ? this.retrievedListOfTeams
            : this.listOfTeams;

        // Ensure `team` is defined and has elements
        if (!team || team.length === 0) {
            console.warn('No teams available to update round scores.');
            return;
        }

        team.forEach(team => {
            // Ensure `roundScores[team.kingQueenTeamId]` is initialized
            if (!this.roundScores[team.kingQueenTeamId]) {
                this.roundScores[team.kingQueenTeamId] = [];
            }

            const existingScores = this.roundScores[team.kingQueenTeamId];
            const existingRounds = existingScores.length;

            if (existingRounds > this.selectedRounds) {
                // Trim excess rounds

                this.roundScores[team.kingQueenTeamId] = existingScores.slice(0, this.selectedRounds);

            } else if (existingRounds < this.selectedRounds) {
                // Add missing rounds, preserving existing scores

                for (let i = existingRounds; i < this.selectedRounds; i++) {
                    this.roundScores[team.kingQueenTeamId].push({ RoundScore: 0, RoundWon: false });
                }

            } else {

            }
        });

    }

    // Method to calculate teams based on selected players
    calculateTeamsNeeded(): void {
        let totalPlayers = this.selectedList.length - this.byePlayers.length;

        // Calculate the number of teams and remainder for each team size
        this.teamsNeededTwo = Math.floor(totalPlayers / 2);
        this.remainderTwo = totalPlayers % 2;

        this.teamsNeededThree = Math.floor(totalPlayers / 3);
        this.remainderThree = totalPlayers % 3;

        this.teamsNeededFour = Math.floor(totalPlayers / 4);
        this.remainderFour = totalPlayers % 4;




        this.fourPlayerTeams = 0;
        this.threePlayerTeams = 0;
        this.twoPlayerTeams = 0;
        this.fivePlayerTeams = 0;
        this.sixPlayerTeams = 0;
        this.sevenPlayerTeams = 0;
        this.eightPlayerTeams = 0;
        this.ninePlayerTeams = 0;
        this.tenPlayerTeams = 0;
        // 1) Basic details
        const totalTeams = this.teamCount; // e.g., 14 or 16, etc.
        // Edge case: If totalTeams is 0 or negative, abort to avoid division errors
        if (totalTeams <= 0) {
            console.warn('teamCount is zero or negative. Cannot distribute players.');
            return;
        }

        // 2) Base players per team + leftover players
        const basePlayersPerTeam = Math.floor(totalPlayers / totalTeams);
        this.leftoverPlayers = totalPlayers % totalTeams;

        // 3) Create an array for the size of each team (start everyone at `basePlayersPerTeam`)
        const forcedTeamSizes = new Array(totalTeams).fill(basePlayersPerTeam);

        // 4) Distribute leftover players (one per team) until we run out of leftover
        const maxTeamSize = this.maxTeamSize !== null && this.maxTeamSize !== undefined ? this.maxTeamSize : 4; // Default max team size to 10
        for (let i = 0; i < forcedTeamSizes.length && this.leftoverPlayers > 0; i++) {
            if (forcedTeamSizes[i] < maxTeamSize) {
                forcedTeamSizes[i]++;
                this.leftoverPlayers--;
                i = i === forcedTeamSizes.length - 1 ? -1 : i; // Reset to start if leftover remains and not all teams are filled
            }
        }

        // 5) Count how many teams ended up with 2 to 10 players
        this.twoPlayerTeams = forcedTeamSizes.filter(size => size === 2).length;
        this.threePlayerTeams = forcedTeamSizes.filter(size => size === 3).length;
        this.fourPlayerTeams = forcedTeamSizes.filter(size => size === 4).length;
        this.fivePlayerTeams = forcedTeamSizes.filter(size => size === 5).length;
        this.sixPlayerTeams = forcedTeamSizes.filter(size => size === 6).length;
        this.sevenPlayerTeams = forcedTeamSizes.filter(size => size === 7).length;
        this.eightPlayerTeams = forcedTeamSizes.filter(size => size === 8).length;
        this.ninePlayerTeams = forcedTeamSizes.filter(size => size === 9).length;
        this.tenPlayerTeams = forcedTeamSizes.filter(size => size === 10).length;
    }


    addPlayer(player) {
        this.malePlayersDisplayCount = new Array();
        this.femalePlayersDisplayCount = new Array();
        for (let player of this.selectedList) {
            if (player.isMale) {
                this.malePlayersDisplayCount.push(player);

            }
            else {
                this.femalePlayersDisplayCount.push(player);
            }
        }

        this.malePlayerCount = this.malePlayersDisplayCount.length;
        this.femalePlayerCount = this.femalePlayersDisplayCount.length;
        this.calculateTeamsNeeded();
    }

    updateScrambleNumbers(selectedItems: any[]) {
        // Clear the existing list and add selected items
        this.listOfScrambleNumbers.length = 0; // Clear the array
        selectedItems.forEach(selected => {
            this.listOfScrambleNumbers.push(selected.scrambleNumber);
        });


    }

    addLeague(): void {
        const name = this.LeagueForm.controls['newLeagueName'].value?.trim();
        if (!this.canCreateLeague || !name || this.leagueCreationPending) return;
        if (this.leaguesAvailable?.some(league => league.leagueName.toLowerCase() === name.toLowerCase())) {
            this.showSnackBar('League name already exists.', true);
            return;
        }

        this.creationError = '';
        this.leagueCreationPending = true;
        this.playerService.AddNewLeague(name).subscribe({
            next: created => {
                this.showSnackBar('League created.');
                this.LeagueForm.reset();
                this.leagueService.getLeagues().subscribe({
                    next: leagues => {
                        if (!leagues.some(league => league.id === created.id)) {
                            this.leagueCreationPending = false;
                            this.creationError = 'League created. Refresh your league list to configure it.';
                            return;
                        }
                        this.createdLeagueId = created.id;
                        this.leaguesAvailable = leagues;
                        this.leagueService.setSelectedLeague(created.id);
                    },
                    error: () => {
                        this.leagueCreationPending = false;
                        this.creationError = 'League created. Reload the page to refresh your leagues.';
                    }
                });
            },
            error: error => {
                this.leagueCreationPending = false;
                this.creationError = error.status === 409 ? 'League name already exists.' : 'Could not create the league. Try again.';
            }
        });
    }

    hidePlayerList() {
        this.hidePlayers = !this.hidePlayers;
    }

    //hideOptions() {
    //    this.hideInputOptions = !this.hideInputOptions;
    //    this.hideListOptions = !this.hideListOptions;
    //    var x = document.getElementById("hideInputOptions");
    //    if (x.style.display === "none") {
    //        x.style.display = "block";
    //    } else {
    //        x.style.display = "none";
    //    }
    //    var y = document.getElementById("hideListOptions");
    //    if (y.style.display === "none") {
    //        y.style.display = "block";
    //    } else {
    //        y.style.display = "none";
    //    }
    //}

    getTotalMaleSelectedPlayers() {
        return this.selectedList.filter(player => player.isMale).length;
    }

    getTotalFemaleSelectedPlayers() {
        return this.selectedList.filter(player => !player.isMale).length;
    }

    onOptionClick(player: any): void {

        // Call your team count logic
        this.setTeamCount();

    }


    scrambleRulesExpanded = false;

    get enabledScrambleRuleCount(): number {
        return [this.completeRandom, this.lockedResults, this.prioritizePreviousTeammates, this.allowMinimumRepeats].filter(Boolean).length;
    }

    deselectAllPlayers() {
        this.selectedList = [];
        this.updateSelectedList();
        this.calculateTeamsNeeded();
    }

    applyTopPlayers(): void { this.applyRankedTopPlayers(false); }

    legacyApplyTopPlayers(): void {
        const maxPlayers = this.teamCount;
        this.playerService.getTopPlayersForLeague(this.leagueId, maxPlayers).subscribe(
            (topPlayers: Player[]) => {
                // 1) Reset all players in your arrays (male & female) to isTopPlayer = false
                this.malePlayers1.forEach(m => m.isTopPlayer = false);
                this.femalePlayers1.forEach(f => f.isTopPlayer = false);

                // 2) Clear out totalTopPlayers & displayTopPlayers since we'll repopulate
                this.totalTopPlayers = [];
                this.displayTopPlayers = [];

                const filteredTopPlayers = topPlayers.filter(tp =>
                    this.selectedList.some(selected => selected.id === tp.id)
                );

                const limitedTopPlayers = filteredTopPlayers.slice(0, this.teamCount);

                // 3) For each returned top player, find it in local arrays and call your addPlayerToTopPlayerList
                limitedTopPlayers.forEach(returnedTopP => {
                    // Attempt to find a match in the selectedList
                    const matchedPlayer = this.selectedList.find(sp => sp.id === returnedTopP.id);
                    if (matchedPlayer) {
                        this.addPlayerToTopPlayerList(matchedPlayer);
                    }
                });
                this.applyClicked = true;
            },
            (error) => {
                console.error('Error fetching top players:', error);
            }
        );
    }


    fetchSelectedList(): void {
        if (!this.selectedLeague) {
            console.error('No league selected. Cannot fetch selected players.');
            return;
        }

        this.selectedList = [];
        this.updateSelectedList();
        const today = new Date(); // Get current date without time
        this.playerService.getSelectedPlayersAsPlayers(this.leagueId, today).subscribe(
            (fetchedPlayers: Player[]) => {
                fetchedPlayers.forEach(fetchedPlayer => {
                    let isAdded = false;

                    // Check in malePlayers1
                    for (let i = 0; i < this.malePlayers1.length; i++) {
                        const player = this.malePlayers1[i];
                        if (player.id === fetchedPlayer.id) {
                            this.selectedList.push(player);
                            this.addPlayer(player);
                            isAdded = true;
                            break; // Stop further checks in malePlayers1
                        }
                    }

                    // Check in femalePlayers1
                    if (!isAdded) {
                        for (let i = 0; i < this.femalePlayers1.length; i++) {
                            const player = this.femalePlayers1[i];
                            if (player.id === fetchedPlayer.id) {
                                this.selectedList.push(player);
                                this.addPlayer(player);
                                isAdded = true;
                                break; // Stop further checks in femalePlayers1
                            }
                        }
                    }

                    // If not found in either list, add directly to `selectedList`
                    if (!isAdded) {
                        this.selectedList.push(fetchedPlayer);
                    }
                });

                // Trigger Angular change detection to refresh UI
                this.selectedList = [...this.selectedList];
                this.updateSelectedList();

                // Mark that user has fetched signed-in players; button should become grey but remain clickable
                this.fetchClicked = true;
            },
            (error) => {
                console.error('Error fetching selected players:', error);
            }
        );
    }



    selectAllPlayers() {
        // Clear the selected list first
        this.selectedList = [];

        // Add all male players to the selected list (excluding players with first name "open" or "Open")
        this.malePlayers1.forEach(player => {
            if (!/open/i.test(player.firstName)) {
                this.selectedList.push(player);
            }
        });

        // Add all female players to the selected list (excluding players with first name "open" or "Open")
        this.femalePlayers1.forEach(player => {
            if (!/open/i.test(player.firstName)) {
                this.selectedList.push(player);
            }
        });

        // Update the male and female player counts
        this.malePlayerCount = this.malePlayers1.filter(player => !/open/i.test(player.firstName)).length;
        this.femalePlayerCount = this.femalePlayers1.filter(player => !/open/i.test(player.firstName)).length;

        this.calculateTeamsNeeded();
        this.updateSelectedList();
    }

    onLeagueDayChange(selectedDay: string): void {
        this.settingsDirty = true;
        this.leagueDay = selectedDay;
    }

    deletePlayerLogic() {
        // Get the selected player's first and last name from the form controls
        const firstNameToDelete = this.deletePlayerForm.controls["firstName"].value;
        const lastNameToDelete = this.deletePlayerForm.controls["lastName"].value;

        if (!firstNameToDelete || !lastNameToDelete || !this.selectedLeague) {
            this.showSnackBar("Please select both a player and a league to delete the player.");
            return;
        }

        let deletingPlayer: Player = {
            id: 0,
            firstName: firstNameToDelete,
            lastName: lastNameToDelete,
            gender: 'male',
            isMale: true,
            isSub: false
        };

        this.playerService.DeletePlayer(deletingPlayer, this.selectedLeague).subscribe(result => {

            let test = result;

            if (result) {
                const maleIndex = this.malePlayers1.findIndex(
                    player => player.firstName === firstNameToDelete && player.lastName === lastNameToDelete
                );

                if (maleIndex !== -1) {
                    this.malePlayers1.splice(maleIndex, 1);
                }

                // Find the player in the femalePlayers1 array and remove it
                const femaleIndex = this.femalePlayers1.findIndex(
                    player => player.firstName === firstNameToDelete && player.lastName === lastNameToDelete
                );

                if (femaleIndex !== -1) {
                    this.femalePlayers1.splice(femaleIndex, 1);
                }

                // Clear the form and display a success message
                this.deletePlayerForm.reset();
                this.showSnackBar("Player deleted successfully.");
            }
            // Find the player in the malePlayers1 array and remove it


        }, error => console.error(error));
    }


    onDeletePlayerClick() {
        if (this.isActionAllowed) this.deletePlayerLogic();
    }

    addPlayerLogic() {
        const selectedGenderValue = this.PlayerForm.get("selectedGender").value;
        const isMale = selectedGenderValue === "Male";

        if (
            this.PlayerForm.controls["firstName"].value == "" ||
            this.PlayerForm.controls["lastName"].value == "" ||
            !selectedGenderValue
        ) {
            this.showSnackBar(
                "Please ensure that both first and last name fields are filled in as well as the gender field."
            );
        } else {
            let newPlayer: Player = {
                id: 0,
                firstName: this.PlayerForm.controls["firstName"].value,
                lastName: this.PlayerForm.controls["lastName"].value,
                gender: selectedGenderValue,
                isMale: isMale,
                isSub: this.PlayerForm.controls["isSub"].value,
            };

            if (this.selectedLeague != null) {
                this.playerService.AddPlayer(newPlayer, this.selectedLeague).subscribe(
                    (result) => {
                        this.player = result;
                        this.containsFemale = false;
                        this.containsMale = false;

                        // Check if the player already exists
                        for (var i = 0; i < this.malePlayers1.length; i++) {
                            if (
                                this.malePlayers1[i].firstName == result.firstName &&
                                this.malePlayers1[i].lastName == result.lastName
                            ) {
                                this.containsMale = true;
                                break;
                            }
                        }
                        for (var i = 0; i < this.femalePlayers1.length; i++) {
                            if (
                                this.femalePlayers1[i].firstName == result.firstName &&
                                this.femalePlayers1[i].lastName == result.lastName
                            ) {
                                this.containsFemale = true;
                                break;
                            }
                        }
                        if (this.containsMale || this.containsFemale) {
                            this.showSnackBar("Player already in the list.");
                        } else {
                            if (newPlayer.isMale) {
                                this.malePlayers1.push(newPlayer);
                                this.malePlayers1.sort((a, b) => a.lastName.localeCompare(b.lastName));
                            } else {
                                this.femalePlayers1.push(newPlayer);
                                this.femalePlayers1.sort((a, b) => a.lastName.localeCompare(b.lastName));
                            }
                            // Show success message
                            this.showSnackBar("Player added successfully!");
                        }
                        this.refreshManagementRoster();
                    },
                    (error) => { console.error(error); this.showSnackBar('An error occurred while creating the player.', true); }
                );
            } else {
                this.showSnackBar("Please Select A League From The Dropdown");
            }
        }
    }


    onSubmitClick() {
        if (this.isActionAllowed) this.addPlayerLogic();
    }



    showSnackBar(message: string, error: boolean = false) {
        const config = new MatSnackBarConfig();
        config.verticalPosition = 'top'; // Set the vertical position to center
        config.horizontalPosition = 'center'; // Set the horizontal position to center
        config.duration = 3000;
        config.panelClass = 'custom-snackbar';
        if (error) {
            this.snackBar.open(message, 'Close', {
                duration: 3000,
                verticalPosition: 'top',
                horizontalPosition: 'center',
                panelClass: ['red-snackbar']
            });
        }
        else {
            this.snackBar.open(message, 'Close', config);
        }
    }

    maleScramble(bracketTeamPlayers) {
        this.randomMalePlayer = this.malePlayers[Math.floor(Math.random() * this.malePlayers.length)];
        bracketTeamPlayers.push(this.randomMalePlayer);
        this.malePlayers = this.malePlayers.filter(x => x !== this.randomMalePlayer);
        this.totalPlayers = this.totalPlayers.filter(x => x !== this.randomMalePlayer);
        return true;
    }


    maleScramble2(bracketTeamPlayers) {
        let randomMalePlayer;
        let players;
        let maxIterations = 100000; // Set a reasonable maximum number of iterations
        let iterations = 0;

        while (iterations < maxIterations) {
            if (this.malePlayers.length > 0) {
                randomMalePlayer = this.malePlayers[Math.floor(Math.random() * this.malePlayers.length)];
                players = this.getPlayersInSameTeam(randomMalePlayer, this.retrievedListOfTeams);
                if (!players.some(player => bracketTeamPlayers.some(bp => this.arePlayersEqual(player, bp)))) {
                    // Found a valid player
                    this.randomMalePlayer = randomMalePlayer;
                    bracketTeamPlayers.push(this.randomMalePlayer);
                    this.malePlayers = this.malePlayers.filter(x => x !== this.randomMalePlayer);
                    this.totalPlayers = this.totalPlayers.filter(x => x !== this.randomMalePlayer);
                    return true; // Exit the function
                }
            }
            else {
                return true;
            }


            iterations++;
        }
        // If the loop reaches the maximum number of iterations without finding a valid player, consider handling this case (e.g., returning false or throwing an exception).
        return false;
    }


    getPlayersInSameTeam(targetPlayer: Player, teams: Team[]): Player[] {
        const playersInSameTeam: Player[] = [];

        teams.forEach((team) => {
            if (team.players.some((player) => this.arePlayersEqual(player, targetPlayer))) {
                // If the targetPlayer is found in this team, add all players from this team
                playersInSameTeam.push(...team.players);
            }
        });

        return playersInSameTeam;
    }

    arePlayersEqual(playerA: Player, playerB: Player): boolean {
        return !!playerA&&!!playerB&&Number.isInteger(playerA.id)&&playerA.id>0&&playerA.id===playerB.id;
    }


    femaleScramble(bracketTeamPlayers) {
        this.randomFemalePlayer = this.femalePlayers[Math.floor(Math.random() * this.femalePlayers.length)];
        bracketTeamPlayers.push(this.randomFemalePlayer);
        this.femalePlayers = this.femalePlayers.filter(x => x !== this.randomFemalePlayer);
        this.totalPlayers = this.totalPlayers.filter(x => x !== this.randomFemalePlayer);
        return true;
    }

    femaleScramble2(bracketTeamPlayers) {
        let randomFemalePlayer;
        let players;
        let maxIterations = 100000; // Set a reasonable maximum number of iterations
        let iterations = 0;

        while (iterations < maxIterations) {
            if (this.femalePlayers.length > 0) {
                randomFemalePlayer = this.femalePlayers[Math.floor(Math.random() * this.femalePlayers.length)];
                players = this.getPlayersInSameTeam(randomFemalePlayer, this.retrievedListOfTeams);

                if (!players.some(player => bracketTeamPlayers.some(bp => this.arePlayersEqual(player, bp)))) {
                    // Found a valid player
                    this.randomFemalePlayer = randomFemalePlayer;
                    bracketTeamPlayers.push(this.randomFemalePlayer);
                    this.femalePlayers = this.femalePlayers.filter(x => x !== this.randomFemalePlayer);
                    this.totalPlayers = this.totalPlayers.filter(x => x !== this.randomFemalePlayer);
                    return true; // Exit the function
                }
            }
            else {
                return true;
            }
            iterations++;
        }
        return false;
    }


    updateUniqueScrambleNumbers() {
        this.uniqueScrambleNumbers = Array.from(new Set(this.listOfScrambleNumbers));
    }

    topPlayerScramble(bracketTeamPlayers) {
        // Select a random top player
        this.randomTopPlayer = this.totalTopPlayers[Math.floor(Math.random() * this.totalTopPlayers.length)];

        // Check if the randomTopPlayer exists in the malePlayers or femalePlayers list
        const isMaleValid = this.malePlayers.includes(this.randomTopPlayer);
        const isFemaleValid = this.femalePlayers.includes(this.randomTopPlayer);

        // Only push the player if they are valid
        if (!isMaleValid && !isFemaleValid) {
            console.warn("Invalid Top Player! Player does not exist in malePlayers or femalePlayers.");
            return; // Exit early without adding the player
        }

        // Push the player to the bracket team
        bracketTeamPlayers.push(this.randomTopPlayer);

        // Remove the player from totalTopPlayers
        this.totalTopPlayers = this.totalTopPlayers.filter(x => x !== this.randomTopPlayer);

        // Remove the player from malePlayers or femalePlayers and update counts
        if (this.randomTopPlayer.isMale) {
            this.malePlayers = this.malePlayers.filter(x => x !== this.randomTopPlayer);
            this.malePlayerCount = this.malePlayers.length;
        } else {
            this.femalePlayers = this.femalePlayers.filter(x => x !== this.randomTopPlayer);
            this.femalePlayerCount = this.femalePlayers.length;
        }

        // Remove the player from totalPlayers
        this.totalPlayers = this.totalPlayers.filter(x => x !== this.randomTopPlayer);

    }

    lowPlayerScramble(bracketTeamPlayers) {
        // Select a random low player
        this.randomLowPlayer = this.totalLowPlayers[Math.floor(Math.random() * this.totalLowPlayers.length)];

        // Check if the randomLowPlayer exists in the malePlayers or femalePlayers list
        const isMaleValid = this.malePlayers.includes(this.randomLowPlayer);
        const isFemaleValid = this.femalePlayers.includes(this.randomLowPlayer);

        // Only push the player if they are valid
        if (!isMaleValid && !isFemaleValid) {
            console.warn("Invalid Low Player! Player does not exist in malePlayers or femalePlayers.");
            return; // Exit early without adding the player
        }

        // Push the player to the bracket team
        bracketTeamPlayers.push(this.randomLowPlayer);

        // Remove the player from totalLowPlayers
        this.totalLowPlayers = this.totalLowPlayers.filter(x => x !== this.randomLowPlayer);

        // Remove the player from malePlayers or femalePlayers and update counts
        if (this.randomLowPlayer.isMale) {
            this.malePlayers = this.malePlayers.filter(x => x !== this.randomLowPlayer);
            this.malePlayerCount = this.malePlayers.length;
        } else {
            this.femalePlayers = this.femalePlayers.filter(x => x !== this.randomLowPlayer);
            this.femalePlayerCount = this.femalePlayers.length;
        }

        // Remove the player from totalPlayers
        this.totalPlayers = this.totalPlayers.filter(x => x !== this.randomLowPlayer);
    }



    randomScramble(bracketTeamPlayers) {
        this.randomPlayer = this.totalRandomPlayers[Math.floor(Math.random() * this.totalRandomPlayers.length)];
        bracketTeamPlayers.push(this.randomPlayer);
        this.totalRandomPlayers = this.totalRandomPlayers.filter(x => x !== this.randomPlayer);
        this.totalPlayers = this.totalPlayers.filter(x => x !== this.randomPlayer);
    }

    reset() {
        if (this.locked) {
            this.showSnackBar('Can not reset while results are locked. Please uncheck lock results and scramble again.');
        }
        else {
            this.generationResult=null;this.generationAttempt=null;this.generatedInput=null;this.generationFeedback='';
            this.listOfTeams = [];
            this.clearTopPLayers();
            this.clearLowPlayers();
            this.clearByePlayers();
        }
    }

    resetTopPlayers() {
        this.clearTopPLayers();
    }

    resetByePlayers() {
        this.clearByePlayers();
    }

    resetLowPlayers() {
        this.clearLowPlayers();
    }



    updateNumberOfPlayersNeeded(): void {
        const maxPlayers = Math.max(this.displayTopPlayers.length, this.displayLowPlayers.length);

        this.numberOfPlayersNeededTwo = maxPlayers * 2;
        this.numberOfPlayersNeededThree = maxPlayers * 3;
        this.numberOfPlayersNeededFour = maxPlayers * 4;
    }


    addPlayerToTopPlayerList(player: Player) {

        if (player.isLowPlayer) {
            // Deselect Low Player if already selected
            this.removePlayerFromLowPlayerList(player);
        }
        // Check if the player already exists in the totalTopPlayers array
        const playerExists = this.totalTopPlayers.some(existingPlayer => existingPlayer.id === player.id);

        if (!playerExists) {
            // If the player doesn't exist, add them to the totalTopPlayers array
            if (this.totalTopPlayers.length === 0 && this.totalTopPlayersTemp.length !== 0) {
                this.totalTopPlayers = this.totalTopPlayersTemp.filter(player => player.isTopPlayer);
            }

            this.totalTopPlayers.push(player);
            player.isTopPlayer = true;

            // Update other variables as needed.
            this.displayTopPlayers = this.totalTopPlayers;
            this.updateNumberOfPlayersNeeded(); // Update counts
        }
        else {
            player.isTopPlayer = true;
        }
    }


    removePlayerFromTopPlayerList(player: Player) {
        // Find all indices of the player in the totalTopPlayers array
        const playerIndices = this.totalTopPlayers.reduce((indices, current, index) => {
            if (current.id === player.id) {
                indices.push(index);
            }
            return indices;
        }, []);

        if (playerIndices.length > 0) {
            // Remove all occurrences of the player from the totalTopPlayers array
            for (const index of playerIndices.reverse()) {
                this.totalTopPlayers.splice(index, 1);
            }

            // Update the isTopPlayer status for all occurrences of the player
            player.isTopPlayer = false;

            this.displayTopPlayers = this.totalTopPlayers;
            this.updateNumberOfPlayersNeeded(); // Update counts

        } else {
            player.isTopPlayer = false;
        }
        this.totalTopPlayers = this.totalTopPlayers.filter(player => player.isTopPlayer);
    }

    addPlayerToLowPlayerList(player: Player) {
        if (player.isTopPlayer) {
            this.removePlayerFromTopPlayerList(player);
        }
        // Check if the player already exists in the totalLowPlayers array
        const playerExists = this.totalLowPlayers.some(existingPlayer => existingPlayer.id === player.id);

        if (!playerExists) {
            // If the player doesn't exist, add them to the totalLowPlayers array
            if (this.totalLowPlayers.length === 0 && this.totalLowPlayersTemp.length !== 0) {
                this.totalLowPlayers = this.totalLowPlayersTemp.filter(player => player.isLowPlayer);
            }

            this.totalLowPlayers.push(player);
            player.isLowPlayer = true;

            // Update other variables as needed.
            this.displayLowPlayers = this.totalLowPlayers;
            this.updateNumberOfPlayersNeeded(); // Update counts
        }
        else {
            player.isLowPlayer = true;
        }
    }

    updateIsSubScore(kingQueenTeamId:number,playerId:number,isSub:boolean):void {
        const key=kingQueenTeamId+':'+playerId;if(this.scoreSubPending[key]||this.scoreSaveBusy)return;
        const team=(this.scoringScramble?this.scoreTeams:this.listOfTeams).find(value=>value.kingQueenTeamId===kingQueenTeamId);const player=team&&team.players.find(value=>value.id===playerId);if(!player)return;
        const previous=player.isSubScore;player.isSubScore=isSub;this.scoreSubPending[key]=true;const version=this.scoreVersion;
        this.playerService.updateKingQueenPlayerSubStatus(kingQueenTeamId,playerId,isSub).subscribe(()=>{this.scoreSubPending[key]=false;if(version===this.scoreVersion)this.scoreEditorFeedback='Substitute setting saved.';},()=>{player.isSubScore=previous;this.scoreSubPending[key]=false;if(version===this.scoreVersion){this.scoreEditorFeedback='Substitute setting could not be saved. The switch was restored.';}});
    }

    removePlayerFromLowPlayerList(player: Player) {
        // Find all indices of the player in the totalLowPlayers array
        const playerIndices = this.totalLowPlayers.reduce((indices, current, index) => {
            if (current.id === player.id) {
                indices.push(index);
            }
            return indices;
        }, []);

        if (playerIndices.length > 0) {
            // Remove all occurrences of the player from the totalLowPlayers array
            for (const index of playerIndices.reverse()) {
                this.totalLowPlayers.splice(index, 1);
            }

            // Update the isLowPlayer status for all occurrences of the player
            player.isLowPlayer = false;

            this.displayLowPlayers = this.totalLowPlayers;
            this.updateNumberOfPlayersNeeded(); // Update counts

        } else {
            player.isLowPlayer = false;
        }
        this.totalLowPlayers = this.totalLowPlayers.filter(player => player.isLowPlayer);
    }



    updateRoundScore(teamId: number, roundId: number, value: any): void {
        if (this.scoreSaveBusy) return;
        // Native number inputs return an empty string when cleared; zero is a real score.
        const numeric = value === null || value === undefined || String(value).trim() === '' ? null : Number(value);
        const scoreValue = numeric !== null && Number.isFinite(numeric) ? numeric : null;
        let score = this.getScore(teamId, roundId);
        if (!score) {
            score = { id: 0, kingQueenTeamId: teamId, roundId: roundId, roundScore: null, roundWon: false };
            this.kingQueenRoundScores.push(score);
        }
        score.roundScore = scoreValue;
        this.recalculateRoundWinners();
    }

    private hasEnteredRoundScore(score: any): boolean {
        return !!score && score.roundScore !== null && score.roundScore !== undefined &&
            String(score.roundScore).trim() !== '' && Number.isFinite(Number(score.roundScore));
    }

    private recalculateRoundWinners(): void {
        // Reuse the editor's existing saved-order pairs and stable team IDs.
        // A tie, missing score or unmatched team awards neither team a win.
        this.kingQueenRoundScores.forEach(score => score.roundWon = false);
        this.mobileScorePairs.forEach(pair => {
            if (pair.length !== 2) return;
            const first = this.kingQueenRoundScores.filter(score => score.kingQueenTeamId === pair[0].kingQueenTeamId);
            first.forEach(score => {
                const opponent = this.getScore(pair[1].kingQueenTeamId, score.roundId);
                if (!this.hasEnteredRoundScore(score) || !this.hasEnteredRoundScore(opponent)) return;
                score.roundWon = Number(score.roundScore) > Number(opponent.roundScore);
                opponent.roundWon = Number(opponent.roundScore) > Number(score.roundScore);
            });
        });
    }

    async retrieveScramble(scramble: KingQueenTeam, automatic = false):Promise<boolean> {
        if (!scramble || this.generationBusy || this.teamSaveBusy ||
            (!automatic && !await this.confirmWorkspaceChanges(true, true))) return false;
        if(this.scoreReader)this.scoreReader.unsubscribe();const version=++this.scoreVersion;
        this.scoreEditorLoading=true;this.scoreEditorFeedback='';this.teamSaveFeedback='';
        this.scoreReader=this.playerService.getKingQueenTeamsByScrambleNumber(this.selectedLeague,scramble.scrambleNumber).subscribe(response=>{
            if(version!==this.scoreVersion||this.scoreDestroyed)return;
            if (automatic && !this.manageScoresActive) { this.scoreEditorLoading = false; return; }
            if(!response||!Array.isArray(response.kingQueenTeams)){this.scoreEditorLoading=false;this.scoreEditorFeedback='Could not read the saved teams. Existing entries were retained.';return;}
            const matchups=response.kingQueenTeams;

            const savedRounds:number[]=[];matchups.forEach(entry=>(entry.kingQueenTeam.kingQueenRoundScores||[]).forEach(row=>{if(row.roundId>0)savedRounds.push(row.roundId);}));
            this.onScoreRoundsChange(savedRounds.length ? Math.max(...savedRounds) : 5);
            // Keep the server's saved order: the existing desktop pairs adjacent positions.
            this.scoreTeams=matchups.map((entry,index)=>({players:(entry.players||[]).map(player=>{const link=(entry.kingQueenTeam.kingQueenPlayers||[]).find(value=>value.playerId===player.id);return {...player,isSubScore:link?link.isSubScore:false};}),maleCount:(entry.players||[]).filter(player=>player.isMale).length,femaleCount:(entry.players||[]).filter(player=>!player.isMale).length,kingQueenRoundScores:entry.kingQueenTeam.kingQueenRoundScores||[],kingQueenTeamId:entry.kingQueenTeam.id,scrambleNumber:null,sortingId:index+1}));
            this.scoreByePlayers = response.byePlayers || [];
            const preserveResults = automatic && this.listOfTeams.length > 0;
            if (!preserveResults) {
                this.selectedRounds = this.scoreRoundCount;
                this.initializeRounds();
                this.generationResult=null;this.generationAttempt=null;this.generatedInput=null;this.generationFeedback='';
                this.listOfTeams=this.scoreTeams;
                this.retrievedListOfTeams=this.scoreTeams.map(team=>({...team}));
                this.listOfRetrievedScrambleNumbers=[scramble.scrambleNumber];this.byePlayers=response.byePlayers||[];
                this.savedPrintSignature=null;this.scrambleSelected=true;this.retrievedPlayersBefore=true;this.allowScrambleWithNoDuplicates=true;
                this.rememberSavedTeams();
            }
            this.showSaveRoundScores=true;
            if (automatic) this.scoreReopenLatest = false;
            this.scoringScramble=scramble;this.mobileScoreMatchIndex=0;this.scoreRefreshRequired=false;this.initializeScores();this.scoreSnapshot=this.scoreSignature();this.scoreEditorLoading=false;
            this.cdr.detectChanges();
            if (!automatic) this.revealScrambleResults();
        },()=>{if(version===this.scoreVersion){this.scoreEditorLoading=false;this.scoreEditorFeedback='Could not retrieve the selected scramble. Existing entries were retained.';if(this.scoreScramblePicker)this.scoreScramblePicker.writeValue(this.scoringScramble);}});
        return true;
    }

    saveKingQueenRoundScores():void {
        if(this.scoreSaveBusy||this.scoreSubBusy||this.scoreRefreshRequired||this.scoreEditorLoading||!this.kingQueenRoundScores.length)return;
        if(this.kingQueenRoundScores.some(row=>row.roundScore===null||String(row.roundScore).trim()===''||!Number.isInteger(Number(row.roundScore)))){this.scoreEditorFeedback='Enter a whole-number score for every edited round before saving. A saved zero is allowed.';return;}
        this.recalculateRoundWinners();
        this.scoreSaveBusy=true;this.scoreEditorFeedback='Saving round scores...';const version=this.scoreVersion;
        this.scoreSaver=this.playerService.saveKingQueenRoundScores(this.kingQueenRoundScores,this.selectedLeague).subscribe(result=>{
            if(version!==this.scoreVersion||this.scoreDestroyed)return;
            if(result&&result.success===false){this.scoreSaveBusy=false;this.scoreEditorFeedback='Round scores were not saved. Your entries are retained; please retry.';return;}
            if(this.scoringScramble)this.verifySavedScores();else {this.scoreSaveBusy=false;this.showSnackBar('Standings have been saved.');this.initializeStandings();}
        },()=>{if(version===this.scoreVersion){this.scoreSaveBusy=false;this.scoreEditorFeedback='Round scores could not be saved. Your entries are retained; please retry.';this.showSnackBar(this.scoreEditorFeedback,true);}});
    }

    calculateTotalScore(teamId: number): number {
        let total = 0;

        // Iterate through all rounds and sum their scores for the given team
        this.rounds.forEach(round => {
            const score = this.getScore(teamId, round); // Use getScore to fetch the round data
            if (score && score.roundScore) {
                total += parseFloat(score.roundScore) || 0; // Ensure the score is treated as a number
            }
        });

        return total; // Return the computed total score
    }

    calculateTotalWins(teamId: number): number {
        let totalWins = 0;

        // Iterate through all rounds and count wins for the given team
        this.rounds.forEach(round => {
            const score = this.getScore(teamId, round); // Use getScore to fetch the round data
            if (score && score.roundWon) {
                totalWins += 1; // Increment total wins if the round is won
            }
        });

        return totalWins; // Return the computed total wins
    }



    async retrieveMultipleScrambles() {
        if(this.generationBusy)return;
        if(!await this.confirmWorkspaceChanges(true, true))return;this.scoreSnapshot=null;this.scoringScramble=null;this.scoreVersion++;
        this.savedPrintSignature = null;
        this.retrievedPlayersBefore = true;
        this.allowScrambleWithNoDuplicates = true;
        this.showSaveRoundScores = false;

        this.playerService.getMultipleKingQueenTeamsByScrambleNumbers(this.selectedLeague, this.listOfScrambleNumbers).subscribe(
            (response) => {
                this.generationResult=null;this.generationAttempt=null;this.generatedInput=null;this.generationFeedback='';
                this.listOfRetrievedScrambleNumbers = [];
                this.listOfTeams = [];
                this.retrievedListOfTeams = [];

                const matchups = response.kingQueenTeams || [];

                // Map the retrieved matchups into listOfTeams
                matchups.forEach((matchup) => {
                    const team: Team = {
                        players: matchup.players,
                        maleCount: matchup.players.filter(player => player.isMale).length,
                        femaleCount: matchup.players.filter(player => !player.isMale).length,
                        kingQueenTeamId: matchup.kingQueenTeam.id,
                        kingQueenRoundScores: matchup.kingQueenTeam.kingQueenRoundScores,
                        sortingId: null,
                        scrambleNumber: null
                    };
                    this.listOfTeams.push(team);
                    this.retrievedListOfTeams.push(team);
                });

                // Assign stable sortingId values
                this.listOfTeams = this.listOfTeams.map((t, idx) => ({ ...t, sortingId: idx + 1 }));
                this.retrievedListOfTeams = this.retrievedListOfTeams.map((t, idx) => ({ ...t, sortingId: idx + 1 }));

                this.listOfRetrievedScrambleNumbers = [...this.listOfScrambleNumbers];
                this.byePlayers = response.byePlayers || [];
                this.rememberSavedTeams();

                // Ensure view updates
                this.cdr.detectChanges();
                this.revealScrambleResults();
            },
            (error) => {
                console.error('Error retrieving matchups:', error);
            }
        );
    }

    clearTopPLayers() {
        this.totalTopPlayers = new Array();
        this.displayTopPlayers = new Array();
        for (let player of this.malePlayers1) {
            player.isTopPlayer = false;
        }
        for (let player of this.femalePlayers1) {
            player.isTopPlayer = false;
        }
    }

    clearLowPlayers() {
        this.totalLowPlayers = new Array();
        this.displayLowPlayers = new Array();
        for (let player of this.malePlayers1) {
            player.isLowPlayer = false;
        }
        for (let player of this.femalePlayers1) {
            player.isLowPlayer = false;
        }
    }


    clearByePlayers() {
        this.byePlayers = [];
        for (let player of this.malePlayers1) {
            player.isByePlayer = false;
        }
        for (let player of this.femalePlayers1) {
            player.isByePlayer = false;
        }
    }


    selectTeamConfigurationMode(mode: 'size' | 'count'): void {
        if (this.teamConfigurationMode === mode) return;
        this.teamConfigurationMode = mode;
        if (mode === 'size') this.updateNumberOfTeams(this.rememberedTeamSize);
        else this.updateTeamSize(this.rememberedTeamCount);
    }

    updateNumberOfTeams(selectedTeamSize: number): void {
        this.rememberedTeamSize = selectedTeamSize;
        this.teamSize = selectedTeamSize;
        this.maxTeamSize = selectedTeamSize;
        this.numberOfTeams = null;
        this.setTeamCount();
    }


    getListItemWidth(scrambleCount: number): number {
        if (!this.isSmallScreen && scrambleCount > 1) {
            return 49;
        } else
            if (!this.isSmallScreen && scrambleCount == 1) {
                return 100;
            } else
                if (this.isSmallScreen) {
                    return 100;
                } else
                    if (!this.isSmallScreen) {
                        return 49;
                    }
    }


    updateTeamSize(selectedNumberOfTeams: number): void {
        this.rememberedTeamCount = selectedNumberOfTeams;
        this.numberOfTeams = selectedNumberOfTeams;
        this.maxTeamSize = null;
        this.teamSize = null;
        this.teamCount = selectedNumberOfTeams;
        this.calculateTeamsNeeded();
    }


    async saveKingQueenTeams() {
        if (!this.canSaveMatchupTeams) return;
        const submittedTeams = this.listOfTeams;
        const submittedLeague = this.selectedLeague;
        const players = submittedTeams.reduce((all, team) => all.concat(team.players), [] as Player[]);
        if (new Set(players.map(player => player.id)).size !== players.length) {
            this.teamSaveFeedback = 'A player cannot be assigned to more than one team.';
            return;
        }
        if(this.generatedInput&&this.generatedLeagueId===this.leagueId&&this.generationResult){
            // Manual team editing intentionally permits different sizes/roles. Preserve that workflow,
            // while guarding roster identity and the explicitly selected historical exclusions.
            const errors=validateAllocation(this.generatedInput.players,this.listOfTeams.map(t=>t.players.length),
                this.listOfTeams.map(t=>t.players),[],new Set(this.generatedInput.prohibitedPairs||[]),this.generationResult.repeatedPairs.length);
            if(errors.length){this.teamSaveFeedback=errors[0]+' Correct the assignments before saving.';this.showSnackBar(this.teamSaveFeedback,true);return;}
        }
        const payload: KingQueenTeamWithPlayers[] = submittedTeams.map(team => ({
            kingQueenTeam: { id: team.kingQueenTeamId, leagueID: 0, dateOfTeam: new Date(),
                scrambleNumber: 0, kingQueenPlayers: [], kingQueenRoundScores: [] },
            players: team.players
        }));
        this.teamSaveBusy = true;
        this.savedPrintSignature = null;
        this.teamSaveFeedback = 'Saving teams...';
        try {
            const result = await this.playerService.saveKingQueenTeams(payload, submittedLeague, this.byePlayers).toPromise();
            if (!result || !result.kingQueenTeams || result.kingQueenTeams.length !== submittedTeams.length) throw new Error('Incomplete team save response');
            if (this.listOfTeams !== submittedTeams || this.selectedLeague !== submittedLeague) return;
            this.scrambleNumber = result.kingQueenTeams[0].kingQueenTeam.scrambleNumber;
            this.teamEditingSnapshot = null;
            this.showTeamSorting = false;
            this.rememberSavedTeams();
            this.queueMatchupLayout();
            // Reuse current objects, including any unsaved round scores, after assignment edits.
            this.retrievedListOfTeams.forEach(team => { const current = submittedTeams.find(value => value.kingQueenTeamId === team.kingQueenTeamId); if(current)team.players=current.players; });
            this.teamSaveFeedback = 'Teams saved successfully.';
            this.showSnackBar(this.teamSaveFeedback);
            if (!this.scrambleSelected) this.scoreReopenLatest = true;
            if (!this.manageScoresActive) this.loadLeagueScrambles();
        } catch (error) {
            this.teamSaveFeedback = 'Teams could not be saved. Your changes are retained; please retry.';
            this.showSnackBar(this.teamSaveFeedback, true);
        } finally { this.teamSaveBusy = false; }
    }

    onSelectionChange(event: any): void {
        this.selectedMatchupsPerPage = event.value;
    }

    printMatchups(): void {
        if (!this.canPrintMatchups) { this.showSnackBar('Save or cancel team changes before printing matchups.'); return; }
        let printContent = '';

        if (this.selectedMatchupsPerPage == '2') {
            const printSection2 = document.getElementById('printSection2');
            if (printSection2) {
                printContent = printSection2.innerHTML;
            }
        } else if (this.selectedMatchupsPerPage == '4') {
            const printSection4 = document.getElementById('printSection4');
            if (printSection4) {
                printContent = printSection4.innerHTML;
            }
        } else if (this.selectedMatchupsPerPage == '6') {
            const printSection6 = document.getElementById('printSection6');
            if (printSection6) {
                printContent = printSection6.innerHTML;
            }
        }

        // Check if content is empty and log a warning if necessary
        if (!printContent) {
            console.warn('Print Content is empty. Verify that the printSection elements exist and have content.');
        }

        if (printContent) {
            const printWindow = window.open('', '_blank', 'width=800,height=600');
            if (printWindow) {
                printWindow.document.open();
                printWindow.document.write(`
                <html>
                    <head>
                        <title>Print Matchups</title>
                        <style>
                            @media print {
                                @page { size: portrait; margin: 1cm; }
                                body {
                                    font-family: Arial, sans-serif;
                                    padding: 20px;
                                }
                                table {
                                    width: 100%;
                                    border-collapse: collapse;
                                }
                                th, td {
                                    border: 1px solid #000;
                                    padding: 5px;
                                    text-align: center;
                                }
                            }
                        </style>
                    </head>
                    <body>${printContent}</body>
                </html>
            `);
                printWindow.document.close();
                printWindow.onload = () => {
                    printWindow.print();
                    printWindow.close();
                };
            }
        }
    }




    //retrieveMatchups() {
    //    this.playerService.getKingQueenTeamsByScrambleNumber(this.selectedLeague, this.scrambleNumber).subscribe(
    //        (response) => {
    //            // Initialize your list of teams
    //            this.listOfTeams = [];
    //            let matchups = response.kingQueenTeams;
    //            if (matchups.length > 0 && matchups[0].kingQueenTeam.kingQueenRoundScores) {
    //                this.selectedRounds = matchups[0].kingQueenTeam.kingQueenRoundScores.length;
    //            } 
    //            // Map the retrieved matchups into listOfTeams
    //            matchups.forEach((matchup) => {
    //                const team: Team = {
    //                    players: matchup.players,
    //                    maleCount: matchup.players.filter(player => player.isMale).length,
    //                    femaleCount: matchup.players.filter(player => !player.isMale).length,
    //                    kingQueenTeamId: matchup.kingQueenTeam.id,
    //                    kingQueenRoundScores: matchup.kingQueenTeam.kingQueenRoundScores
    //                };

    //                this.listOfTeams.push(team);
    //                this.retrievedListOfTeams.push(team);

    //            });
    //            this.updateRounds();
    //            this.byePlayers = response.byePlayers;
    //        },
    //        (error) => {
    //            // Handle any errors
    //            console.error('Error retrieving matchups:', error);
    //        }
    //    );
    //}






    // Check screen size and update isSmallScreen
    checkScreenSize() {
        this.isSmallScreen = window.innerWidth <= 1200; // Preserve other Scrambler layouts.
        this.queueMatchupLayout();
    }

    selectPlayers(playerCount: number, isMale: boolean, nonDuplicates: boolean): boolean {
        for (var i = 0; i < playerCount; i++) {
            let bestTeam: Team = null;

            // Step 1: Identify the team with the fewest total players
            const smallestTeamSize = Math.min(...this.listOfTeams.map(team => team.players.length));
            const smallestTeams = this.listOfTeams.filter(team => team.players.length === smallestTeamSize);

            // Step 2: Among the smallest teams, prioritize those with an imbalance
            let maxImbalance = Number.NEGATIVE_INFINITY;
            for (let team of smallestTeams) {
                const maleCount = team.players.filter(player => player.isMale).length;
                const femaleCount = team.players.length - maleCount;

                // Calculate imbalance (negative means more males, positive means more females)
                const imbalance = isMale ? femaleCount - maleCount : maleCount - femaleCount;

                // Select the team with the greatest imbalance
                if (imbalance > maxImbalance) {
                    maxImbalance = imbalance;
                    bestTeam = team;
                } else if (imbalance === maxImbalance && bestTeam !== null) {
                    // If imbalance is equal, prioritize the team with fewer total players
                    if (team.players.length < bestTeam.players.length) {
                        bestTeam = team;
                    }
                }
            }

            // Step 3: If all teams are balanced, add the player to the smallest teams at random
            if (bestTeam == null) {
                const randomIndex = Math.floor(Math.random() * smallestTeams.length);
                bestTeam = smallestTeams[randomIndex];
            }
            // Step 4: Add the player to the selected team
            if (nonDuplicates) {
                if (isMale) {
                    if (!this.maleScramble2(bestTeam.players)) {
                        return false; // If maleScramble2 fails, return false
                    }
                } else {
                    if (!this.femaleScramble2(bestTeam.players)) {
                        return false; // If femaleScramble2 fails, return false
                    }
                }
            } else {
                if (isMale) {
                    if (!this.maleScramble(bestTeam.players)) {
                        return false; // If maleScramble fails, return false
                    }
                } else {
                    if (!this.femaleScramble(bestTeam.players)) {
                        return false; // If femaleScramble fails, return false
                    }
                }
            }
        }

        // Step 5: Rebalance team sizes after all players are added
        //this.rebalanceTeams();

        return true; // Return true if selection was successful
    }

    //This will break my nonduplicate players scramble
    //rebalanceTeams(): void {
    //    const maxTeamSize = Math.max(...this.listOfTeams.map(team => team.players.length));
    //    const minTeamSize = Math.min(...this.listOfTeams.map(team => team.players.length));

    //    // Track already moved players to avoid duplicates
    //    const movedPlayers = new Set<number>(); // Assume player has a unique `id` property

    //    // While the difference between the largest and smallest teams is greater than 1
    //    while (maxTeamSize - minTeamSize > 1) {
    //        // Find the largest and smallest teams
    //        const largestTeam = this.listOfTeams.find(team => team.players.length === maxTeamSize);
    //        const smallestTeam = this.listOfTeams.find(team => team.players.length === minTeamSize);

    //        if (largestTeam && smallestTeam) {
    //            // Find a player to move who hasn't been moved before
    //            const playerToMove = largestTeam.players.find(player => !movedPlayers.has(player.id));

    //            // Add the player to the smallest team if it's not a duplicate
    //            if (playerToMove) {
    //                const isDuplicate = smallestTeam.players.some(player => player.id === playerToMove.id);

    //                if (!isDuplicate) {
    //                    smallestTeam.players.push(playerToMove);
    //                    movedPlayers.add(playerToMove.id); // Mark the player as moved
    //                    largestTeam.players = largestTeam.players.filter(player => player.id !== playerToMove.id);
    //                }
    //            }
    //        }

    //        // Recalculate the max and min team sizes
    //        const updatedMaxTeamSize = Math.max(...this.listOfTeams.map(team => team.players.length));
    //        const updatedMinTeamSize = Math.min(...this.listOfTeams.map(team => team.players.length));

    //        if (updatedMaxTeamSize === maxTeamSize && updatedMinTeamSize === minTeamSize) {
    //            break; // Break out of the loop if no changes were made
    //        }
    //    }
    //}


    reorderMatchups(): void {
        // Group teams by gender composition
        const groupedTeams = this.listOfTeams.map(team => {
            const maleCount = team.players.filter(p => p.isMale).length;
            const femaleCount = team.players.length - maleCount;
            return { team, maleCount, femaleCount };
        });

        // Sort teams by male-to-female ratio
        groupedTeams.sort((a, b) => {
            if (a.maleCount === b.maleCount) {
                return b.femaleCount - a.femaleCount;
            }
            return b.maleCount - a.maleCount;
        });

        // Reassign matchups to pair similar teams
        const reorderedTeams: Team[] = [];
        for (let i = 0; i < groupedTeams.length; i += 2) {
            const team1 = i < groupedTeams.length ? groupedTeams[i].team : null;
            const team2 = i + 1 < groupedTeams.length ? groupedTeams[i + 1].team : null;

            // Reorder players within each team (men at the top, women at the bottom)
            if (team1) {
                team1.players = team1.players.sort((a, b) => Number(b.isMale) - Number(a.isMale));
            }
            if (team2) {
                team2.players = team2.players.sort((a, b) => Number(b.isMale) - Number(a.isMale));
            }

            if (team1 && team2) {
                reorderedTeams.push(team1, team2);
            } else if (team1) {
                reorderedTeams.push(team1);
            }
        }

        this.listOfTeams = reorderedTeams;
        this.listOfTeams = this.listOfTeams.map((team, index) => ({
            ...team,
            sortingId: index + 1, // Sorting ID based on order
        }));
    }




    fillTopPlayers() {
        if (this.totalTopPlayers != null) {
            for (var i = 0; i < this.topPlayerCount; i++) {

                let bestTeam: Team = null;
                for (let i = 0; i < this.listOfTeams.length - 1; i++) {
                    if (this.listOfTeams[i].players.length > this.listOfTeams[i + 1].players.length) {
                        bestTeam = this.listOfTeams[i + 1];
                    }
                    else if (this.listOfTeams[i].players.length < this.listOfTeams[i + 1].players.length) {
                        bestTeam = this.listOfTeams[i];
                    }
                }
                if (bestTeam == null) {
                    bestTeam = this.listOfTeams[0];
                }
                this.topPlayerScramble(bestTeam.players);

            }
        }
    }

    fillLowPlayers() {
        if (this.totalLowPlayers != null) {
            for (var i = 0; i < this.lowPlayerCount; i++) {
                let bestTeam: Team = null;

                // Step 1: Create a list of candidate teams
                const candidateTeams = this.listOfTeams.filter(team => {
                    const lowPlayerCount = team.players.filter(player => player.isLowPlayer).length;
                    // Allow adding to any team, but prioritize teams with fewer low players
                    return lowPlayerCount <= Math.min(...this.listOfTeams.map(t => t.players.filter(p => p.isLowPlayer).length));
                });

                // Step 2: Randomize selection from candidate teams to avoid predictable assignments
                if (candidateTeams.length > 0) {
                    bestTeam = candidateTeams[Math.floor(Math.random() * candidateTeams.length)];
                }

                // Step 3: Fallback to the first team if no candidates are found
                if (bestTeam == null) {
                    bestTeam = this.listOfTeams[0];
                }

                // Step 4: Add the low player to the selected team
                this.lowPlayerScramble(bestTeam.players);
            }
        }
    }



    async selectPlayersWithRetries(
        nonDuplicates: boolean
    ): Promise<boolean> {
        this.totalTopPlayersTemp = [...this.totalTopPlayers];
        this.totalLowPlayersTemp = [...this.totalLowPlayers];
        this.totalPlayersTemp = [...this.totalPlayers];
        const maxRetries = 101; // Set a maximum number of retries
        for (let retry = 0; retry < maxRetries; retry++) {
            await this.fillTopPlayers();
            await this.fillLowPlayers();
            let maleSuccess = this.selectPlayers(this.malePlayerCount, true, nonDuplicates);
            let femaleSuccess = this.selectPlayers(this.femalePlayerCount, false, nonDuplicates);

            if (maleSuccess && femaleSuccess) {
                this.totalTopPlayers = [...this.totalTopPlayersTemp];
                this.totalLowPlayers = [...this.totalLowPlayersTemp];
                this.totalPlayers = [...this.totalPlayersTemp];
                this.reorderMatchups();
                // Player selection was successful, break out of the loop
                return true;
            }
            this.listOfTeams = [];
            this.malePlayers = [];
            this.femalePlayers = [];
            this.totalTopPlayers = [...this.totalTopPlayersTemp];
            this.totalLowPlayers = [...this.totalLowPlayersTemp];
            this.totalPlayers = [...this.totalPlayersTemp];
            if (retry != 100) {
                this.fillPlayers();
                if (this.listOfTeams.length === 0) {
                    this.fillTeam()
                }
            }

        }
        this.malePlayers = [];
        this.femalePlayers = [];
        this.retrievedListOfTeams = [];
        this.totalTopPlayers = [...this.totalTopPlayersTemp];
        this.totalLowPlayers = [...this.totalLowPlayersTemp];
        return false; // All retries failed
    }

    addPlayerToByeList(player: Player) {
        player.isByePlayer = true;
        this.byePlayers.push(player);
        this.calculateTeamsNeeded();
    }

    removePlayerFromByeList(player: Player) {
        player.isByePlayer = false;
        this.byePlayers = this.byePlayers.filter(p => p !== player);
        this.calculateTeamsNeeded();
    }


    fillPlayers() {
        // Separate bye players
        this.byePlayers = this.selectedList.filter(player => player.isByePlayer);

        // Separate remaining players based on the randomization flag
        if (this.completeRandom) {
            this.totalRandomPlayers = this.selectedList.filter(player => !player.isByePlayer);
        } else {
            this.malePlayers = this.selectedList.filter(player => !player.isByePlayer && player.isMale);
            this.femalePlayers = this.selectedList.filter(player => !player.isByePlayer && !player.isMale);
        }
    }

    fillTeam() {
        if (this.numberOfTeams) {
            this.teamCount = this.numberOfTeams;
        }
        else {
            this.setTeamCount();
        }
        for (let i = 0; i < this.teamCount; i++) {
            let team = {
                players: [],
                femaleCount: 0,
                maleCount: 0,
                kingQueenTeamId: 0,
                kingQueenRoundScores: [],
                scrambleNumber: null,
                sortingId: null
            };
            this.listOfTeams.push(team);
        }

    }

    setTeamCount() {
        let listLength = (this.selectedList.length - this.byePlayers.length);
        if (this.teamSize == 5) {
            if ((listLength / 10) % 1 == 0) {
                this.teamCount = (Math.floor(listLength / 10) * 2);
            }
            else {

                this.teamCount = (Math.floor(listLength / 10) * 2) + 2;

            }
        }
        else if (this.teamSize == 4) {
            if ((listLength / 8) % 1 == 0) {
                this.teamCount = (Math.floor(listLength / 8) * 2);
            }
            else {

                this.teamCount = (Math.floor(listLength / 8) * 2) + 2;

            }
        }
        else if (this.teamSize == 3) {
            if ((listLength / 6) % 1 == 0) {
                this.teamCount = (Math.floor(listLength / 6) * 2);
            }
            else {

                this.teamCount = (Math.floor(listLength / 6) * 2) + 2;

            }
        }
        else if (this.teamSize == 2) {
            if ((listLength / 4) % 1 == 0) {
                this.teamCount = (Math.floor(listLength / 4) * 2);
            }
            else {

                this.teamCount = (Math.floor(listLength / 4) * 2) + 2;

            }
        }
        this.calculateTeamsNeeded();
    }

    get selectedTopPlayers(): Player[] {
        return this.displayTopPlayers.filter(player => this.isPlayerInSelectedList(player));
    }

    getPlayerClass(player: Player): string {
        const playerClass = this.isPlayerInSelectedList(player)
            ? (player.isMale ? 'extended-background-blue' : 'extended-background-pink')
            : (player.isMale ? 'not-selected-blue' : 'not-selected-pink');

        return playerClass;
    }


    isPlayerInSelectedList(player: Player): boolean {
        const result = this.selectedList.some(selectedPlayer => {
            const match = selectedPlayer.id === player.id;
            return match;
        });

        return result;
    }


    async legacyScramblePlayers(nonDuplicates: boolean = false) {
        if(!await this.confirmWorkspaceChanges(true, !!this.scoringScramble))return;
        if(this.scoringScramble)this.clearScoreEditor();
        this.savedPrintSignature = null;
        this.teamSaveFeedback = '';
        this.teamEditingSnapshot = null;
        this.showTeamSorting = false;
        this.resultsCollapsed = false;
        this.scrambleSelected = false;
        this.showSaveRoundScores = false;
        this.totalTopPlayers = this.displayTopPlayers;
        this.totalLowPlayers = this.displayLowPlayers;
        if (!this.lockedResults) {
            this.locked = false;

        }
        if (this.locked) {
            this.showSnackBar('Results are currently locked. Please uncheck lock results to rescramble.')
        }
        else {

            this.listOfTeams = [];
            this.fillPlayers();
            this.malePlayerCount = this.malePlayers.length;
            this.femalePlayerCount = this.femalePlayers.length;
            this.randomPlayerCount = this.totalRandomPlayers.length;
            this.topPlayerCount = this.totalTopPlayers.length;
            this.lowPlayerCount = this.totalLowPlayers.length;
            if (this.numberOfTeams != null) {
                this.teamCount = this.numberOfTeams;
            }
            else {
                await this.setTeamCount();
            }
            for (var i = 0; i < this.teamCount; i++) {
                let team = {
                    players: [],
                    femaleCount: 0,
                    maleCount: 0,
                    kingQueenTeamId: 0,
                    kingQueenRoundScores: [],
                    scrambleNumber: null,
                    sortingId: null
                }
                this.listOfTeams.push(team)
            }

            if (this.completeRandom) {
                for (var i = 0; i < this.randomPlayerCount; i++) {
                    let bestTeam: Team = null;
                    for (let i = 0; i < this.listOfTeams.length - 1; i++) {
                        if (this.listOfTeams[i].players.length > this.listOfTeams[i + 1].players.length) {
                            bestTeam = this.listOfTeams[i + 1];
                        }
                        else if (this.listOfTeams[i].players.length < this.listOfTeams[i + 1].players.length) {
                            bestTeam = this.listOfTeams[i];
                        }
                    }
                    if (bestTeam == null) {
                        bestTeam = this.listOfTeams[0];
                    }
                    this.randomScramble(bestTeam.players);
                }
            }
            else {

                try {

                    let result = await this.selectPlayersWithRetries(nonDuplicates);

                    // Use the function to select players for both males and females with retries
                    if (result) {
                        if (nonDuplicates) {
                            // Success is shown inline in Scramble Results.
                        }
                        else {
                            // Success is shown inline in Scramble Results.
                        }
                    }
                    else {
                        this.showSnackBar("Not enough players to complete non-duplicate scramble.", true);
                    }
                } catch (e) {

                }

            }
            if (this.lockedResults) {
                this.locked = true;
            }
            else {
                this.locked = false;
            }



            // A scramble is calculated locally for preview, but GenerateScramble
            // persists a database record. Public visitors and Player accounts
            // may preview teams without making an unauthorized database write.
            if (!this.isActionAllowed) {
                this.scrambleNumber = 0;
                if (nonDuplicates) {
                    this.allowScrambleWithNoDuplicates = false;
                }
                this.showSnackBar('Preview generated. Unlock administration to save a scramble.');
                this.revealScrambleResults();
                this.cdr.detectChanges();
                return;
            }

            const requestBody: KingQueenTeamsResponse = {
                kingQueenTeams: this.listOfTeams.map(team => {
                    return {
                        kingQueenTeam: {
                            id: 0,
                            leagueID: 0,
                            dateOfTeam: new Date(),            // or new Date().toISOString()
                            kingQueenPlayers: [],
                            scrambleNumber: 0,                 // Will be assigned by server
                            scrambleWithScoresToBeSaved: false,
                            kingQueenRoundScores: []
                        },
                        players: team.players // The array of players for this "team"
                    };
                }),
                byePlayers: [] // If you have no ByePlayers right now, just keep it empty
            };

            // 2) Call generateScramble
            try {
                const createdTeams: KingQueenTeam[] = await this.playerService
                    .generateScramble(this.selectedLeague, requestBody)
                    .toPromise();

                if (createdTeams && createdTeams.length > 0) {
                    // The server returns an array of newly created KingQueenTeams
                    this.scrambleNumber = createdTeams[0].scrambleNumber;
                    if(createdTeams.length===this.listOfTeams.length)createdTeams.forEach((team,index)=>this.listOfTeams[index].kingQueenTeamId=team.id);
                    this.announceGeneratedScramble();
                    this.revealScrambleResults();
                } else {
                    console.error('Error: No teams returned from server');
                }
            } catch (error) {
                console.error('Error generating scramble:', error);
            } finally {

                if (nonDuplicates) {
                    this.allowScrambleWithNoDuplicates = false;
                }
                this.cdr.detectChanges();
            }
        }
    }
}

export interface LeagueDivisionDto {
    id: number;
    code: string;
}
