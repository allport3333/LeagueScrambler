const fs = require('node:fs');
class SummaryReporter {
  constructor(options={}){this.reportRoot=options.reportRoot||'artifacts';}
  onBegin() { this.rows = []; }
  onTestEnd(test, result) {
    const blocked = test.annotations.find(a => a.type === 'blocked');
    const isolation = test.annotations.find(a => a.type === 'isolation');
    const errorDetail = (blocked ? blocked.description : (result.errors || []).map(e => e.message).join('; ')).replace(/\x1b\[[0-9;]*m/g,'');
    const status=result.status==='skipped' ? (blocked ? 'BLOCKED' : 'SKIPPED') : result.status==='timedOut' ? 'FAILED (timeout)' : result.status.toUpperCase();
    this.rows.push({ test: test.titlePath().join(' > '), status, reason: [isolation && isolation.description, errorDetail].filter(Boolean).join(' ') });
  }
  onEnd() {
    fs.mkdirSync('artifacts', { recursive: true });
    fs.appendFileSync('artifacts/history.jsonl', JSON.stringify({finishedAt:new Date().toISOString(),results:this.rows})+'\n');
    fs.mkdirSync(this.reportRoot,{recursive:true});
    fs.writeFileSync(this.reportRoot+'/summary.md', '# Functional test results\n\n| Test | Status | Detail |\n|---|---|---|\n' + this.rows.map(r => `| ${r.test.replace(/\|/g, '/')} | ${r.status} | ${r.reason.replace(/[\r\n|]/g, ' ')} |`).join('\n') + '\n');
  }
}
module.exports = SummaryReporter;
