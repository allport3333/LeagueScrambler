SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
IF DB_NAME() <> N'LeagueScramblerDev' THROW 51000, 'This reviewed import targets LeagueScramblerDev only.', 1;
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
BEGIN TRANSACTION;

DECLARE @Key nvarchar(150) = N'theultimatesportscenter.com';
DECLARE @Candidates TABLE (VenueId int PRIMARY KEY);
INSERT @Candidates
SELECT v.Id FROM dbo.PickupVenue v
LEFT JOIN dbo.FacilityProfile p ON p.VenueId = v.Id
WHERE p.SourceKey = @Key OR (LEFT(v.PostalCode, 5) = N'48066' AND (
    UPPER(REPLACE(TRIM(v.Address), '.', '')) IN (N'31950 LITTLE MACK AVE', N'31950 LITTLE MACK AVENUE')
    OR (TRIM(v.Address) = N'' AND UPPER(TRIM(v.Name)) IN
        (N'ULTIMATE SPORTS CENTER', N'THE ULTIMATE SPORTS CENTER', N'ULTIMATE SPORTS CENTER & REDEMPTION BAR'))));
IF (SELECT COUNT(*) FROM @Candidates) > 1 THROW 51000, 'Multiple possible venues. Review their identities before importing.', 1;
DECLARE @VenueId int = (SELECT VenueId FROM @Candidates);
IF @VenueId IS NULL
BEGIN
    INSERT dbo.PickupVenue (Name, Address, City, Region, PostalCode, Country, TimeZone, Latitude, Longitude)
    VALUES (N'The Ultimate Sports Center', N'31950 Little Mack Avenue', N'Roseville', N'MI', N'48066',
            N'United States', N'America/Detroit', 42.531601529858, -82.90937114233);
    SET @VenueId = CONVERT(int, SCOPE_IDENTITY());
END
ELSE
BEGIN
    UPDATE dbo.PickupVenue SET Name = N'The Ultimate Sports Center', Address = N'31950 Little Mack Avenue',
        City = N'Roseville', Region = N'MI', PostalCode = N'48066', Country = N'United States',
        TimeZone = N'America/Detroit', Latitude = 42.531601529858, Longitude = -82.90937114233
    WHERE Id = @VenueId;
END;

IF NOT EXISTS (SELECT 1 FROM dbo.FacilityProfile WHERE VenueId = @VenueId)
    INSERT dbo.FacilityProfile (VenueId, VerifiedUtc, ApproximateCoordinates)
    VALUES (@VenueId, SYSUTCDATETIME(), 1);
UPDATE dbo.FacilityProfile SET AlternateName = N'Ultimate Sports Center & Redemption Bar',
    Website = N'https://theultimatesportscenter.com/', Activities = N'Wallyball|Racquetball|Batting Cages',
    Source = N'Facility website and U.S. Census Geocoder (TIGER/Line address range 110727090)',
    SourceKey = @Key, VerifiedUtc = SYSUTCDATETIME(), ApproximateCoordinates = 1
WHERE VenueId = @VenueId;
COMMIT TRANSACTION;
SELECT @VenueId AS FacilityId;
