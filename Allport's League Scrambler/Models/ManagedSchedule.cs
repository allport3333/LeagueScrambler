using System;
using System.Collections.Generic;
namespace Allport_s_League_Scrambler.Models {
 public class LeagueScheduleEvent {
  public int Id {get;set;} public int LeagueId {get;set;} public int WeekNumber {get;set;}
  public DateTime Date {get;set;} public string Title {get;set;} public string EventType {get;set;} public string DivisionKey {get;set;}
 }
 public class ManagedScheduleEntry {
  public int Id {get;set;} public string Kind {get;set;} public int WeekNumber {get;set;} public string Date {get;set;}
  public int Team1Id {get;set;} public int Team2Id {get;set;} public string Description {get;set;}
  public string EventType {get;set;} public string DivisionKey {get;set;}
 }
 public class ScheduleCrossRule {
  public string Division1 {get;set;} public string Division2 {get;set;} public int EveryWeeks {get;set;}
 }
 public class ManagedScheduleRequest {
  public string Revision {get;set;} public string Mode {get;set;} public int MaxGamesPerTeam {get;set;}=1;
  public bool AllowCrossDivision {get;set;} public List<ScheduleCrossRule> CrossRules {get;set;}=new List<ScheduleCrossRule>();
  public List<string> ReplaceDivisions {get;set;}=new List<string>();
  public List<int> DeleteGameIds {get;set;}=new List<int>();public List<int> DeleteEventIds {get;set;}=new List<int>();
  public List<ManagedScheduleEntry> Entries {get;set;}=new List<ManagedScheduleEntry>();
 }
}
