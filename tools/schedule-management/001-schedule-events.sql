-- Additive migration. Review/run separately for production; never deletes existing data.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID(N'dbo.LeagueScheduleEvent',N'U') IS NULL
BEGIN
 CREATE TABLE dbo.LeagueScheduleEvent (
  Id int IDENTITY(1,1) NOT NULL CONSTRAINT PK_LeagueScheduleEvent PRIMARY KEY,
  LeagueId int NOT NULL, WeekNumber int NOT NULL, [Date] datetime2 NOT NULL,
  Title nvarchar(200) NOT NULL, EventType nvarchar(30) NOT NULL, DivisionKey nvarchar(200) NULL,
  CONSTRAINT FK_LeagueScheduleEvent_League FOREIGN KEY (LeagueId) REFERENCES dbo.LeagueType(ID),
  CONSTRAINT CK_LeagueScheduleEvent_Week CHECK (WeekNumber BETWEEN 1 AND 104)
 );
 CREATE INDEX IX_LeagueScheduleEvent_LeagueDate ON dbo.LeagueScheduleEvent(LeagueId,[Date]);
END;
COMMIT;
