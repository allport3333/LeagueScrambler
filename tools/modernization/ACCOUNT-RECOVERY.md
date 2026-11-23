# Account recovery Development runbook

## Workflow

- **Change Email** asks for the current password and sends a one-hour, single-use verification code to the new address. Verification must use the same account session. The change revokes old cookies, clears password reset tokens, and notifies the previous address.
- **Recover Existing Account** lets users select a public name-search result, with league context where available, and sends a one-hour code to the requested contact address. Verification gives the request seven days for review. Enter the new eight-digit code in the browser that submitted the request. Its pending step survives a reload in that tab. Earlier emails containing a request number and a hexadecimal code can still use the legacy entry option until their original expiry.
- **Recovery Review** is restricted to Application Administrators. Approvers must explicitly attest to independent ownership verification. Decision notes are optional and limited to 1,000 characters. Use an established offline contact or a trusted ownership record obtained independently of the request. A name, league membership, or control of the new address is insufficient. The reviewer cannot approve their own case.
- Approval rechecks the current ownership relationship and account version transactionally. It preserves the account and player IDs, clears reset tokens, revokes old sessions, and replaces the old password with an unguessable value. The recipient signs in after setting a password through Forgot Password. Rejection and expiry leave ownership unchanged. The decision and reviewer are retained for audit. Outbound decision notices use the existing SMTP transport and delivery failures are logged without address or token contents.

## Local Review diagnosis and verification

The Debug host on https://localhost:5001 returned HTTP 200 with the Angular HTML shell for both /api/account-recovery/review and a nonexistent recovery API path. A known login API returned JSON. The host was the earlier worktree Debug process, so the browser was trying to parse a fallback HTML response as a recovery request list. This result does not establish missing schema, SQL connectivity failure, or administrator authorization failure.

The rebuilt loopback host returned 401 for anonymous Review, 403 for authenticated Manager or Player Review, and 404 for an unknown API path. The browser distinguishes those outcomes from SQL/server errors and empty queues. Restart the local Visual Studio Debug host with this worktree after confirming the Development schema is present. Run the guarded scenario below for authenticated SQL acceptance.

The review list uses server-side Pending, Approved, Rejected and Expired filters with 30-result pages. The claim dialog has a separate scroll region for results. Name lookup returns public profile and league context only. Navigation can carry a chosen claimed profile in browser history state, and the recovery endpoint independently validates that target.

## Transactional email

The modernization project .env had no SMTP settings when inspected. The original worktree contained a Gmail submission host on port 587 with a configured credential pair, and its SMTP username did not match the sender hardcoded in both controllers. Current source still defaulted to network SMTP. Only the earlier isolated integration harness intentionally used pickup. Inherited settings in the existing Debug process and a live provider rejection were not confirmed.

Forgot Password, Account Recovery, Change Email, and decision notifications now share one transport. The startup log reports active mode, host presence, port, STARTTLS and authentication presence. Each attempt logs a correlation ID plus a safe failure type and SMTP status, or records SMTP acceptance or a local pickup write separately. No log contains the recipient, message body, credentials or token. The public recovery and reset responses remain conditional. An authenticated email change can report an unavailable transport directly.

### Branded multipart mail and short codes

Password reset, recovery verification, change-email verification and recovery decision notices share responsive table-based HTML with a plain-text alternative. The verification messages carry the code without an internal request number or tracking resources. A numeric keyboard and pasted codes are supported.

New issuance and resend require LEAGUESCRAMBLER_VERIFICATION_KEY, a stable Base64-encoded random 32-byte secret. Development already has a locally generated key in the ignored .env. Keep the value stable across restarts and across instances serving the same database. Provision a separate approved key before any future staging or production rollout. No migration is required. Do not rotate while codes are outstanding unless deliberately invalidating them.

### Local and deployment settings

