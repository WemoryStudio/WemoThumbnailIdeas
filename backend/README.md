# WEMORY backend

Node.js + Express + PostgreSQL API for the WEMORY Thumbnail Ideas app. It:

- Handles user accounts (register/login) so boards belong to a real user, not just a browser.
- Stores boards and saved thumbnails in a real database (Postgres), so they survive across
  devices and browser cache clears.
- Holds the YouTube Data API key(s) on the server only, and proxies searches through
  `/api/youtube/search` so the key is never visible in the browser.

## Run it locally

1. Install dependencies:
   ```
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in the values (see comments in that file for where
   to get each one - a free Postgres DB from https://neon.tech, and a YouTube Data API v3 key
   from Google Cloud Console).
3. Start the server:
   ```
   npm run dev
   ```
   It will print `WEMORY backend listening on port 3000`. The first time it runs it also
   creates all the database tables automatically.

## Try it out with curl

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"me@example.com","password":"hunter22"}'
# -> copy the "token" from the response

TOKEN=paste-the-token-here

# Search YouTube (key never leaves the server)
curl "http://localhost:3000/api/youtube/search?q=missing+person&order=relevance&time=any&hideShorts=true" \
  -H "Authorization: Bearer $TOKEN"

# Create a board
curl -X POST http://localhost:3000/api/boards \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"True crime ideas"}'

# Save a thumbnail into board id 1
curl -X POST http://localhost:3000/api/boards/1/items \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"videoId":"dQw4w9WgXcQ","title":"Example","channelTitle":"Example Channel"}'

# List everything you've saved
curl http://localhost:3000/api/items -H "Authorization: Bearer $TOKEN"
```

## Deploy it online (free)

1. **Database**: create a free Postgres database at https://neon.tech, copy its connection
   string (looks like `postgresql://user:pass@host/db?sslmode=require`).
2. **Code**: push this `backend/` folder to a GitHub repository.
3. **Server**: create a free "Web Service" at https://render.com pointing at that repo.
   - Build command: `npm install`
   - Start command: `npm start`
   - Add environment variables in Render's dashboard: `DATABASE_URL` (from step 1),
     `JWT_SECRET` (any long random string), `YT_API_KEY_1` (and optionally `_2`/`_3`).
4. Render will give you a public URL like `https://wemory-backend.onrender.com`. That's the
   base URL the frontend will call in Stage 2.

Note: Render's free tier spins the server down after inactivity, so the first request after
a quiet period can take ~30-50 seconds to wake back up - that's normal, not a bug.
