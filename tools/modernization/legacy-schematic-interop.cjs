// Migration-process adapter only: Angular CLI 8 otherwise downloads today's
// latest CLI before running historical migrations, which cannot run on Node 10.
// Keep its official migration/peer checks intact and use the selected local CLI.
const path=require('path'),front=path.resolve(__dirname,"../../Allport's League Scrambler/ClientApp");
// Match the CLI bootstrap order before loading DevKit/RxJS through this adapter.
require(require.resolve('symbol-observable',{paths:[front]}));
for(const parent of ['@angular/material','@angular/cdk','@angular-devkit/core']){
 try{const chalk=require(require.resolve('chalk',{paths:[path.join(front,'node_modules',parent)]}));if(!chalk.default)Object.defineProperty(chalk,'default',{value:chalk});}catch(_){}
}
const pkg=require(path.join(front,'node_modules/@angular/cli/package.json'));
if(pkg.version.startsWith('8.'))require(path.join(front,'node_modules/@angular/cli/commands/update-impl')).UpdateCommand.prototype.checkCLILatestVersion=async()=>false;