- In the modernization project's ignored .env, preserve the existing Development SQL settings. Add the approved SMTP settings from the mailbox provider through that file or the process environment. Use SMTP_MODE=smtp, SMTP_SERVER, SMTP_PORT for STARTTLS submission, SMTP_USERNAME and SMTP_PASSWORD. SMTP_FROM can identify an authorized alternate sender. Otherwise the authenticated mailbox address is used.
- Configure LEAGUESCRAMBLER_PUBLIC_BASE_URL to the existing trusted public HTTPS origin, or explicitly use https://localhost:5001 only for a local Development reset journey. The existing HTML/plain reset template and token lifetime are preserved.
- Isolated Development and Staging capture requires SMTP_MODE=pickup and an existing absolute SMTP_PICKUP_DIRECTORY outside the site. Production rejects pickup. Configure production SMTP separately through its approved secret mechanism. No production configuration was changed.
- A rejected initial verification send clears the unused pending token when possible. Resend keeps the request ID, checks the account again, applies a one-minute cooldown and rate limits, and rotates the code. A rejected resend restores the previous unused code when possible.
- The verification screen opens immediately after submitting valid details. It shows the entered destination and one-hour expiry and supports resend or starting again. Session storage preserves the pending verification step on reload. Passwords, reviewer evidence and codes are not saved to browser storage. Requesters may supply short nonblank information. Approval still requires independent evidence.

### Development configuration restored

The approved legacy SMTP keys were copied to the ignored modernization project .env without changing the Development SQL settings. SMTP_MODE is smtp, the sender defaults to the authenticated mailbox, and the reset origin is https://localhost:5001. Startup now loads the content-root .env explicitly, preserving process-level overrides. An isolated application host loaded the copied settings and reported network delivery, port 587, STARTTLS and credentials present with no mail send.

The provider returned SMTP 235 after certificate-validated TLS 1.3 and authentication. No MAIL FROM, RCPT TO or DATA was issued. External message acceptance and independent inbox receipt are still unverified. The active Visual Studio Debug process was started before the settings were copied. Stop debugging and start the modernization project again under the interactive Windows account. Check the Startup transport line before sending a probe. The original Debug process was left running.

### Verify transport and recovery

Restart the local Debug host from this worktree after adding approved SMTP settings. The active host now resolves resend and rejected an empty request ID before SQL or mail, but still predates the current configuration and content-root load fix. For a live transport check, run the command below only with an explicitly approved test mailbox. The probe reads process settings and the modernization project .env, uses STARTTLS, sends no tokens and prints only a safe outcome and correlation ID. SMTP acceptance requires a separate inbox check for actual receipt.

```powershell
& .\tests\functional\.tools\dotnet10\dotnet.exe .\tests\functional\artifacts\modernization\net10-integration-bin\IntegrationCheck.dll --smtp-probe 'approved-test-mailbox@example.invalid'
```

Replace the placeholder before running. The real workflow acceptance still uses the guarded Development integration command below for synthetic accounts with local pickup, including resend, code rejection, approval, rejection, old-session revocation and password setup. Use a separately authorized mailbox-backed synthetic account to verify real end-to-end delivery. Do not trigger recovery of an existing member merely to test email.

## Claimed profile eligibility

The recovery lookup filters in SQL before sorting and paging. It requires one UsersPlayer row, an existing player and user, a supported account role, a nonblank email, and the credential shape used by the existing login code. League membership supplies context only. Multiple links for one player are treated as ambiguous, consistent with the existing approval guard. The baseline migration defines both foreign keys and indexes each lookup column separately without enforcing one link per player. This change leaves all records and schema intact.

A direct request for an existing but ineligible profile returns the existing generic acknowledgment and creates no request or email. Issuance, verification, and approval recheck the account association. The signed-in registration search still offers only profiles with no existing link as claimable. It offers contextual recovery only for eligible claimed exact matches.

## Read-only recovery search acceptance

The running Visual Studio host on localhost:5001 returned HTTP 200 text/html for the anonymous Chris lookup and for an unknown API route. The known leagues endpoint returned JSON. The Debug process predates the recovery route and the API fallback fix. Its response does not indicate a search SQL exception or an authorization challenge. Stop and restart that local Debug session from this worktree for browser acceptance under the interactive Windows account.

