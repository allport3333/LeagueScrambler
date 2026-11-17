param([switch]$ReadOnly)
$ErrorActionPreference='Stop'
try {
    if (-not $ReadOnly) {
        $authority=Get-Content -LiteralPath (Join-Path $PSScriptRoot '../.local/manual-process-approval.json') -Raw | ConvertFrom-Json
        if ([DateTime]::Parse($authority.expiresAt).ToUniversalTime() -le [DateTime]::UtcNow -or $authority.baseURL -cne 'https://localhost:5001' -or $authority.database -cne 'LeagueScramblerDev' -or $authority.authorizedScopes -notcontains 'development-regression') { throw 'Original development regression authority is absent or expired.' }
    }
    $identity=(& (Join-Path $PSScriptRoot 'process-identity.ps1') | ConvertFrom-Json)
    if (-not $identity.pid -or [IntPtr]::Size -ne 8) { throw 'Verified 64-bit localhost Debug process required.' }
    if (-not $ReadOnly) {
        foreach($field in 'pid','processStartUtc','projectDll','dllSha256','envSha256','launchProfileSha256') {
            if (-not $authority.identity.$field -or $authority.identity.$field -cne $identity.$field) { throw 'Testing authorization does not match the current process/configuration.' }
        }
    }
    # Read-only Windows APIs: no WriteProcessMemory, thread injection or SQL connection.
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class LocalDevEnvironmentReader {
  [StructLayout(LayoutKind.Sequential)] struct PBI {
    public IntPtr Reserved1, PebBaseAddress, Reserved2A, Reserved2B, UniqueProcessId, Reserved3;
  }
  [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr OpenProcess(uint access, bool inherit, int pid);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool ReadProcessMemory(IntPtr process, IntPtr address, byte[] buffer, int size, out IntPtr read);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool IsWow64Process(IntPtr process, out bool wow64);
  [DllImport("ntdll.dll")] static extern int NtQueryInformationProcess(IntPtr process, int infoClass, out PBI info, int length, out int returned);
  static byte[] Read(IntPtr process, long address, int length) {
    var buffer=new byte[length]; IntPtr count;
    bool ok=ReadProcessMemory(process,new IntPtr(address),buffer,length,out count);
    if (!ok && count.ToInt64()==0) throw new InvalidOperationException("Read-only process inspection unavailable.");
    if(count.ToInt64()!=length) Array.Resize(ref buffer,(int)count.ToInt64());
    return buffer;
  }
  public static string[] ReadApprovedSettings(int pid) {
    var process=OpenProcess(0x0400|0x0010,false,pid);
    if(process==IntPtr.Zero) throw new InvalidOperationException("Cannot open localhost process for read-only inspection.");
    try {
      bool wow64;if(!IsWow64Process(process,out wow64)||wow64) throw new InvalidOperationException("Expected native 64-bit process.");
      PBI info;int returned;
      if(NtQueryInformationProcess(process,0,out info,Marshal.SizeOf(typeof(PBI)),out returned)!=0) throw new InvalidOperationException("Process environment metadata unavailable.");
      long parameters=BitConverter.ToInt64(Read(process,info.PebBaseAddress.ToInt64()+0x20,8),0);
      long environment=BitConverter.ToInt64(Read(process,parameters+0x80,8),0);
      var text=new StringBuilder();bool complete=false;
      for(int offset=0;offset<131072;offset+=1024) {
        var block=Read(process,environment+offset,1024);
        text.Append(Encoding.Unicode.GetString(block));
        if(text.ToString().IndexOf("\0\0",StringComparison.Ordinal)>=0){complete=true;break;}
        if(block.Length!=1024) break;
      }
      if(!complete) throw new InvalidOperationException("Environment block could not be read completely.");
      string connection=null,mode=null;
      foreach(var entry in text.ToString().Split('\0')) {
        if(entry.StartsWith("LEAGUESCRAMBLER_DB_CONNECTION=",StringComparison.OrdinalIgnoreCase)) connection=entry.Substring("LEAGUESCRAMBLER_DB_CONNECTION=".Length);
        if(entry.StartsWith("ASPNETCORE_ENVIRONMENT=",StringComparison.OrdinalIgnoreCase)) mode=entry.Substring("ASPNETCORE_ENVIRONMENT=".Length);
      }
      return new[]{connection,mode};
    } finally {CloseHandle(process);}
  }
}
'@
    $settings=[LocalDevEnvironmentReader]::ReadApprovedSettings([int]$identity.pid)
    if ($settings[1] -cne 'Development' -or [string]::IsNullOrWhiteSpace($settings[0])) { throw 'Effective Development/SQL settings were not found.' }
    $builder=New-Object System.Data.SqlClient.SqlConnectionStringBuilder
    $builder.set_ConnectionString($settings[0])
    if ($builder.DataSource -cne 'localhost' -or $builder.InitialCatalog -cne 'LeagueScramblerDev' -or -not $builder.IntegratedSecurity) { throw 'Effective runtime database identity rejected.' }
    $after=(& (Join-Path $PSScriptRoot 'process-identity.ps1') | ConvertFrom-Json)
    foreach($field in 'pid','processStartUtc','projectDll','dllSha256','envSha256','launchProfileSha256') {
        if($identity.$field -cne $after.$field){throw 'Process/configuration changed during runtime verification.'}
    }
    if ($ReadOnly) {
        # Evidence is NOT authorization: no expiry/scopes, no update to either
        # mutation approval/proof file, and no claim of personal confirmation.
        $inspection=@{mode='runtime-inspection';effectiveRuntimeEnvironmentVerified=$true;mutationAuthorizationGranted=$false;baseURL='https://localhost:5001';server='localhost';database='LeagueScramblerDev';windowsAuthentication=$true;identity=$identity;verifiedAt=[DateTime]::UtcNow.ToString('o');automatedSessionCorrelationPassed=$false}
        $file=Join-Path $PSScriptRoot '../.local/runtime-process-inspection.json'
        [IO.File]::WriteAllText([IO.Path]::GetFullPath($file),($inspection|ConvertTo-Json -Depth 8),(New-Object Text.UTF8Encoding($false)))
        @{mode='runtime-inspection';pid=$identity.pid;processStartUtc=$identity.processStartUtc;server='localhost';database='LeagueScramblerDev';windowsAuthentication=$true;effectiveRuntimeEnvironmentVerified=$true;mutationAuthorizationGranted=$false;automatedSessionCorrelationPassed=$false} | ConvertTo-Json -Compress
        exit 0
    }
    $proof=@{mode='runtime-environment';effectiveRuntimeEnvironmentVerified=$true;baseURL='https://localhost:5001';server='localhost';database='LeagueScramblerDev';identity=$identity;verifiedAt=[DateTime]::UtcNow.ToString('o');expiresAt=$authority.expiresAt;authorizedScopes=@('milestone-one','development-regression');automatedSessionCorrelationPassed=$false}
    $file=Join-Path $PSScriptRoot '../.local/runtime-process-verification.json'
    [IO.File]::WriteAllText([IO.Path]::GetFullPath($file),($proof|ConvertTo-Json -Depth 8),(New-Object Text.UTF8Encoding($false)))
    @{mode='runtime-environment';pid=$identity.pid;database='LeagueScramblerDev';effectiveRuntimeEnvironmentVerified=$true;automatedSessionCorrelationPassed=$false;expiresAt=$authority.expiresAt} | ConvertTo-Json -Compress
} catch {
    [Console]::Error.WriteLine('Runtime target verification failed ('+$_.Exception.GetType().Name+'). No connection string or process environment values are logged.')
    exit 1
}
