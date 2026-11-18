using System;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
namespace Allport_s_League_Scrambler.Data
{
 public static class AttendanceSerialization
 {
  // Shared by kiosk and self-service inserts. Transaction-owned; no schema changes.
  public static Task Acquire(DataContext context,int leagueId,DateTime date) {
   var resource="LeagueScrambler:Attendance:"+leagueId+":"+date.ToString("yyyyMMdd",System.Globalization.CultureInfo.InvariantCulture);
   return context.Database.ExecuteSqlCommandAsync("DECLARE @r int; EXEC @r=sys.sp_getapplock @Resource={0}, @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=10000; IF @r<0 THROW 51000, 'Attendance is busy. Please retry.', 1;",resource);
  }
 }
}