The rebuilt loopback test proves the public route accepts Chris without a cookie, returns JSON 503 when its isolated SQL connection is intentionally unavailable, rejects oversized page numbers, and returns 404 for unknown API paths. The guarded read-only mode below queries the verified local LeagueScramblerDev database without creating fixtures, testing email, or changing accounts. It calls the real anonymous endpoint, compares the Chris, Allport and Uwe pages against direct Development queries, validates case-insensitive results and the public response fields, and records aggregate results, round-trip timings, lookup indexes, orphaned and ambiguous link counts, unclaimed league members, and claimed profiles with multiple league memberships. The read-only mode does not require the recovery schema. The separate recovery integration mode below requires it.

```powershell
& .\tests\functional\.tools\node-v22.23.5-win-x64\node.exe tools/modernization/run-authorized.cjs authorized-recovery-search-01 --recovery-search
```

A passing run creates recovery-search-results.json with pass, anonymous and readOnly set to true. Use a new run name for retries. After the Debug host is restarted, open /account-recovery in an InPrivate session and confirm Chris renders results and a result is selectable. Use the separate synthetic recovery integration mode to test code verification and review. Do not submit a recovery request on a real existing account for testing.

## Persistence and rollback

The Development migration adds a version counter to dbo.User with a zero default and one request/audit table with indexes for account and email issuance windows. Existing cookies without a version are treated as version zero. The counter increments on email changes and password resets. New verification uses an eight-digit CSPRNG code with a request-bound HMAC-SHA-256 digest and a five-attempt counter in the existing TokenHash column. The code expires after one hour and is removed on consumption. A resend rotates the code and resets the attempt budget, subject to existing resend controls. Outstanding legacy SHA-256 digests remain verifiable until expiry or resend. Review submissions are cleared on decision. Issuing another request for the same account also clears token digests and free-text submissions on undecided requests expired for over 30 days.

The current source requires the migration before it can run against Development. From the modernization root, use your authorized Windows PowerShell session. The SQL guard checks the database and shared-memory transport. Both file operations use local SQL only.

```powershell
sqlcmd -S lpc:localhost -d LeagueScramblerDev -E -C -b -i tools/modernization/Apply-DevelopmentAccountRecovery.sql
& .\tests\functional\.tools\node-v22.23.5-win-x64\node.exe tools/modernization/run-authorized.cjs authorized-account-recovery-01 --recovery
```

Use a new run name for each attempt. Check the run's authorized-results.json for both pass and cleanupCompleted. The runner verifies its SQL target, runs Kestrel over loopback and uses local SMTP pickup. It tests verified and rejected requests, expiration, token replay, disabled approval without a proof attestation, role boundaries, account/identity persistence, old cookie and password rejection, login after recovery, and authenticated email change. In case of interruption, run the same name with --cleanup-recovery to recover the owned fixtures from its journal.

The Development rollback script removes the new schema only if all session versions are still zero. Do not blindly roll back if an account changed. Preserve the decision audit and arrange retirement of pre-change cookies before reverting the application and schema. Schema rollback cannot undo an account transfer or password change.

## Existing synthetic player journals

The sibling original worktree's tests/functional/artifacts/manifests directory has exact Test_csrfplayer journals. The journal IDs 64ce89c8350cd1feb53d6f81, 89e1c841a4ac251d85b7a11c and 7fc133c4bbe71d9c14e49d7b record Player IDs 7358, 7360 and 7388 respectively. Run the read-only script to check whether those exact rows and common relationships still exist.

```powershell
sqlcmd -S lpc:localhost -d LeagueScramblerDev -E -C -b -i tools/modernization/Inspect-JournaledCsrfPlayers.sql
```

No records were deleted. The diagnostic is not a deletion plan. It does not establish absence of all historical references or identify any unjournaled row.
