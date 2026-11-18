using System;
namespace Allport_s_League_Scrambler.Security
{
 public static class AttendanceRules
 {
  public static DateTime EasternNow(DateTime utcNow) {
   TimeZoneInfo zone;
   try { zone=TimeZoneInfo.FindSystemTimeZoneById("Eastern Standard Time"); }
   catch(TimeZoneNotFoundException) { zone=TimeZoneInfo.FindSystemTimeZoneById("America/New_York"); }
   return TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utcNow,DateTimeKind.Utc),zone);
  }
  public static string UnavailableReason(bool member,bool locked,string configuredDay,DateTime easternNow) {
   if(!member)return "This player does not belong to the selected league.";
   if(locked)return "An administrator has locked league night sign in.";
   DayOfWeek day;
   if(string.IsNullOrWhiteSpace(configuredDay)||!Enum.TryParse(configuredDay,true,out day)||!string.Equals(Enum.GetName(typeof(DayOfWeek),day),configuredDay,StringComparison.OrdinalIgnoreCase))return "The league day has not been configured.";
   if(day!=easternNow.DayOfWeek)return "Sign in is available on "+day+" only.";
   return null;
  }
 }
}
