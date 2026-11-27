# Shared facilities

The public directory is available at `/facilities`. A facility detail and its public event detail pages use the existing Pickup venue ID. Organizers can select a primary facility during League or Tournament creation and change it later in League Management or Tournament Details. Locations are optional. The separate **List this event publicly at the facility** setting defaults to off.

## Database

Back up `LeagueScramblerDev` with `COPY_ONLY, CHECKSUM` and verify the backup before running `004-FacilityDirectory.sql`. It adds one metadata record per `PickupVenue` and one optional facility assignment per `LeagueType`. It leaves existing Pickup relationships, event details, memberships, rounds and scores in place. Apply the schema before running builds that reference the directory tables. The SQL migration is also required by the disposable fixture database if it was created before these tables were added.

`Import-UltimateSportsCenter.sql` targets Development only. It reconciles a matching address, known name and ZIP, or source identifier under a transaction. It stops on multiple matches and does not assign existing events. For the initial Development import, it reused venue ID 6. The [facility website](https://theultimatesportscenter.com/) identifies the address and activities. The [U.S. Census Geocoder](https://www.census.gov/data/developers/data-sets/Geocoding-services.html) supplied an approximate TIGER/Line address-range estimate. GeoNames locality and radius rules are shared with Pickup.

## Reviewed imports and inquiries

Administrators can review and save a facility manually or use the optional `FacilityLookup:OverpassEndpoint` HTTPS configuration to query an approved Overpass endpoint. A lookup is region-bounded and rate-limited. Candidate tags are leads to review. Enter only verified activities and check the address, coordinates and time zone before saving. The directory retains source information and displays OpenStreetMap attribution for records from that provider. Review [Overpass usage](https://wiki.openstreetmap.org/wiki/Overpass_API) and the [OpenStreetMap license](https://www.openstreetmap.org/copyright) for the chosen service and any redistributed data.

Public league listings can accept an inquiry without creating membership. Routing prefers a current assigned Manager, then a current assigned Admin, in account ID order. An explicitly designated Admin may receive inquiries when no eligible assigned person can receive them. The public response contains no recipient address. There is no implicit site Admin or support mailbox fallback.

Inquiries require a valid reply address, use a plain-text message, and are limited to three attempts per source IP per hour. The existing transactional mail configuration determines delivery. Development writes to its local mail directory. Production requires authenticated SMTP and a permitted sender. Acceptance means the transport accepted the message.

Run the focused Development regression with `node tests/functional/scripts/facilities.cjs` after building Angular and .NET Release. It uses the disposable test host and database and verifies local mail copies for recipient routing.

## Duplicate review

Apply `005-FacilityIdentity.sql` after the directory migration and a verified database backup. It adds a filtered unique key for complete name and address identities, a unique provider identifier registry, and the facility merge audit. Legacy venue records keep their IDs and receive canonical keys when their identities are reviewed and saved. A shared SQL transaction lock serializes application writes that create, edit, attach, or merge facilities.

Facility editors and the Pickup form offer matches as the user enters identity details. A verified provider identifier or a complete normalized name and address blocks duplicate creation. Incomplete identity, shared addresses and reliable nearby coordinates may require review. Coordinates tagged approximate cannot establish identity. Administrators can confirm separate businesses or add verified missing details to an existing facility. The public directory and an organizer's own sessions determine which candidates a regular account may see.

Open **Review Possible Duplicate Facilities** as an administrator to see matching pairs and affected events. Select the permanent ID and enter the exact typed confirmation before merging. The operation moves Pickup Session, League, Tournament and provider references and saves the retired record and metadata in the audit. Pickup registrations and Game Sets retain their parent session IDs.

The Development audit identified possible matches between venue 3 (USC, Roseville, street and ZIP unspecified, two cancelled Pickup sessions) and venue 6 (The Ultimate Sports Center, 31950 Little Mack Avenue, Roseville, MI 48066, one Pickup session marked In Progress). The two USC records 3 and 4 share a short name but have incomplete or conflicting location evidence. Venue 4 has ZIP 48310 and one cancelled Pickup session. None have League or Tournament associations. These are review candidates and were left intact.

Run the duplicate workflow test with `node tests/functional/scripts/facility-identity.cjs`. Creation, fixture data changes and the merge exercise run only in the disposable test database.
