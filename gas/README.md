# Discord AI GAS Bridge (read-only)

## Setup
1. Create a standalone Apps Script project.
2. Copy all `.gs` files in this folder into the project (same filenames); enable manifest view and copy `appsscript.json`.
3. In Project Settings > Script Properties, set `GAS_SHARED_SECRET` to the exact secret Worker connection uses.
4. Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone. The endpoint is public, but every POST is HMAC-authenticated. Do not share the secret.
5. Copy the /exec URL into Discord AI's GAS connection flow.
6. Authorize the requested read-only Google scopes.
7. Test with the connection's ping/test feature.

## Actions currently implemented
- `system.ping`
- `sheets.read`, `sheets.search`, `sheets.info`
- `drive.search`, `drive.info`, `drive.read`
- `calendar.list`, `calendar.search`

This project intentionally does not implement write actions, arbitrary script execution, or destructive operations.

## Notes
- Sheets read uses the A1 range supplied by the caller. Search is capped at 100,000 scanned cells and 200 matches.
- Drive read supports Google Docs, Google Sheets, plain text, CSV, and JSON only. Other file types are rejected.
- Calendar queries default to a bounded period and limit the returned events.
- CacheService stores used nonces for 10 minutes; requests must be within 5 minutes of server time.
- If you change code after deployment, deploy a new version of the Web App (Manage deployments > Edit > New version).
