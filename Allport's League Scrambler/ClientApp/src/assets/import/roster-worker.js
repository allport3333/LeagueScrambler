/* Local-only parser. Worker is terminated by its owner after 12 seconds. */
importScripts('../vendor/sheetjs-0.20.3/xlsx.full.min.js');
self.fetch = function () { return Promise.reject(new Error('External workbook resources are not allowed.')); };
self.XMLHttpRequest = undefined;
var source, kind, sheetNames;
var MAX_FILE = 2 * 1024 * 1024, MAX_EXPANDED = 8 * 1024 * 1024, MAX_ROWS = 1024, MAX_COLS = 20;
function fail(message) { throw new Error(message); }
function decode(bytes) {
    if (bytes[0] === 255 && bytes[1] === 254) return new TextDecoder('utf-16le', { fatal: true }).decode(bytes.subarray(2));
    if (bytes[0] === 254 && bytes[1] === 255) return new TextDecoder('utf-16be', { fatal: true }).decode(bytes.subarray(2));
    try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, ''); }
    catch (_) { return new TextDecoder('windows-1252').decode(bytes); }
}
function validateOle(bytes) {
    if (bytes.length < 512) fail('The XLS workbook is incomplete.');
    var v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), major=v.getUint16(26,true), shift=v.getUint16(30,true);
    if(v.getUint16(28,true)!==65534 || !((major===3&&shift===9)||(major===4&&shift===12)) || v.getUint16(32,true)!==6)fail('The XLS container has invalid sector sizes.');
    var size=Math.pow(2,shift), sectors=Math.floor(bytes.length/size)-1, fatCount=v.getUint32(44,true), fats=[], seen=new Set(), total=0, entries=0, workbook=false;
    if(sectors<1||fatCount>109||v.getUint32(72,true)!==0||v.getUint32(64,true)>sectors)fail('The XLS container is too complex or malformed.');
    for(var i=0;i<fatCount;i++){var f=v.getUint32(76+4*i,true);if(f>=sectors||fats.indexOf(f)>=0)fail('The XLS allocation table is invalid.');fats.push(f);}
    function next(sector){var index=Math.floor(sector/(size/4));if(index>=fats.length)fail('The XLS allocation table is incomplete.');return v.getUint32((fats[index]+1)*size+(sector%(size/4))*4,true);}
    var dir=v.getUint32(48,true);
    while(dir!==4294967294){
        if(dir>=sectors||seen.has(dir))fail('The XLS directory is cyclic or invalid.');seen.add(dir);
        for(var n=0;n<size;n+=128){var at=(dir+1)*size+n,type=bytes[at+66];if(!type)continue;
            if(++entries>1024||[1,2,5].indexOf(type)<0)fail('The XLS directory exceeds safe limits.');
            var length=v.getUint16(at+64,true);if(length<2||length>64||length%2)fail('The XLS directory name is invalid.');
            var name=new TextDecoder('utf-16le').decode(bytes.subarray(at,at+length-2));
            if(/^(VBA|_VBA_PROJECT|__proto__|constructor|prototype)$/i.test(name))fail('Macro or unsupported XLS streams are not accepted.');
            if(type===2||type===5){var lengthLow=v.getUint32(at+120,true),high=v.getUint32(at+124,true);if(high||lengthLow>bytes.length||(total+=lengthLow)>MAX_EXPANDED)fail('The XLS streams exceed safe limits.');if(type===2&&/^(Workbook|Book)$/.test(name))workbook=true;
                if(lengthLow>=4096){var current=v.getUint32(at+116,true),visited=new Set();for(var k=0;k<Math.ceil(lengthLow/size);k++){if(current>=sectors||visited.has(current))fail('An XLS stream chain is invalid.');visited.add(current);current=next(current);}}
            }
        }
        dir=next(dir);
    }
    if(!workbook)fail('This OLE file is not an Excel XLS workbook.');
}
// Central-directory declarations alone do not stop forged-size ZIP bombs. Verify
// actual decompressed byte counts with a bounded stream before giving data to SheetJS.
async function validateZip(bytes) {
    var view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), end = -1;
    for (var i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
    if (end < 0 || view.getUint16(end + 4, true) || view.getUint16(end + 6, true)) fail('This is not a supported XLSX workbook.');
    var count = view.getUint16(end + 10, true), offset = view.getUint32(end + 16, true), total = 0, names = new Set(), ranges = [];
    if (!count || count > 2000 || offset >= end || count === 65535) fail('The workbook archive is too complex.');
    for (var n = 0; n < count; n++) {
        if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50) fail('The workbook archive is malformed.');
        var flags = view.getUint16(offset + 8, true), method = view.getUint16(offset + 10, true), compressed = view.getUint32(offset + 20, true), size = view.getUint32(offset + 24, true);
        var length = view.getUint16(offset + 28, true), extra = view.getUint16(offset + 30, true), comment = view.getUint16(offset + 32, true), local = view.getUint32(offset + 42, true);
        var name = new TextDecoder('utf-8').decode(bytes.subarray(offset + 46, offset + 46 + length));
        if (flags & 1 || (method !== 0 && method !== 8) || size > 4 * 1024 * 1024 || (total += size) > MAX_EXPANDED || size > Math.max(1, compressed) * 200 || names.has(name) || /(^|[\\/])\.\.([\\/]|$)|\0/.test(name)) fail('The workbook archive exceeds safe limits or is unsupported.');
        if (/vbaProject\.bin$/i.test(name)) fail('Macro-enabled workbooks are not supported. Save a macro-free XLSX copy.');
        names.add(name);
        if (local + 30 > offset || view.getUint32(local, true) !== 0x04034b50) fail('The workbook archive is malformed.');
        var start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true), finish = start + compressed;
        if (finish > view.getUint32(end + 16, true) || ranges.some(r => start < r[1] && finish > r[0])) fail('The workbook archive has overlapping entries.');
        ranges.push([local, finish]);
        if (method === 0) { if (size !== compressed) fail('The workbook archive has invalid sizes.'); }
        else {
            var decompressor;
            try { decompressor = new DecompressionStream('deflate-raw'); }
            catch (_) { fail('This browser cannot safely read compressed XLSX files. Use a current browser, TXT or CSV.'); }
            var reader = new Blob([bytes.subarray(start, finish)]).stream().pipeThrough(decompressor).getReader(), actual = 0;
            try { while (true) { var part = await reader.read(); if (part.done) break; actual += part.value.length; if (actual > size || actual > MAX_EXPANDED) { await reader.cancel(); fail('The workbook expands beyond its declared safe size.'); } } }
            finally { reader.releaseLock(); }
            if (actual !== size) fail('The workbook archive has invalid sizes.');
        }
        offset += 46 + length + extra + comment;
    }
    if (!names.has('[Content_Types].xml') || !names.has('xl/workbook.xml')) fail('This ZIP file is not an XLSX workbook.');
}
function csvRows(text) {
    // RFC-style quoted field state machine; no split-on-comma parsing. The likely
    // delimiter is chosen outside quotes, accommodating common semicolon/tab exports.
    var counts = { ',': 0, ';': 0, '\t': 0 }, quoted = false;
    for (var i = 0; i < text.length; i++) { var ch = text[i]; if (ch === '"') { if (quoted && text[i + 1] === '"') i++; else quoted = !quoted; } else if (!quoted && ch in counts) counts[ch]++; if (!quoted && (ch === '\n' || ch === '\r')) break; }
    var delimiter = Object.keys(counts).sort((a,b) => counts[b] - counts[a])[0];
    var rows = [], row = [], field = '', inQuote = false, afterQuote = false;
    function cell() { row.push(field); field = ''; afterQuote = false; if (row.length > MAX_COLS) fail('Roster files may contain at most 20 columns.'); }
    function line() { cell(); rows.push(row); row = []; if (rows.length > MAX_ROWS) fail('Roster files may contain at most 1000 players plus a short header.'); }
    for (var n = 0; n < text.length; n++) {
        var c = text[n];
        if (inQuote) { if (c === '"') { if (text[n + 1] === '"') { field += '"'; n++; } else { inQuote = false; afterQuote = true; } } else field += c; }
        else if (c === '"') { if (field.trim() || afterQuote) fail('A CSV quote is misplaced.'); field = ''; inQuote = true; }
        else if (c === delimiter) cell();
        else if (c === '\n' || c === '\r') { if (c === '\r' && text[n + 1] === '\n') n++; line(); }
        else { if (afterQuote && !/\s/.test(c)) fail('Unexpected text follows a quoted CSV value.'); if (!afterQuote) field += c; }
        if (field.length > 10000) fail('A roster cell is too long.');
    }
    if (inQuote) fail('A quoted CSV field is not closed.');
    if (field || row.length || afterQuote) line();
    return rows;
}
function grid(name) {
    var book = XLSX.read(source, { type: 'array', sheets: [name], sheetRows: MAX_ROWS + 1, sheetStubs: true, cellFormula: true, cellHTML: false, bookVBA: false, bookDeps: false, WTF: true });
    var sheet = book.Sheets[name], rows = [], invalid = {}, types = {};
    if (!sheet || !sheet['!ref']) return { rows: [], invalid: {}, types: {} };
    var range = XLSX.utils.decode_range(sheet['!fullref'] || sheet['!ref']);
    if (range.e.r >= MAX_ROWS || range.e.c >= MAX_COLS) fail('The selected sheet exceeds 1024 rows or 20 columns. Select a smaller roster sheet.');
    for (var r = 0; r <= range.e.r; r++) {
        var row = [];
        for (var c = 0; c <= range.e.c; c++) {
            var cell = sheet[XLSX.utils.encode_cell({ r:r, c:c })], key = r + ':' + c;
            if (cell) {
                types[key] = cell.t;
                if (cell.t === 'e' || cell.f && (cell.v === undefined || cell.v === null)) invalid[key] = 'This mapped cell has an error or a formula without a cached result.';
            }
            row.push(cell && cell.v !== undefined ? String(cell.w !== undefined ? cell.w : cell.v) : '');
        }
        rows.push(row);
    }
    return { rows: rows, invalid: invalid, types: types };
}
function bounded(result) {
    result.invalid=result.invalid||{};
    result.rows.forEach((row,r)=>row.forEach((value,c)=>{if(value.length>512){row[c]=value.slice(0,512)+'…';result.invalid[r+':'+c]='This cell exceeds the 512 character safety limit.';}}));
    return result;
}
self.onmessage = async function (event) {
    var request = event.data;
    try {
        if (request.buffer) {
            var bytes = new Uint8Array(request.buffer); kind = String(request.extension).toLowerCase();
            if (!bytes.length) fail('The selected file is empty.');
            if (bytes.length > MAX_FILE) fail('Choose a roster file no larger than 2 MB.');
            if (!['txt','csv','xlsx','xls'].includes(kind)) fail('Choose a TXT, CSV, XLSX or XLS file.');
            if (kind === 'txt' || kind === 'csv') {
                var text = decode(bytes);
                if (/\0|^\s*(<\?xml|<!doctype|<html|PK\x03\x04)/i.test(text) || [208,207,17,224,161,177,26,225].every((n,i)=>bytes[i]===n)) fail('The file contents do not match a text roster.');
                var rows = kind === 'txt' ? text.split(/\r\n|\n|\r/).map(line => [line]) : csvRows(text);
                if (rows.length > MAX_ROWS) fail('Roster files may contain at most 1000 players plus a short header.');
                if (!rows.some(row => row.some(cell => cell.trim()))) fail('The selected file contains no roster entries.');
                self.postMessage(bounded({ id:request.id, sheets:[], rows:rows, invalid:{}, types:{}, kind:kind })); return;
            }
            if (kind === 'xlsx') { if (bytes[0] !== 80 || bytes[1] !== 75) fail('The contents do not match an XLSX workbook.'); await validateZip(bytes); }
            else { if (![208,207,17,224,161,177,26,225].every((n,i) => bytes[i] === n)) fail('Use a binary Excel XLS workbook; HTML/XML files renamed XLS are not supported.'); validateOle(bytes); }
            source = request.buffer;
            sheetNames = XLSX.read(source, { type:'array', bookSheets:true, bookVBA:false, cellHTML:false, WTF:true }).SheetNames;
            if (!sheetNames || !sheetNames.length || sheetNames.length > 32) fail('Use a workbook with between 1 and 32 worksheets.');
        }
        var selected = request.sheet || sheetNames[0];
        if (sheetNames.indexOf(selected) < 0) fail('Choose an available worksheet.');
        self.postMessage(bounded(Object.assign({ id:request.id, sheets:sheetNames, sheet:selected, kind:kind }, grid(selected))));
    } catch (error) { self.postMessage({ id:request.id, error:error.message && error.message.length < 250 ? error.message : 'The file could not be parsed. Save a clean roster copy and try again.' }); }
};
