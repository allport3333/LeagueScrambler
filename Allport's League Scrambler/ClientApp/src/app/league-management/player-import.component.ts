import { protectPendingWork } from '../pwa/pending-work.service';
import { AfterViewChecked, Component, ElementRef, Inject, OnDestroy, OnInit, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { PlayerService } from '../services/player.service';
import { LeagueService } from '../services/league.service';
import { ImportGrid, ImportMapping, ImportRow, analyseImport, detectMapping, normalName, refreshImportRows, importRowMatchesFilter, importRowNeedsAttention } from './player-import';
import { ImportPlayerCreateComponent } from './player-management-dialogs.component';

@Component({
    selector: 'app-player-import', templateUrl: './player-import.component.html', styleUrls: ['./player-import.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class PlayerImportComponent implements OnInit, OnDestroy, AfterViewChecked {
    context:any=null; loading=true; parsing=false; analysing=false; importing=false; error=''; notice=''; file:File; filename='';
    grid:ImportGrid; mapping:ImportMapping; sheets:string[]=[]; sheet=''; rows:ImportRow[]=[]; visibleRows:ImportRow[]=[]; ready:ImportRow[]=[];
    defaultDivision=0; search=''; filter='all'; nameFormat='full'; editing:ImportRow=null; candidateSearch=''; candidatePlayers:any[]=[];
    summary:any={}; columns:number[]=[]; mappingOpen=false;
    readonly filters=['all','exact','ready','review','already','not-found','duplicate','invalid','added'];
    readonly filterLabels={all:'Parsed Rows',exact:'Exact Matches',ready:'Ready to Add',review:'Requiring Review',already:'Already in League','not-found':'Not Found',duplicate:'Duplicates',invalid:'Invalid',added:'Added'};
    @ViewChild('importBody', { static: true }) importBody:ElementRef;
    @ViewChild('matchSearch') matchSearch:ElementRef;
    @ViewChild('reviewNotice') reviewNotice:ElementRef;
    lastReviewedLine=0; private navigation:string=null; private previewScroll=0; private createRef:MatDialogRef<ImportPlayerCreateComponent>;
    readonly labels={ready:'Ready',review:'Needs Review',already:'Already in League','not-found':'Not Found',duplicate:'Duplicate',invalid:'Invalid',added:'Added'};
    private worker:Worker; private reader:FileReader; private timer:any; private generation=0; private request=0; private closed=false;
    private contextSub:Subscription; private loadingSub:Subscription;
    constructor(@Inject(MAT_DIALOG_DATA) public data:any,public dialogRef:MatDialogRef<PlayerImportComponent>,private service:PlayerService,private leagues:LeagueService,private dialogs:MatDialog){protectPendingWork(() => this.parsing || this.analysing || this.importing || this.hasImportDraft);}
    ngAfterViewChecked():void {
        if(!this.navigation||!this.importBody)return;
        const body=this.importBody.nativeElement as HTMLElement;
        if(this.navigation==='match'){
            if(!this.matchSearch)return;body.scrollTop=0;this.matchSearch.nativeElement.focus({preventScroll:true});
        }else{
            const row=body.querySelector('[data-import-row="'+this.lastReviewedLine+'"]') as HTMLElement;
            if(row){body.scrollTop+=row.getBoundingClientRect().top-body.getBoundingClientRect().top-12;const button=row.querySelector('button:not([disabled])') as HTMLElement;if(button)button.focus({preventScroll:true});}
            else{body.scrollTop=this.previewScroll;if(this.reviewNotice)this.reviewNotice.nativeElement.focus({preventScroll:true});}
        }
        this.navigation=null;
    }
    ngOnInit():void {
        this.defaultDivision=this.data.divisionId||0;
        this.contextSub=this.leagues.selectedLeague$.subscribe(c=>{if(c.leagueId!==this.data.leagueId)this.dialogRef.close();});
        this.loadContext(()=>{if(this.data.draft){const d=this.data.draft;this.file=d.file;this.filename=d.filename;this.grid=d.grid;this.mapping={...d.mapping};this.sheets=d.sheets;this.sheet=d.sheet;this.defaultDivision=d.defaultDivision;this.nameFormat=d.nameFormat;this.columns=d.columns;this.analyse(d.rows);}});
    }
    loadContext(after?:()=>void):void {
        this.loading=true;this.error='';
        this.loadingSub=this.service.leagueImportContext(this.data.leagueId).pipe(timeout(20000)).subscribe(c=>{
            this.loading=false;
            if(!c||!Array.isArray(c.players)||!Array.isArray(c.members)||!Array.isArray(c.divisions)){this.error='Could not load league players and divisions.';return;}
            this.context=c;if(this.defaultDivision&&!c.divisions.some(d=>d.id===this.defaultDivision))this.defaultDivision=0;
            if(after)after();else if(this.grid)this.analyse(this.rows);
        },()=>{this.loading=false;this.error='Could not load league players and divisions. Please try again.';});
    }
    choose(event:any):void {const files=event.target.files;if(files&&files[0])this.selectFile(files[0]);event.target.value='';}
    drop(event:DragEvent):void {event.preventDefault();if(!this.importing&&event.dataTransfer.files.length)this.selectFile(event.dataTransfer.files[0]);}
    selectFile(file:File):void {
        if(this.importing)return;
        const ext=(file.name.split('.').pop()||'').toLowerCase();this.error='';
        if(['txt','csv','xlsx','xls'].indexOf(ext)<0){this.error='Choose a TXT, CSV, XLSX or XLS file.';return;}
        if(!file.size||file.size>2*1024*1024){this.error=file.size?'Choose a file no larger than 2 MB.':'The selected file is empty.';return;}
        this.stopParser();this.generation++;this.file=file;this.filename=file.name;this.rows=[];this.visibleRows=[];this.ready=[];this.grid=null;this.editing=null;this.notice='';this.sheet='';this.sheets=[];this.analysing=false;this.parsing=true;
        this.worker=new Worker(new URL('assets/import/roster-worker.js',document.baseURI).href);
        this.worker.onmessage=e=>this.parsed(e.data);this.worker.onerror=()=>this.parseFailed('The file could not be read safely. Try a clean TXT/CSV export or a current browser.');
        const id=++this.request;this.reader=new FileReader();this.reader.onload=()=>{const buffer=this.reader.result as ArrayBuffer;this.deadline();this.worker.postMessage({id,buffer,extension:ext},[buffer]);};this.reader.onerror=()=>this.parseFailed('The selected file could not be read.');this.reader.readAsArrayBuffer(file);
    }
    changeSheet():void {
        if(this.importing||!this.file)return;
        if(!this.worker){const selected=this.sheet;this.selectFile(this.file);this.sheet=selected;return;}
        this.generation++;this.rows=[];this.visibleRows=[];this.ready=[];this.editing=null;this.parsing=true;this.error='';this.deadline();this.worker.postMessage({id:++this.request,sheet:this.sheet});
    }
    private deadline():void {clearTimeout(this.timer);this.timer=setTimeout(()=>this.parseFailed('The parser time limit was reached. No players were imported. Try a smaller roster file.'),12000);}
    private parsed(result:any):void {
        if(result.id!==this.request||this.closed)return;clearTimeout(this.timer);this.parsing=false;
        if(result.error){this.parseFailed(result.error);return;}
        // A resumed draft may request a different sheet than the default first sheet.
        if(this.sheet&&result.sheets.length&&result.sheet!==this.sheet&&result.sheets.indexOf(this.sheet)>=0){this.sheets=result.sheets;this.changeSheet();return;}
        this.sheets=result.sheets;this.sheet=result.sheet||'';this.grid=result;this.mapping=detectMapping(result);this.nameFormat=this.mapping.fullName>=0?'full':'separate';
        this.columns=Array.from({length:Math.max(1,...result.rows.map(row=>row.length))},(_,i)=>i);
        this.mappingOpen=this.mapping.fullName<0&&(this.mapping.firstName<0||this.mapping.lastName<0);this.analyse();
    }
    private parseFailed(message:string):void {this.error=message;this.parsing=false;this.analysing=false;this.generation++;this.rows=[];this.visibleRows=[];this.ready=[];this.stopParser();}
    private stopParser():void {clearTimeout(this.timer);if(this.worker){this.worker.terminate();this.worker=null;}if(this.reader&&this.reader.readyState===1)this.reader.abort();}
    async analyse(previous?:ImportRow[]):Promise<void> {
        if(!this.grid||!this.context||this.importing)return;const version=++this.generation;this.analysing=true;this.error='';this.ready=[];this.editing=null;
        try{
            if(this.nameFormat==='full'){this.mapping.firstName=-1;this.mapping.lastName=-1;}else this.mapping.fullName=-1;
            const rows=await analyseImport(this.grid,{...this.mapping},this.context,this.defaultDivision,()=>version!==this.generation||this.closed);
            if(version!==this.generation||this.closed)return;
            if(previous)rows.forEach(row=>{const old=previous.find(r=>r.line===row.line);if(!old)return;if(old.confirmed&&this.context.players.some(p=>p.id===old.playerId)){row.playerId=old.playerId;row.confirmed=true;row.exact=normalName(row.uploadedName)===normalName(this.playerName(old.playerId));}if(old.divisionOverride){row.divisionId=old.divisionId;row.divisionOverride=true;}row.imported=old.imported;});
            this.rows=rows;this.refresh();
        }catch(error){if(version===this.generation){this.rows=[];this.visibleRows=[];this.error=error.message;this.mappingOpen=true;}}
        finally{if(version===this.generation)this.analysing=false;}
    }
    refresh():void {
        refreshImportRows(this.rows,this.context);this.summary={};this.filters.forEach(f=>this.summary[f]=this.rows.filter(r=>importRowMatchesFilter(r,f)).length);this.ready=this.rows.filter(r=>r.status==='ready');this.filterRows();
    }
    filterRows():void {const term=normalName(this.search);this.visibleRows=this.rows.filter(r=>importRowMatchesFilter(r,this.filter)&&(!term||normalName(r.uploadedName+' '+this.playerName(r.playerId)).indexOf(term)>=0));}
    setFilter(filter:string):void{this.filter=filter;this.filterRows();}
    needsAttention(row:ImportRow):boolean{return importRowNeedsAttention(row);}
    changeDefault():void {this.rows.forEach(r=>{if(!r.sourceDivision&&!r.divisionOverride)r.divisionId=this.defaultDivision;});this.refresh();}
    changeDivision(row:ImportRow):void {row.divisionOverride=true;this.refresh();}
    playerName(id:number):string {const p=this.context&&this.context.players.find(p=>p.id===id);return p?p.firstName+' '+p.lastName:'';}
    identify(player:any):string {return player.firstName+' '+player.lastName+' · '+(player.isMale===true?'Men':player.isMale===false?'Women':'Unspecified gender')+' · ID '+player.id+(this.context.members.some(m=>m.playerId===player.id)?' · Already in league':'');}
    divisionName(id:number):string {const d=this.context.divisions.find(d=>d.id===id);return d?d.name||d.code:'No Division';}
    review(row:ImportRow):void {this.previewScroll=this.importBody.nativeElement.scrollTop;this.editing=row;this.candidateSearch='';this.filterCandidates();this.navigation='match';}
    filterCandidates():void {const term=normalName(this.candidateSearch);this.candidatePlayers=(term?this.context.players.filter(p=>normalName(p.firstName+' '+p.lastName+' '+p.id).indexOf(term)>=0):this.context.players.filter(p=>this.editing.candidates.indexOf(p.id)>=0)).slice(0,20);}
    confirmPlayer(player:any):void {
        const row=this.editing;if(!row)return;row.playerId=player.id;row.confirmed=true;row.exact=normalName(row.uploadedName)===normalName(player.firstName+' '+player.lastName);this.lastReviewedLine=row.line;this.editing=null;this.refresh();
        this.notice='Row '+row.line+' matched to '+player.firstName+' '+player.lastName+'.'+(this.visibleRows.indexOf(row)<0?' It is hidden by the current filters.':'');this.navigation='preview';
    }
    cancelReview():void {if(this.editing)this.lastReviewedLine=this.editing.line;this.editing=null;this.navigation='preview';}
    create(row:ImportRow):void {
        if(this.createRef||this.importing)return;this.previewScroll=this.importBody.nativeElement.scrollTop;this.dialogRef.disableClose=true;
        this.createRef=this.dialogs.open(ImportPlayerCreateComponent,{width:'480px',maxWidth:'calc(100vw - 24px)',maxHeight:'94vh',restoreFocus:true,data:{row,players:this.context.players,leagueId:this.data.leagueId,leagueName:this.data.leagueName}});
        this.createRef.afterClosed().subscribe(result=>{this.createRef=null;this.dialogRef.disableClose=this.importing;if(this.closed)return;
            if(result&&result.player){if(!this.context.players.some(p=>p.id===result.player.id))this.context.players.push(result.player);this.editing=row;this.confirmPlayer(result.player);this.notice+=' The profile is available; league membership still requires import confirmation.';}
            else{this.lastReviewedLine=row.line;this.navigation='preview';}
        });
    }
    columnLabel(index:number):string {const header=this.mapping&&this.mapping.headerRow>0&&this.grid.rows[this.mapping.headerRow-1];return String.fromCharCode(65+index)+(header&&header[index]?' — '+header[index].slice(0,60):'');}
    trackRow(index:number,row:ImportRow):number{return row.line;}
    importPlayers():void {
        if(this.importing||this.loading||this.parsing||this.analysing||!this.ready.length)return;
        const selected=this.ready.slice(),entries=selected.map(row=>({playerId:row.playerId,divisionId:row.divisionId}));
        this.importing=true;this.error='';this.notice='';this.dialogRef.disableClose=true;
        this.service.importLeaguePlayers(this.data.leagueId,entries).subscribe(response=>{
            if(!response||response.leagueId!==this.data.leagueId||response.atomic!==true||!Array.isArray(response.results)||response.results.length!==entries.length||new Set(response.results.map(r=>r.player&&r.player.id)).size!==entries.length||response.results.some(r=>!r.player||!entries.some(e=>e.playerId===r.player.id))){this.reconcile(selected);return;}
            this.data.onImported(response.results);if(this.closed)return;
            response.results.forEach(r=>{this.context.members=this.context.members.filter(m=>m.playerId!==r.player.id).concat({playerId:r.player.id,divisionId:r.leagueDivisionId});if(!r.alreadyMember)selected.find(row=>row.playerId===r.player.id).imported=true;});
            const added=response.results.filter(r=>!r.alreadyMember).length;
            this.importing=false;this.dialogRef.disableClose=false;this.refresh();this.notice=added+' players added. '+(response.results.length-added)+' already enrolled players were left unchanged.';
        },()=>this.reconcile(selected));
    }
    private reconcile(selected:ImportRow[]):void {
        this.service.leagueImportContext(this.data.leagueId).pipe(timeout(20000)).subscribe(c=>{
            if(this.closed)return;
            if(!c||!Array.isArray(c.players)||!Array.isArray(c.members)||!Array.isArray(c.divisions)){this.importing=false;this.dialogRef.disableClose=false;this.ready=[];this.error='Could not confirm the import or reload memberships. Reload league data before retrying.';return;}
            this.context=c;
            const results=selected.filter(r=>c.members.some(m=>m.playerId===r.playerId)).map(r=>{const m=c.members.find(m=>m.playerId===r.playerId);return {leagueId:this.data.leagueId,player:c.players.find(p=>p.id===r.playerId),leagueDivisionId:m.divisionId,leagueDivisionName:(c.divisions.find(d=>d.id===m.divisionId)||{}).name,alreadyMember:true};});
            this.data.onImported(results);this.importing=false;this.dialogRef.disableClose=false;this.refresh();this.error='The import response could not be confirmed. '+results.length+' selected players are currently in this league. Review remaining rows before explicitly retrying.';
        },()=>{if(!this.closed){this.importing=false;this.dialogRef.disableClose=false;this.ready=[];this.error='Could not confirm the import or reload memberships. Reload league data before retrying.';}});
    }
    private get hasImportDraft(): boolean { return !!this.file && (this.rows.length === 0 || this.rows.some(row => !row.imported && row.status !== 'already')); }
    ngOnDestroy():void {
        if(this.createRef)this.createRef.close();
        if(this.hasImportDraft&&this.grid&&this.rows.length)this.data.onDraft({file:this.file,filename:this.filename,grid:this.grid,mapping:this.mapping,sheets:this.sheets,sheet:this.sheet,defaultDivision:this.defaultDivision,nameFormat:this.nameFormat,columns:this.columns,rows:this.rows});
        else this.data.onDraft(null);
        this.closed=true;this.generation++;this.stopParser();if(this.contextSub)this.contextSub.unsubscribe();if(this.loadingSub)this.loadingSub.unsubscribe();
    }
}
