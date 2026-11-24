SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID(N'dbo.TournamentRound', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.TournamentRound (
        LeagueId int NOT NULL,
        RoundNumber int NOT NULL,
        ScrambleNumber int NOT NULL,
        GamesPerMatchup int NOT NULL,
        GenerationJson nvarchar(max) NOT NULL,
        CONSTRAINT PK_TournamentRound PRIMARY KEY (LeagueId, RoundNumber),
        CONSTRAINT UQ_TournamentRound_Scramble UNIQUE (LeagueId, ScrambleNumber),
        CONSTRAINT FK_TournamentRound_Configuration FOREIGN KEY (LeagueId) REFERENCES dbo.TournamentConfiguration(LeagueId),
        CONSTRAINT CK_TournamentRound_Number CHECK (RoundNumber BETWEEN 1 AND 30),
        CONSTRAINT CK_TournamentRound_Games CHECK (GamesPerMatchup BETWEEN 1 AND 9),
        CONSTRAINT CK_TournamentRound_Generation CHECK (ISJSON(GenerationJson) = 1)
    );
END;
COMMIT TRANSACTION;
