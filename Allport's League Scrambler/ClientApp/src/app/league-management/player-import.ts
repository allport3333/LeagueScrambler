// Pure import matching. It never creates profiles or writes memberships.
export interface ImportMapping { fullName: number; firstName: number; lastName: number; division: number; gender: number; headerRow: number; startRow: number; }
export interface ImportGrid { rows: string[][]; invalid: { [key: string]: string }; types: { [key: string]: string }; kind?: string; }
export interface ImportRow {
    line: number; uploadedName: string; firstName: string; lastName: string; sourceDivision: string; sourceGender: string;
    playerId: number; candidates: number[]; exact: boolean; confirmed: boolean; divisionId: number; divisionOverride?: boolean;
    status: string; problem: string; invalid: string; duplicateOf?: number; imported?: boolean;
}
export function normalName(value: string): string { return String(value || '').normalize('NFKC').replace(/[’‘]/g, "'").trim().replace(/\s+/g, ' ').toLocaleLowerCase(); }
const headings = {
    fullName: ['name','fullname','player','playername'], firstName: ['firstname','first','givenname'],
    lastName: ['lastname','last','surname','familyname'], division: ['division','league division','divisionname','divisioncode'], gender: ['gender','sex']
};
export function detectMapping(grid: ImportGrid): ImportMapping {
    const blank = (): ImportMapping => ({ fullName:-1, firstName:-1, lastName:-1, division:-1, gender:-1, headerRow:0, startRow:1 });
    if (grid.kind !== 'txt') for (let r=0;r<Math.min(24,grid.rows.length);r++) {
        const map=blank();
        grid.rows[r].forEach((cell,c)=>Object.keys(headings).forEach(key=>{
            const label=normalName(cell).replace(/[^a-z]/g,'');
            if (headings[key].some(x=>x.replace(/[^a-z]/g,'')===label)) map[key]=c;
        }));
        if(map.fullName>=0 || map.firstName>=0&&map.lastName>=0){map.headerRow=r+1;map.startRow=r+2;return map;}
    }
    const map=blank(); if(grid.rows.every(row=>row.length<=1)) map.fullName=0; return map;
}
function loose(value:string):string { return normalName(value).replace(/[.,]/g,'').replace(/\s+/g,' '); }
function editDistance(a:string,b:string,limit:number):number {
    if(Math.abs(a.length-b.length)>limit)return limit+1;
    let previous=Array.from({length:b.length+1},(_,i)=>i);
    for(let i=1;i<=a.length;i++) {const next=[i];let best=i;for(let j=1;j<=b.length;j++){next[j]=Math.min(next[j-1]+1,previous[j]+1,previous[j-1]+Number(a[i-1]!==b[j-1]));best=Math.min(best,next[j]);}if(best>limit)return limit+1;previous=next;}
    return previous[b.length];
}
const aliases={chris:'christopher',dave:'david',mike:'michael',bob:'robert',rob:'robert',bill:'william',will:'william',jim:'james',liz:'elizabeth',beth:'elizabeth',kate:'katherine',andy:'andrew',dan:'daniel',danny:'daniel',ben:'benjamin'};
export function importPlayerCandidates(name:string,profiles:any[]):number[] {
    const value=loose(name),parts=value.split(' '),scores=[];
    for(const profile of profiles){
        const full=loose(profile.firstName+' '+profile.lastName),first=loose(profile.firstName),last=loose(profile.lastName);let score=0;
        if(loose(profile.lastName+' '+profile.firstName)===value)score=100;
        else if(parts[parts.length-1]===last && (parts[0]===first || parts[0]===first[0] || aliases[parts[0]]===first || aliases[first]===parts[0]))score=95;
        else if(Math.abs(full.length-value.length)<=3 && parts.some(p=>p[0]===first[0]||p[0]===last[0])){const distance=editDistance(value,full,Math.min(3,Math.max(1,Math.floor(full.length*.15))));if(distance<=Math.min(3,Math.max(1,Math.floor(full.length*.15))))score=80-distance;}
        if(score)scores.push({id:profile.id,score});
    }
    return scores.sort((a,b)=>b.score-a.score||a.id-b.id).slice(0,6).map(x=>x.id);
}
export async function analyseImport(grid:ImportGrid,map:ImportMapping,context:any,defaultDivision:number,cancelled:()=>boolean=()=>false):Promise<ImportRow[]> {
    if(map.fullName<0 && (map.firstName<0||map.lastName<0)) throw new Error('Map a full name column or both first and last name columns.');
    if(!Number.isInteger(map.startRow)||map.startRow<1||map.startRow>grid.rows.length+1)throw new Error('Choose a valid first data row.');
    const mapped=[map.fullName>=0?map.fullName:map.firstName,map.fullName>=0?-1:map.lastName,map.division,map.gender].filter(x=>x>=0);
    if(mapped.some(x=>!Number.isInteger(x)||x>=20)||new Set(mapped).size!==mapped.length)throw new Error('Map each field to a separate available column.');
    const names=new Map<string,number[]>();context.players.forEach(p=>{const key=normalName(p.firstName+' '+p.lastName);names.set(key,(names.get(key)||[]).concat(p.id));});
    const rows:ImportRow[]=[];
    for(let i=map.startRow-1;i<grid.rows.length;i++){
        if(cancelled())throw new Error('Analysis canceled.');
        const cells=grid.rows[i];if(!cells.some(x=>!!String(x).trim())&&!Object.keys(grid.invalid).some(k=>k.indexOf(i+':')===0))continue;
        if(rows.length>=1000)throw new Error('Import at most 1000 player rows at a time.');
        const read=(col:number)=>col>=0?String(cells[col]||''):'';
        const firstName=read(map.firstName),lastName=read(map.lastName),uploadedName=map.fullName>=0?read(map.fullName):firstName+' '+lastName, sourceDivision=read(map.division).trim(),sourceGender=read(map.gender).trim();
        let invalid='';
        if(!normalName(uploadedName)||map.fullName<0&&(!normalName(firstName)||!normalName(lastName)))invalid='A complete name is required.';
        if(uploadedName.length>200||/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(uploadedName))invalid='The player name is too long or contains unsupported control characters.';
        for(const col of [map.fullName>=0?map.fullName:map.firstName,map.fullName>=0?-1:map.lastName].filter(x=>x>=0))if(grid.invalid[i+':'+col])invalid=grid.invalid[i+':'+col];
        for(const col of [map.fullName>=0?map.fullName:map.firstName,map.fullName>=0?-1:map.lastName].filter(x=>x>=0))if(grid.types[i+':'+col]&&['s','str'].indexOf(grid.types[i+':'+col])<0)invalid='Use text cells for player names.';
        const exact=names.get(normalName(uploadedName))||[],matches=exact.length?exact:invalid?[]:importPlayerCandidates(uploadedName,context.players);
        const divisions=sourceDivision?context.divisions.filter(d=>[d.name,d.code].some(v=>normalName(v)===normalName(sourceDivision))):[];
        const noDivision=['no division','none','unassigned'].indexOf(normalName(sourceDivision))>=0;
        rows.push({line:i+1,uploadedName,firstName:map.fullName<0?firstName:'',lastName:map.fullName<0?lastName:'',sourceDivision,sourceGender,playerId:exact.length===1?exact[0]:0,candidates:matches,exact:exact.length===1,confirmed:false,divisionId:grid.invalid[i+':'+map.division]?null:sourceDivision?(noDivision?0:divisions.length===1?divisions[0].id:null):defaultDivision,status:'',problem:'',invalid});
        if(i%25===0)await new Promise(resolve=>setTimeout(resolve,0));
    }
    if(!rows.length)throw new Error('No player rows were found after the selected header.');
    refreshImportRows(rows,context);return rows;
}
export function importRowNeedsAttention(row:ImportRow):boolean {return ['review','not-found','duplicate','invalid'].indexOf(row.status)>=0;}
export function importRowMatchesFilter(row:ImportRow,filter:string):boolean {
    return filter==='all'||filter==='exact'&&row.exact&&!row.invalid||filter==='review'&&importRowNeedsAttention(row)||filter!=='exact'&&filter!=='review'&&row.status===filter;
}
export function refreshImportRows(rows:ImportRow[],context:any):void {
    const members=new Set(context.members.map(m=>m.playerId)),names=new Map<string,number>(),ids=new Map<number,number>();
    rows.forEach(row=>{
        row.duplicateOf=undefined;row.problem='';const name=normalName(row.uploadedName),nameDuplicate=names.get(name),idDuplicate=ids.get(row.playerId);
        if(!names.has(name))names.set(name,row.line);
        if(row.playerId&&!ids.has(row.playerId))ids.set(row.playerId,row.line);
        if(row.invalid){row.status='invalid';row.problem=row.invalid;}
        else if(nameDuplicate!==undefined&&!row.confirmed || row.playerId&&idDuplicate!==undefined){row.status='duplicate';row.duplicateOf=idDuplicate||nameDuplicate;row.problem='Duplicate of row '+row.duplicateOf+'.';}
        else if(row.playerId&&members.has(row.playerId)){row.status=row.imported?'added':'already';row.problem='Existing membership and division are unchanged.';}
        else if(!row.playerId){row.status=row.candidates.length?'review':'not-found';row.problem=row.candidates.length?'Choose and confirm the correct player.':'No suitable existing player was found.';}
        else if(row.divisionId===null||row.divisionId!==0&&!context.divisions.some(d=>d.id===row.divisionId)){row.status='review';row.problem='Choose a valid division; the uploaded division is unknown or ambiguous.';}
        else row.status='ready';
    });
}
