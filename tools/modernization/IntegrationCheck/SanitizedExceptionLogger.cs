using System;
using System.IO;
using Microsoft.Extensions.Logging;
using Microsoft.Data.SqlClient;

// Diagnostics for the local test host: never format messages, SQL values, request bodies or cookies.
internal sealed class SanitizedExceptionLogger : ILoggerProvider
{
 readonly string file;readonly object gate=new();
 public SanitizedExceptionLogger(string file){this.file=file;}
 public ILogger CreateLogger(string category)=>new Recorder(this,category);
 public void Dispose(){}
 sealed class Recorder : ILogger {
  readonly SanitizedExceptionLogger owner;readonly string category;
  public Recorder(SanitizedExceptionLogger owner,string category){this.owner=owner;this.category=category;}
  public IDisposable BeginScope<TState>(TState state) where TState:notnull=>null;
  public bool IsEnabled(LogLevel level)=>level>=LogLevel.Error;
  public void Log<TState>(LogLevel level,EventId id,TState state,Exception error,Func<TState,Exception,string> formatter){
   if(!IsEnabled(level)||error==null)return;
   lock(owner.gate)using(var writer=File.AppendText(owner.file)){
    writer.WriteLine(category+" event="+id.Id);
    for(var current=error;current!=null;current=current.InnerException){writer.WriteLine(current.GetType().FullName);if(current is SqlException sql)writer.WriteLine("SQL error number="+sql.Number);writer.WriteLine(current.StackTrace);}
   }
  }
 }
}
