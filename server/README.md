# Partner sync server

A small Cloudflare Worker that lets two phones share the kitchen (week plan, grocery list, saved
recipes), workout summaries and high-fives. **It only ever sees ciphertext.** Not deployed yet.

## Design

- **Storage: one SQLite-backed Durable Object per household.** Each household is tiny and only its
  two phones touch it, so one object per household serializes every write (a strictly increasing
  version counter for "changes since N" with no races), needs no cross-household queries, and
  SQLite-backed Durable Objects are available on the Workers free plan. D1 would put every household
  in one shared database and need its own locking for the version counter.
- **What the server stores:** per household, the SHA-256 of the household secret, up to two random
  member ids, and rows of `{ record id, version, timestamp, size, ciphertext }`. The record id is an
  HMAC of the record's type and id, so it reveals neither.
- **Encryption (in the app, `src/lib/partner/crypto.ts`):** the phone that creates the household
  makes a random 256-bit root key. HKDF-SHA-256 derives an AES-256-GCM key and an HMAC key from it.
  Every record is encrypted with a fresh 96-bit IV; the AAD binds household id, record id (the HMAC
  of type + id) and timestamp. The root key travels only inside the link code (QR / pasted), which
  sits in the URL fragment and is never sent to any server.
- **Auth:** a separate random 256-bit household secret, sent as `Authorization: Bearer`. The server
  keeps only its hash and compares in constant time. The key cannot be derived from anything the
  server holds. Requests also carry `X-Member`; at most two members per household.
- **Merging:** last writer wins per record by the client's timestamp; the server never replaces a
  record with an older one. Deletions are encrypted tombstones; tombstones older than 30 days are
  purged and a client whose cursor is behind the purge is told to resync from the start.
- **Limits** (`src/limits.ts`): 512 KB per request, 64 KB per record, 200 records per push,
  5,000 records and 20 MB per household, 120-request burst refilling 2/s per household, 10 new
  households per IP per minute (best effort, per isolate). No request bodies, secrets or ciphertext
  are logged.
- **Unlink** deletes every record and member; the id stays as "closed" so the other phone gets
  `410` and stops sharing.
- **CORS:** only origins in `ALLOWED_ORIGINS` (`wrangler.jsonc`): the web app, and
  `https://localhost` / `capacitor://localhost` for the Android app's WebView.

## Develop and test (local only)

```bash
cd server
npm install
npm test            # Vitest in workerd via @cloudflare/vitest-pool-workers (Miniflare)
npm run typecheck   # regenerates worker-configuration.d.ts, then tsc
npm run dev         # wrangler dev --local on http://127.0.0.1:8787
```

For a local end-to-end run with the web app:

```bash
npx wrangler dev --local --port 8787 --var "ALLOWED_ORIGINS:http://localhost:4173"
# in the repo root:
VITE_SYNC_URL=http://127.0.0.1:8787 npx vite build && npx vite preview --port 4173
```

None of this needs a Cloudflare account.

## Deploy (later, once the Cloudflare account exists)

1. `cd server && npx wrangler login` (log in to **the account meant for this app**).
2. Optional: change `name` in `wrangler.jsonc` (it becomes part of the URL).
3. `npx wrangler deploy`. It prints the URL, e.g. `https://righttrack-sync.<subdomain>.workers.dev`.
4. Check it: `curl https://righttrack-sync.<subdomain>.workers.dev/v1/health` gives `{"ok":true}`.
5. If the web app moves off `https://joshdougherty12.github.io`, update `ALLOWED_ORIGINS` and deploy again.

Then point the apps at it:

- **Web app (GitHub Pages):** GitHub → repo `gym-app` → Settings → Secrets and variables → Actions →
  **Variables** → New repository variable `VITE_SYNC_URL` = the Worker URL (no trailing slash).
  Re-run the "Test and deploy" workflow (or push). The deploy workflow passes it to `npm run build`.
- **Android app:** build with the variable set, e.g. in Git Bash from the repo root:
  `VITE_SYNC_URL=https://righttrack-sync.<subdomain>.workers.dev npm run build:android`, then
  `./gradlew.bat assembleRelease` in `android/`. (Or put `VITE_SYNC_URL=...` in a gitignored
  `.env.production.local` in the repo root so every build picks it up.)

Free-plan note: Workers free allows 100,000 requests a day. Two phones syncing every 30 s while the
app is open use a few thousand.
