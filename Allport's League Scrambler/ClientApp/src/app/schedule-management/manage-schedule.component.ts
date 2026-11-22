import {Component, Input, OnChanges, OnDestroy, SimpleChanges, AfterViewChecked, ViewChild, ElementRef, ChangeDetectionStrategy} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {timeout} from 'rxjs/operators';
import {ScheduleTeam,ScheduleEntry,DivisionPlan,CrossRule,blankEntry,entrySignature,changed,generateSchedule,validateSchedule,scheduleSummary,detectScheduleMapping,importScheduleGrid,importScheduleText,isoDay,normalize,pair,calendarWeekStart,replacementGameIds} from './schedule-engine';
import {printSeasonSchedule} from '../league-schedule/schedule-print';
import { DateAdapter } from '@angular/material/core';
import {ScheduleDateAdapter} from './schedule-date-adapter';

@Component({
    selector: 'app-manage-schedule', templateUrl: './manage-schedule.component.html', styleUrls: ['./manage-schedule.component.css'], providers: [{ provide: DateAdapter, useClass: ScheduleDateAdapter }],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class ManageScheduleComponent implements OnChanges,OnDestroy,AfterViewChecked {
 @Input()leagueId:number;@Input()leagueName='';@Input()canManage=false;@Input()draftStore:any={};
 context:any;teams:ScheduleTeam[]=[];divisions:any[]=[];entries:ScheduleEntry[]=[];visible:ScheduleEntry[]=[];plans:any[]=[];crossRules:CrossRule[]=[];
 loading=false;busy=false;reading=false;dirty=false;uncertain=false;error='';notice='';workflow='create';mode='append';divisionFilter='';weekFilter=0;statusFilter='all';summary:any={};statistics:any={coverage:[],divisions:[]};
 specialDates='';weeks=10;firstDate=new Date().toISOString().slice(0,10);day=0;games=1;method='balanced';excluded='';allowCross=false;byes:any[]=[];warnings:string[]=[];deletedGames:number[]=[];deletedEvents:number[]=[];
 filename='';grid:any;mapping:any;sheet='';sheets:string[]=[];dateFormat='iso';text='';referenceUrl='';referenceKind='';columns:number[]=[];version=0;
 readonly statuses=['all','valid','review','unresolved','division','duplicate','date','invalid'];readonly labels={all:'Total Records',valid:'Valid',review:'Needs Review',unresolved:'Unresolved Teams',division:'Division Conflicts',duplicate:'Duplicates',date:'Date Conflicts',invalid:'Invalid Rows'};
 readonly weekdays=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];readonly mappingFields=['week','date','team1','team2','division','notes','type','title'];
 private worker:Worker;private timer:any;private request=0;private fileVersion=0;private destroyed=false;private currentLeague:number;
 constructor(private http:HttpClient){}
 @ViewChild('previewStart') previewStart:ElementRef;
 private views:any={};private fileBuffer:ArrayBuffer=null;fileExtension='';private scrollPreview=false;previewRevision='';validationGames=1;replacementScopes:string[]=[];previewCrossRules:CrossRule[]=[];previewAllowCross=false;previewConfiguration='';customWeekday=false;advancedOpen=false;adjustPreview=false;editingExisting=false;previewWeeks:any[]=[];existingConflictCount=0;
 private readonly viewFields=['entries','dirty','uncertain','mode','deletedGames','deletedEvents','crossRules','allowCross','games','filename','workflow','plans','weeks','firstDate','day','method','excluded','byes','warnings','specialDates','divisionFilter','weekFilter','statusFilter','previewRevision','validationGames','replacementScopes','previewCrossRules','previewAllowCross','previewConfiguration','customWeekday','advancedOpen','adjustPreview','editingExisting','notice','error','grid','mapping','sheet','sheets','dateFormat','text','referenceUrl','referenceKind','columns','fileExtension'];
 ngOnChanges(changes:SimpleChanges):void {if(changes.leagueId){this.remember();this.currentLeague=this.leagueId;this.views={};this.load(false);}}
 ngAfterViewChecked():void {if(this.scrollPreview&&this.previewStart){this.scrollPreview=false;const el=this.previewStart.nativeElement;el.scrollIntoView({block:'start',behavior:'smooth'});el.focus({preventScroll:true});}}
 private capture():any {const state:any={};this.viewFields.forEach(key=>state[key]=this[key]);const snapshot=JSON.parse(JSON.stringify(state));snapshot.fileBuffer=this.fileBuffer;snapshot.uncertain=this.uncertain||this.busy;return snapshot;}
 private remember():void {if(this.currentLeague&&this.context){this.views[this.workflow]=this.capture();this.draftStore[this.currentLeague]={workflow:this.workflow,views:this.views};}}
 private defaults(view:string):any {const date=this.context.today||new Date().toISOString().slice(0,10),day=this.weekday(date);return {entries:view==='existing'?this.savedEntries():[],dirty:false,uncertain:false,mode:view==='existing'?'edit':this.context.entries.length?'':'append',deletedGames:[],deletedEvents:[],crossRules:[],allowCross:false,games:1,filename:'',workflow:view,plans:this.divisions.map(d=>({key:d.key,included:d.teams>=2,override:false,weeks:10,firstDate:date,day,games:1})),weeks:10,firstDate:date,day,method:'balanced',excluded:'',byes:[],warnings:[],specialDates:'',divisionFilter:'',weekFilter:0,statusFilter:'all',previewRevision:this.context.revision,validationGames:1,replacementScopes:[],previewCrossRules:[],previewAllowCross:false,previewConfiguration:'',customWeekday:false,advancedOpen:false,adjustPreview:false,editingExisting:false,notice:'',error:'',grid:null,mapping:null,sheet:'',sheets:[],dateFormat:'iso',text:'',referenceUrl:'',referenceKind:'',columns:[],fileBuffer:null,fileExtension:''};}
 private restore(view:string):void {const state=this.views[view];Object.assign(this,this.defaults(view),state||{});this.workflow=view;if(view==='existing'&&!this.dirty)this.entries=this.savedEntries();this.refresh();}
 load(reload=true):void {
  if(reload&&(this.busy||this.reading))return;if(reload)this.remember();else{this.busy=false;this.reading=false;}const retained=reload?{workflow:this.workflow,views:this.views}:this.draftStore[this.leagueId];
  const version=++this.version;this.stopWorker();this.loading=true;this.error='';this.context=null;this.entries=[];this.visible=[];
  if(!this.leagueId){this.loading=false;return;}
  this.http.get<any>('api/ScheduleManagement/'+this.leagueId).pipe(timeout(20000)).subscribe(context=>{
   if(version!==this.version||this.destroyed)return;this.loading=false;if(!context||context.leagueId!==this.leagueId||!Array.isArray(context.entries)||!Array.isArray(context.teams)){this.error='Could not read this league schedule.';return;}
   this.context=context;this.teams=context.teams;const groups=new Map<string,any>();context.divisions.forEach(d=>groups.set('d:'+d.id,{key:'d:'+d.id,name:d.name||d.code,teams:0}));this.teams.forEach(t=>{if(!groups.has(t.divisionKey))groups.set(t.divisionKey,{key:t.divisionKey,name:t.division||'No Division',teams:0});groups.get(t.divisionKey).teams++;});this.divisions=Array.from(groups.values());this.views=retained&&retained.views||{};
   Object.keys(this.views).forEach(key=>{const draft=this.views[key];if(draft.dirty&&key==='existing'&&draft.previewRevision!==context.revision){draft.uncertain=true;draft.error='Saved games changed while these edits were open. Review the saved schedule and discard or resolve the old edits before saving.';}else{draft.previewRevision=context.revision;draft.uncertain=false;}});
   this.restore(retained&&retained.workflow||(context.entries.length?'existing':'create'));if(reload&&!this.uncertain)this.notice=this.dirty?'Saved schedule reloaded. Your unsaved preview is retained; review any conflicts before saving.':'Saved schedule reloaded.';this.remember();
  },()=>{if(version===this.version){this.loading=false;this.error='Could not load schedule management. Check your league permissions and retry.';}});
 }
 private savedEntries():ScheduleEntry[]{return this.context.entries.map(value=>{const e={...value,description:value.description||'',eventType:value.eventType||'',divisionKey:value.divisionKey||''};if(e.kind==='game')e.divisionKey=(this.teams.find(t=>t.id===e.team1Id)||{} as any).divisionKey||'';e.original=entrySignature(e);return e;});}
 setWorkflow(value:string):void {if(this.busy||this.reading)return;this.remember();this.restore(value==='edit'?'existing':value);}
 editSaved():void {if(this.workflow!=='existing')this.setWorkflow('existing');if(this.dirty&&!window.confirm('Discard your unsaved edits and load the saved schedule?'))return;Object.assign(this,this.defaults('existing'));this.editingExisting=true;this.refresh();}
 discardEdits():void {if(this.dirty&&!window.confirm('Discard these unsaved schedule edits?'))return;Object.assign(this,this.defaults('existing'));this.refresh();}
 get populatedPlans():any[]{return this.plans.filter(p=>this.divisions.some(d=>d.key===p.key&&d.teams>0));}
 get emptyDivisions():any[]{return this.divisions.filter(d=>!d.teams);}
 teamCount(key:string):number{return (this.divisions.find(d=>d.key===key)||{}).teams||0;}
 weekday(date:string):number {return isoDay(date)?new Date(date+'T12:00:00').getDay():0;}
 private dateFieldKey:string;private dateFieldValue:Date=null;
 get firstGameDate():Date {
  if(this.firstDate!==this.dateFieldKey){
   const day=isoDay(this.firstDate),parts=day&&day.split('-').map(Number);
   this.dateFieldKey=this.firstDate;this.dateFieldValue=parts?new Date(parts[0],parts[1]-1,parts[2]):null;
  }
  return this.dateFieldValue;
 }
 set firstGameDate(value:Date) {
  const valid=value&&!isNaN(value.getTime());
  this.firstDate=valid?[value.getFullYear(),('0'+(value.getMonth()+1)).slice(-2),('0'+value.getDate()).slice(-2)].join('-'):'';
  this.dateFieldKey=this.firstDate;this.dateFieldValue=valid?value:null;this.dateChanged();
 }
 dateChanged(plan?:any):void {if(plan)plan.day=this.weekday(plan.firstDate);else if(!this.customWeekday)this.day=this.weekday(this.firstDate);}
 private configuration():string{return JSON.stringify({plans:this.plans,weeks:this.weeks,firstDate:this.firstDate,day:this.customWeekday?this.day:this.weekday(this.firstDate),games:this.games,method:this.method,excluded:this.excluded,specialDates:this.specialDates,allowCross:this.allowCross,crossRules:this.crossRules});}
 get configurationChanged():boolean{return this.workflow==='create'&&this.dirty&&!!this.previewConfiguration&&this.previewConfiguration!==this.configuration();}
 get effectiveCrossRules():CrossRule[]{return this.workflow==='create'&&this.dirty?this.previewAllowCross?this.previewCrossRules:[]:this.allowCross?this.crossRules:[];}
 private preparePreview():void {this.mode=this.context.entries.length?'':'append';this.deletedGames=[];this.deletedEvents=[];this.previewRevision=this.context.revision;this.previewAllowCross=this.allowCross;this.previewCrossRules=JSON.parse(JSON.stringify(this.crossRules));this.previewConfiguration=this.configuration();this.dirty=true;this.uncertain=false;this.divisionFilter='';this.weekFilter=0;this.statusFilter='all';this.adjustPreview=false;}
 createPreview():void {
  if(this.dirty&&!window.confirm('Replace this unsaved preview?'))return;try{
   if(!isoDay(this.firstDate))throw Error('Choose a valid First Game Date.');if(this.customWeekday&&+this.day!==this.weekday(this.firstDate))throw Error('Weekly game day must match First Game Date. Change the date or weekday so the first games occur on the date shown.');if(this.method==='manual'){this.preparePreview();this.entries=[];this.validationGames=+this.games;this.replacementScopes=this.plans.filter(p=>p.included).map(p=>p.key);this.byes=[];this.error='';this.addManual();return;}
   const excluded=this.excluded.split(/[\s,]+/).filter(Boolean);if(excluded.some(d=>!isoDay(d)))throw Error('Use YYYY-MM-DD for every excluded date.');
   const plans=this.plans.map(p=>p.override?p:{...p,weeks:+this.weeks,firstDate:this.firstDate,day:this.customWeekday?+this.day:this.weekday(this.firstDate),games:+this.games});
   const special=this.specialDates.split(/\r?\n/).filter(line=>line.trim()).map(line=>{const fields=line.split('|').map(x=>x.trim());if(fields.length!==4||!isoDay(fields[1])||!Number.isInteger(+fields[0])||+fields[0]<1||+fields[0]>104||!['Tournament','Playoffs','NoGames','Other'].includes(fields[2])||!fields[3])throw Error('Use Week | YYYY-MM-DD | Tournament/Playoffs/NoGames/Other | Title for special dates.');excluded.push(fields[1]);const event=blankEntry(fields[1],+fields[0]);event.kind='event';event.eventType=fields[2];event.description=fields[3];return event;});
   plans.filter(p=>p.included).forEach(p=>{if(+p.day!==this.weekday(p.firstDate))throw Error(this.divisionName(p.key)+': First date and weekday must match.');if(excluded.includes(p.firstDate))throw Error(this.divisionName(p.key)+': First Game Date is excluded or reserved for a special event. Choose the first actual playing date.');});const result=generateSchedule(this.teams,plans,excluded,this.method,this.allowCross?this.crossRules:[]);if(result.entries.length+special.length>1000)throw Error('Limit the schedule to 1,000 games and events.');this.preparePreview();this.validationGames=Math.max(...plans.filter(p=>p.included).map(p=>+p.games));this.replacementScopes=plans.filter(p=>p.included).map(p=>p.key);this.entries=result.entries.concat(special);this.byes=result.byes;this.warnings=result.warnings;this.notice='Generated preview only. Review before saving.';this.error='';this.refresh();this.scrollPreview=true;
  }catch(e){this.error=e.message;}
 }
 addCrossRule():void {const divisions=this.divisions.filter(d=>d.teams>0);if(divisions.length>=2)this.crossRules.push({division1:divisions[0].key,division2:divisions[1].key,everyWeeks:3,games:1});this.refresh();}
 addManual(kind='game'):void {if(!this.canManage||this.busy)return;if(this.workflow==='existing'&&!this.editingExisting)this.editSaved();if(this.mode!=='edit'&&!this.dirty){this.preparePreview();this.entries=[];}this.adjustPreview=true;const date=isoDay(this.firstDate)||new Date().toISOString().slice(0,10),e=blankEntry(date,this.weekFilter||1,this.divisionFilter||this.divisions.find(d=>d.teams>0)&&this.divisions.find(d=>d.teams>0).key||'');(e as any).expanded=true;e.kind=kind;if(kind==='event'){e.description='';e.eventType='Other';}this.entries.push(e);this.dirty=true;this.refresh();this.scrollPreview=true;}
 remove(e:ScheduleEntry):void {if(e.isProtected){this.error='Saved results protect this game.';return;}if(e.id){if(e.kind==='event')this.deletedEvents.push(e.id);else this.deletedGames.push(e.id);}this.entries=this.entries.filter(row=>row!==e);this.dirty=true;this.refresh();}
 edit(e?:ScheduleEntry):void {this.dirty=true;if(e&&e.team1Id&&!e.divisionKey)e.divisionKey=(this.teams.find(t=>t.id===e.team1Id)||{} as any).divisionKey||'';this.refresh();}
 changeDivision(e:ScheduleEntry):void {e.sourceDivision='';if(e.kind==='game'){e.team1Id=0;e.team2Id=0;}this.edit(e);}
 confirmDivision(e:ScheduleEntry):void{e.sourceDivision='';this.edit(e);}
 teamName(id:number):string {const t=this.teams.find(t=>t.id===id);return t?t.teamName:'Unresolved team';}
 divisionName(key:string):string {const d=this.divisions.find(d=>d.key===key);return d?d.name:'Entire League';}
 actualDivision(e:ScheduleEntry):string {if(e.kind==='event')return this.divisionName(e.divisionKey);const a=this.teams.find(t=>t.id===e.team1Id),b=this.teams.find(t=>t.id===e.team2Id);return a&&b?a.divisionKey===b.divisionKey?(a.division||'No Division'):(a.division||'No Division')+' / '+(b.division||'No Division'):'Resolve teams';}
 teamOptions(e:ScheduleEntry,side:number):ScheduleTeam[]{return this.teams.filter(t=>!e.divisionKey||t.divisionKey===e.divisionKey||side===2&&this.allowCross&&this.crossRules.some(r=>pair(r.division1,r.division2)===pair(e.divisionKey,t.divisionKey))).slice().sort((a,b)=>this.candidateScore(b,e,side)-this.candidateScore(a,e,side)||a.teamName.localeCompare(b.teamName));}
 candidateScore(team:ScheduleTeam,e:ScheduleEntry,side:number):number{const source=normalize(side===1?e.sourceTeam1:e.sourceTeam2);if(!source)return 0;const words=normalize(team.teamName).split(' ');return source.split(' ').filter(word=>words.some(other=>other===word||word.length>3&&other.slice(0,4)===word.slice(0,4))).length;}
 private existingForValidation():ScheduleEntry[]{
  if(!this.context)return [];const ids=new Set(this.entries.filter(e=>e.id).map(e=>e.kind+':'+e.id));return this.context.entries.filter(e=>!ids.has(e.kind+':'+e.id)&&!(e.kind==='game'?(this.deletedGames.includes(e.id)||this.replacementIds.includes(e.id)):this.deletedEvents.includes(e.id)));
 }
 toggleScope(key:string,included:boolean):void{this.replacementScopes=included?Array.from(new Set(this.replacementScopes.concat(key))):this.replacementScopes.filter(k=>k!==key);this.refresh();}
 get replacementIds():number[]{return !this.context||this.mode!=='replace-future'?[]:replacementGameIds(this.entries,this.context.entries,this.teams,this.replacementScopes,this.context.today||new Date().toISOString().slice(0,10));}
 get maxGames():number{return +this.validationGames;}
 refresh():void {
  if(!this.context)return;this.entries.forEach((e,i)=>e.key=i);const invalidEventDivisions:ScheduleEntry[]=[];
  this.entries.filter(e=>e.sourceDivision).forEach(e=>{if(e.kind==='event'){const ds=this.divisions.filter(d=>normalize(d.name)===normalize(e.sourceDivision)||this.context.divisions.some(c=>'d:'+c.id===d.key&&normalize(c.code)===normalize(e.sourceDivision)));if(ds.length===1){e.divisionKey=ds[0].key;e.sourceDivision='';}else invalidEventDivisions.push(e);}else{const team=this.teams.find(t=>t.id===e.team1Id);if(team&&team.divisionKey==='none'&&['no division','none','unassigned'].includes(normalize(e.sourceDivision)))e.sourceDivision='';const d=this.context.divisions.find(d=>'d:'+d.id===(team&&team.divisionKey));if(d&&normalize(d.code)===normalize(e.sourceDivision))e.sourceDivision=team.division;}});
  validateSchedule(this.entries,this.teams,this.existingForValidation(),this.maxGames,this.effectiveCrossRules,this.context.eventsAvailable);invalidEventDivisions.forEach(e=>e.issues.push('division'));
  this.summary={};this.statuses.forEach(status=>this.summary[status]=this.entries.filter(e=>status==='all'||status==='valid'?status==='all'||!e.issues.length:status==='review'?e.issues.length:e.issues.includes(status)).length);this.statistics=scheduleSummary(this.entries,this.teams);this.statistics.teams=new Set(this.entries.filter(e=>e.kind==='game').reduce((all:number[],e)=>all.concat(e.team1Id,e.team2Id),[])).size;this.existingConflictCount=this.entries.filter(e=>(e.conflicts||[]).some(c=>!!c.savedGameId)).length;this.filter();this.remember();
 }
 filter():void {this.visible=this.entries.filter(e=>(!this.divisionFilter||e.kind==='event'&&(!e.divisionKey||e.divisionKey===this.divisionFilter)||[e.team1Id,e.team2Id].some(id=>(this.teams.find(t=>t.id===id)||{} as any).divisionKey===this.divisionFilter))&&(!this.weekFilter||e.weekNumber===+this.weekFilter)&&(this.statusFilter==='all'||this.statusFilter==='valid'&&!e.issues.length||this.statusFilter==='review'&&e.issues.length||e.issues.includes(this.statusFilter))).sort((a,b)=>a.date.localeCompare(b.date)||a.weekNumber-b.weekNumber||this.actualDivision(a).localeCompare(this.actualDivision(b))||a.key-b.key);this.buildPreviewWeeks();}
 private buildPreviewWeeks():void {const weeks=new Map<string,any>();this.visible.forEach(e=>{const key=e.date+':'+e.weekNumber;if(!weeks.has(key))weeks.set(key,{key,date:e.date,week:e.weekNumber,groups:[],events:[]});const w=weeks.get(key);if(e.kind==='event')w.events.push(e);else{const division=this.actualDivision(e);let group=w.groups.find(g=>g.division===division);if(!group){group={division,entries:[]};w.groups.push(group);}group.entries.push(e);}});this.previewWeeks=Array.from(weeks.values());}
 get showRows():boolean{return this.workflow==='import'||this.workflow==='existing'&&this.editingExisting||this.workflow==='create'&&this.adjustPreview;}
 issueText(e:ScheduleEntry):string {if(e.conflicts&&e.conflicts.length)return e.conflicts.map(c=>c.message).join(' ');const descriptions={invalid:'Check the week, date, opponents or event details',unresolved:'Choose the correct existing team',division:'Confirm the division or permitted cross-division game',duplicate:'Duplicate matchup or event',date:'A No Games event conflicts with the matchup date'};return (e.issues||[]).map(issue=>descriptions[issue]||issue).join('. ');}
 get saveDisabledReason():string {
  if(!this.canManage)return 'You do not have permission to modify this league’s schedule.';
  if(this.loading)return 'Loading the selected league’s schedule.';if(!this.context||!this.leagueId||this.context.leagueId!==this.leagueId)return 'Load a league schedule before saving.';
  if(this.busy)return 'Saving schedule. Please wait.';if(this.reading)return 'Wait for file processing to finish.';
  if(this.uncertain)return 'Reload Saved Schedule to check the last save before retrying. Your unsaved work will be retained.';
  if(!this.dirty&&this.workflow==='create'&&this.error)return 'No preview was generated. '+this.error;
  if(!this.dirty&&this.workflow==='create'&&!this.plans.some(p=>p.included&&this.teamCount(p.key)>=2))return 'Choose at least one division containing at least two teams.';
  if(!this.dirty)return this.workflow==='existing'?'No unsaved changes. Choose Edit Schedule to make changes.':this.workflow==='import'?'Upload and analyze a schedule before saving.':'Generate a schedule preview before saving.';
  if(this.workflow!=='existing'&&this.views.existing&&this.views.existing.dirty)return 'Save or discard the unsaved edits in Manage Existing before saving another schedule.';
  if(!['append','edit','replace-future'].includes(this.mode))return 'Choose how to handle the existing schedule: Add New Games or Replace Future Unplayed Games.';
  if(this.mode==='replace-future'&&!this.replacementScopes.length)return 'Choose at least one replacement division containing teams.';
  if(!Number.isInteger(this.maxGames)||this.maxGames<1||this.maxGames>10)return 'Choose a games-per-week limit from 1 to 10 for this preview.';
  if(!this.previewRevision)return 'Reload Saved Schedule before saving this preview.';
  if(!this.entries.length&&!this.deletedGames.length&&!this.deletedEvents.length)return 'Add at least one matchup or event before saving.';
  const conflicts=this.entries.filter(e=>e.issues&&e.issues.length).length;
  if(conflicts&&this.existingConflictCount)return this.existingConflictCount+' preview games conflict with the saved schedule. Review the conflicting dates below. Replace only eligible games in this preview?s date range, or adjust dates or opponents. Past games and games with scores remain protected.';
  if(conflicts)return 'Resolve '+conflicts+' scheduling conflict'+(conflicts===1?'':'s')+' before saving. Select Needs Review to locate the affected rows.';
  return '';
 }
 get canSave():boolean{return !this.saveDisabledReason;}
 get conflictMessages():string[]{return Array.from(new Set(this.entries.filter(e=>e.issues&&e.issues.length).map(e=>this.issueText(e))));}
 get attentionCount():number{return this.entries.filter(e=>e.issues&&e.issues.length).length;}
 save():void {
  if(!this.canSave)return;const updates=this.entries.filter(e=>e.id&&changed(e)).length,adds=this.entries.filter(e=>!e.id).length,removes=this.deletedGames.length+this.deletedEvents.length+this.replacementIds.length,games=this.entries.filter(e=>e.kind==='game'&&!e.id).length;
  const operation=this.mode==='replace-future'?'Replace Future Unplayed Games':this.mode==='edit'?'Edit Existing Schedule':'Add New Games';
  if(!window.confirm(this.leagueName+' — '+operation+'\nSave '+games+' new games ('+adds+' total additions), '+updates+' edits and '+removes+' removals? Completed games and scores will be protected.'))return;
  const leagueId=this.leagueId,version=this.version;this.busy=true;this.error='';
  const payload={revision:this.previewRevision,mode:this.mode,maxGamesPerTeam:this.maxGames,allowCrossDivision:this.effectiveCrossRules.length>0,crossRules:this.effectiveCrossRules,replaceDivisions:this.replacementScopes,deleteGameIds:this.deletedGames,deleteEventIds:this.deletedEvents,entries:this.entries.map(e=>({id:e.id,kind:e.kind,weekNumber:+e.weekNumber,date:e.date,team1Id:e.team1Id,team2Id:e.team2Id,description:e.description,divisionKey:e.divisionKey,eventType:e.eventType}))};
  this.http.post<any>('api/ScheduleManagement/'+leagueId,payload).pipe(timeout(30000)).subscribe(result=>{
   if(!result||!result.atomic||!result.context){this.failedSave(version);return;}if(this.destroyed||version!==this.version)return;this.busy=false;this.context=result.context;this.views[this.workflow]=this.defaults(this.workflow);this.views.existing=this.defaults('existing');this.restore('existing');this.notice='Schedule saved successfully. Showing the refreshed saved schedule.';this.remember();this.scrollPreview=true;
  },error=>{if(version!==this.version||this.destroyed)return;this.failedSave(version,error);});
 }
 private failedSave(version:number,error?:any):void {if(this.destroyed||version!==this.version)return;this.busy=false;this.uncertain=!error||error.status!==400;const reason=error&&(typeof error.error==='string'?error.error:error.error&&error.error.message);this.error=(reason?reason+' ':'')+(this.uncertain?'Could not confirm the save. Reload Saved Schedule to reconcile before retrying.':'The server rejected this preview. Correct the highlighted configuration or reload saved games and retry.')+' Your unsaved preview has been retained.';this.remember();}
 async chooseFile(event:any):Promise<void>{
  const file:File=event.target.files&&event.target.files[0];event.target.value='';if(!file||this.busy)return;const selection=++this.fileVersion,version=this.version;
  if(!file.size||file.size>5*1024*1024){this.error='Choose a nonempty file up to 5 MB (structured files up to 2 MB).';return;}
  const ext=file.name.split('.').pop().toLowerCase();this.error='';
  if(['pdf','png','jpg','jpeg'].includes(ext)){
   const bytes=new Uint8Array(await new Response(file).arrayBuffer());if(selection!==this.fileVersion||version!==this.version||this.destroyed)return;
   let valid=ext==='pdf'?String.fromCharCode(...Array.from(bytes.slice(0,5)))==='%PDF-'&&new TextDecoder().decode(bytes.slice(-2048)).includes('%%EOF'):ext==='png'?[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b):bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
   if(ext==='png'){if(bytes.length<24)valid=false;else{const view=new DataView(bytes.buffer),w=view.getUint32(16),h=view.getUint32(20);if(!w||!h||w*h>20000000)valid=false;}}
   if(ext==='jpg'||ext==='jpeg'){let found=false;for(let i=2;i+8<bytes.length;){if(bytes[i]!==255)break;const marker=bytes[i+1],length=bytes[i+2]*256+bytes[i+3];if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){const h=bytes[i+5]*256+bytes[i+6],w=bytes[i+7]*256+bytes[i+8];found=!!(w&&h&&w*h<=20000000);break;}if(length<2)break;i+=length+2;}valid=valid&&found;}
   if(!valid){this.error='The reference is malformed, exceeds 20 million pixels, or does not match its format.';return;}
   this.stopWorker();this.grid=null;this.sheets=[];this.sheet='';if(this.referenceUrl)URL.revokeObjectURL(this.referenceUrl);this.filename=file.name;this.referenceKind=ext==='pdf'?'pdf':'image';this.referenceUrl=URL.createObjectURL(new Blob([bytes],{type:ext==='pdf'?'application/pdf':ext==='png'?'image/png':'image/jpeg'}));this.notice='Reference only: automatic PDF extraction/OCR is unavailable. Transcribe each week explicitly below; no games were extracted.';return;
  }
  if(!['txt','csv','xlsx','xls'].includes(ext)||file.size>2*1024*1024){this.error='Use TXT, CSV, XLSX or binary XLS up to 2 MB; PDF/images are reference-only up to 5 MB.';return;}
  this.stopWorker();this.grid=null;this.sheets=[];this.sheet='';this.filename=file.name;if(this.referenceUrl)URL.revokeObjectURL(this.referenceUrl);this.referenceUrl='';this.reading=true;
  const worker=this.makeWorker(),id=++this.request,reader=new FileReader();reader.onload=()=>{if(selection!==this.fileVersion||version!==this.version||this.destroyed)return;const buffer=reader.result as ArrayBuffer;this.fileBuffer=buffer.slice(0);this.fileExtension=ext;worker.postMessage({id,buffer,extension:ext},[buffer]);};reader.onerror=()=>{this.error='Could not read the file.';this.stopWorker();};reader.readAsArrayBuffer(file);
 }
 private makeWorker():Worker{this.worker=new Worker(new URL('assets/import/roster-worker.js',document.baseURI).href);this.timer=setTimeout(()=>{this.error='File processing reached its time limit.';this.stopWorker();},12000);this.worker.onmessage=event=>{const r=event.data;if(r.id!==this.request)return;clearTimeout(this.timer);this.reading=false;if(r.error){this.error=r.error;return;}if(r.exported){this.download(new Blob([r.exported],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),'schedule.xlsx');this.stopWorker();return;}this.grid=r;this.sheets=r.sheets;this.sheet=r.sheet;this.mapping=detectScheduleMapping(r);this.columns=Array.from({length:Math.max(1,...r.rows.map(row=>row.length))},(_,i)=>i);this.notice='File parsed. Verify the worksheet and mappings, then Analyze Import. Nothing has been saved.';};this.worker.onerror=()=>{this.error='File processing failed.';this.stopWorker();};return this.worker;}
 changeSheet():void {if(!this.fileBuffer){this.error='Reselect the workbook to change worksheets. Your preview is retained.';return;}this.stopWorker();this.reading=true;const buffer=this.fileBuffer.slice(0);this.makeWorker().postMessage({id:++this.request,buffer,extension:this.fileExtension,sheet:this.sheet},[buffer]);}
 analyze():void{if(!this.grid)return;try{const rows=this.grid.kind==='txt'?importScheduleText(this.grid.rows.map(r=>r[0]).join('\n'),this.teams,this.dateFormat):importScheduleGrid(this.grid,this.mapping,this.teams,this.dateFormat);this.replacePreview(rows);}catch(e){this.error=e.message;}}
 analyzeText():void{try{this.replacePreview(importScheduleText(this.text,this.teams,this.dateFormat));}catch(e){this.error=e.message;}}
 private replacePreview(rows:ScheduleEntry[]):void{if(this.dirty&&!window.confirm('Replace the current unsaved preview with this import?'))return;this.preparePreview();this.entries=rows;this.replacementScopes=Array.from(new Set(rows.filter(e=>e.kind==='game').reduce((all:string[],e)=>all.concat([e.team1Id,e.team2Id].map(id=>(this.teams.find(t=>t.id===id)||{} as any).divisionKey).filter(Boolean)),[])));this.validationGames=1;this.byes=[];this.error='';this.notice='Imported preview only. Resolve all attention rows before saving.';this.refresh();this.scrollPreview=true;}
 private download(blob:Blob,name:string):void{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 export(kind:string):void {
  const rows:any[][]=[['Week','Date','Division','Team 1','Team 2','Notes','Type','Event']];this.printEntries().forEach(e=>rows.push([e.weekNumber,e.date,e.kind==='event'&&!e.divisionKey?'':this.actualDivision(e),e.kind==='game'?this.teamName(e.team1Id):'',e.kind==='game'?this.teamName(e.team2Id):'',e.kind==='game'?e.description:'',e.kind==='game'?'Game':e.eventType,e.kind==='event'?e.description:'']));
  if(kind==='csv'){const value=rows.map(row=>row.map(cell=>'"'+String(cell).replace(/^[\s]*[=+@-]/,match=>"'"+match).replace(/"/g,'""')+'"').join(',')).join('\r\n');this.download(new Blob(['\ufeff'+value],{type:'text/csv;charset=utf-8'}),'schedule.csv');}
  else{this.stopWorker();this.reading=true;this.makeWorker().postMessage({id:++this.request,operation:'exportSchedule',rows});}
 }
 private printEntries():ScheduleEntry[]{return this.entries.filter(e=>!this.divisionFilter||e.kind==='event'&&(!e.divisionKey||e.divisionKey===this.divisionFilter)||[e.team1Id,e.team2Id].some(id=>(this.teams.find(t=>t.id===id)||{} as any).divisionKey===this.divisionFilter));}
 print():void{const weeks=new Map<string,any>();this.printEntries().forEach(e=>{const key=e.date+':'+e.weekNumber;if(!weeks.has(key))weeks.set(key,{date:e.date,weekNumber:e.weekNumber,groups:[],events:[],byes:[]});const week=weeks.get(key);if(e.kind==='event')week.events.push(this.actualDivision(e)+' — '+e.description);else{const division=this.actualDivision(e);let group=week.groups.find(g=>g.division===division);if(!group){group={division,matches:[]};week.groups.push(group);}group.matches.push({team1Name:this.teamName(e.team1Id),team2Name:this.teamName(e.team2Id)});if(e.description)week.events.push(e.description);}});this.byes.forEach(b=>{const w=weeks.get(b.date+':'+b.week);if(w&&(!this.divisionFilter||b.division===this.divisionFilter)&&!w.byes.includes(this.teamName(b.teamId)))w.byes.push(this.teamName(b.teamId));});if(!printSeasonSchedule(this.leagueName,Array.from(weeks.values()).sort((a,b)=>a.date.localeCompare(b.date)||a.weekNumber-b.weekNumber),this.dirty))this.error='Allow popups to open the print preview.';}
 byeCount(id:number):number{return this.byes.filter(b=>b.teamId===id).length;}
 private stopWorker():void{clearTimeout(this.timer);if(this.worker)this.worker.terminate();this.worker=null;this.reading=false;}
 ngOnDestroy():void{this.remember();this.destroyed=true;this.version++;this.stopWorker();if(this.referenceUrl)URL.revokeObjectURL(this.referenceUrl);}
}
