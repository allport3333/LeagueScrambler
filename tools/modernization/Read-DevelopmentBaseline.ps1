param(
 [Parameter(Mandatory=$true)][string]$ConfigurationFile,
 [string]$OutputDirectory
)
$ErrorActionPreference='Stop'
if(!$OutputDirectory){$OutputDirectory=Join-Path $PSScriptRoot '../../tests/functional/artifacts/modernization/database-before'}
$root=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$line=[IO.File]::ReadLines((Resolve-Path -LiteralPath $ConfigurationFile).Path) | Where-Object {$_ -match '^LEAGUESCRAMBLER_DB_CONNECTION='} | Select-Object -First 1
if(!$line){throw 'A configured Development connection is required.'}
$value=$line.Substring($line.IndexOf('=')+1).Trim().Trim('"',"'")
$builder=New-Object System.Data.SqlClient.SqlConnectionStringBuilder $value
if($builder.DataSource -ne 'localhost' -or $builder.InitialCatalog -ne 'LeagueScramblerDev' -or !$builder.IntegratedSecurity -or $builder.UserID -or $builder.Password){throw 'Only localhost/LeagueScramblerDev with Windows authentication is permitted.'}
$connection=New-Object System.Data.SqlClient.SqlConnection $builder.ConnectionString
try{
 $connection.Open();$cmd=$connection.CreateCommand();$cmd.CommandText="SELECT DB_NAME(),CONVERT(nvarchar(128),SERVERPROPERTY('MachineName'))"
 $reader=$cmd.ExecuteReader();if(!$reader.Read() -or $reader.GetString(0) -ne 'LeagueScramblerDev' -or $reader.GetString(1) -ne $env:COMPUTERNAME){throw 'Development SQL identity mismatch.'};$reader.Close()
 $model=[IO.File]::ReadAllText((Join-Path $root "Allport's League Scrambler/Data/DataContext.cs"))
 $explicit=@{}
 foreach($mapping in [regex]::Matches($model,'Entity<([A-Za-z0-9_]+)>\(\)\.ToTable\("([A-Za-z0-9_]+)",\s*"([A-Za-z0-9_]+)"\)')){
  $explicit[$mapping.Groups[1].Value]=[pscustomobject]@{table=$mapping.Groups[2].Value;schema=$mapping.Groups[3].Value}
 }
 # EF convention mappings also matter: LeagueSchedule, LeagueTeamScore and
 # LeagueDivision do not use explicit ToTable calls in the legacy model.
 $tables=@(foreach($set in [regex]::Matches($model,'DbSet<([A-Za-z0-9_]+)>\s+([A-Za-z0-9_]+)')){
  if($explicit.ContainsKey($set.Groups[1].Value)){$explicit[$set.Groups[1].Value]}else{[pscustomobject]@{table=$set.Groups[2].Value;schema='dbo'}}
 })
 $results=@()
 foreach($mapping in $tables){
  $table=$mapping.table;$schema=$mapping.schema;$qualified='['+$schema+'].['+$table+']'
  $cmd.CommandText="SELECT c.name,ty.name type,c.max_length,c.is_nullable,ISNULL(ic.key_ordinal,0) key_ordinal FROM sys.tables t JOIN sys.schemas s ON t.schema_id=s.schema_id JOIN sys.columns c ON t.object_id=c.object_id JOIN sys.types ty ON c.user_type_id=ty.user_type_id LEFT JOIN sys.indexes i ON t.object_id=i.object_id AND i.is_primary_key=1 LEFT JOIN sys.index_columns ic ON i.object_id=ic.object_id AND i.index_id=ic.index_id AND c.column_id=ic.column_id WHERE s.name=@schema AND t.name=@table ORDER BY c.column_id"
  $cmd.Parameters.Clear();[void]$cmd.Parameters.AddWithValue('@schema',$schema);[void]$cmd.Parameters.AddWithValue('@table',$table);$reader=$cmd.ExecuteReader();$columns=@();while($reader.Read()){$columns += [pscustomobject]@{name=$reader.GetString(0);type=$reader.GetString(1);maxLength=$reader.GetInt16(2);nullable=$reader.GetBoolean(3);keyOrdinal=$reader.GetByte(4)}};$reader.Close();$cmd.Parameters.Clear()
  if(!$columns.Count){$results += [pscustomobject]@{table=$qualified;missing=$true};continue}
  $cmd.CommandText='SELECT COUNT_BIG(*) FROM '+$qualified;$count=[long]$cmd.ExecuteScalar()
  # Never read account credentials/admin password values. Only identity/role keys
  # from those tables are fingerprinted; other row data remains in memory only.
  $selected=if($table -in @('User','Password')){@($columns | Where-Object {$_.name -match '^(Id|UserId|UserRoleId|UserRolesId)$'})}else{$columns}
  $keys=@($columns | Where-Object keyOrdinal -gt 0 | Sort-Object keyOrdinal)
  $order=if($keys.Count){' ORDER BY '+(($keys | ForEach-Object {'['+$_.name+']'}) -join ',')}else{''}
  $names=($selected | ForEach-Object {'['+$_.name+']'}) -join ','
  $cmd.CommandText='SELECT '+$names+' FROM '+$qualified+$order+' FOR JSON PATH, INCLUDE_NULL_VALUES'
  $reader=$cmd.ExecuteReader();$json=New-Object Text.StringBuilder;while($reader.Read()){[void]$json.Append($reader.GetString(0))};$reader.Close()
  $sha=[Security.Cryptography.SHA256]::Create();try{$hash=([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($json.ToString())))).Replace('-','')}finally{$sha.Dispose()};$json=$null
  $results += [pscustomobject]@{table=$qualified;count=$count;sha256=$hash;fingerprintColumns=@($selected.name);columns=$columns}
 }
 New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
 $results | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $OutputDirectory 'mapped-tables.json')
 $cmd.CommandText="SELECT fk.name,OBJECT_SCHEMA_NAME(fk.parent_object_id),OBJECT_NAME(fk.parent_object_id),pc.name,OBJECT_SCHEMA_NAME(fk.referenced_object_id),OBJECT_NAME(fk.referenced_object_id),rc.name,fk.delete_referential_action_desc,fk.update_referential_action_desc,fk.is_disabled,fk.is_not_trusted FROM sys.foreign_keys fk JOIN sys.foreign_key_columns fc ON fc.constraint_object_id=fk.object_id JOIN sys.columns pc ON pc.object_id=fc.parent_object_id AND pc.column_id=fc.parent_column_id JOIN sys.columns rc ON rc.object_id=fc.referenced_object_id AND rc.column_id=fc.referenced_column_id ORDER BY fk.name,fc.constraint_column_id"
 $reader=$cmd.ExecuteReader();$relationships=@();while($reader.Read()){$relationships += [pscustomobject]@{name=$reader.GetString(0);schema=$reader.GetString(1);table=$reader.GetString(2);column=$reader.GetString(3);referencedSchema=$reader.GetString(4);referencedTable=$reader.GetString(5);referencedColumn=$reader.GetString(6);deleteAction=$reader.GetString(7);updateAction=$reader.GetString(8);disabled=$reader.GetBoolean(9);untrusted=$reader.GetBoolean(10)}};$reader.Close()
 $relationships | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $OutputDirectory 'relationships.json')
 [pscustomobject]@{server='localhost';database='LeagueScramblerDev';machine=$env:COMPUTERNAME;readOnly=$true;tables=$results.Count;missing=@($results | Where-Object missing).Count} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $OutputDirectory 'identity.json')
 Write-Output ('Read-only mapped baseline recorded for '+$results.Count+' tables; no credentials or row payloads saved.')
}catch{throw ('Read-only Development baseline failed ('+$_.Exception.GetType().Name+'). No writes were attempted.')}finally{if($connection){$connection.Dispose()};$value=$null;$builder=$null}
