# Troubleshooting

## "502 Bad Gateway" errors in the frontend

The frontend makes REST calls against the backend through the base URL that is
computed from `REACT_APP_API_BASE_URL`. When this variable is not supplied, the
hooks such as `useSystemStats` fall back to `/api`, relying on the React dev
server (or nginx in production) to proxy calls to the backend service. If the
backend is not reachable you will see repeated messages similar to:

```
GET http://192.168.56.1:3000/api/system/stats 502 (Bad Gateway)
```

and Socket.IO will try to connect to `backend:8001`, resulting in
`net::ERR_NAME_NOT_RESOLVED` when the hostname cannot be resolved from your
machine.

### How to fix it

1. **Start the backend** – run `uvicorn main:app --reload --port 8001` (or use
   `docker compose up`) so the proxy has a target to forward traffic to.
2. **Set `REACT_APP_API_BASE_URL` / `REACT_APP_WS_URL` explicitly** when the
   backend runs on a different host or when the service name `backend` is not
   resolvable from your browser. Use the address that is reachable from the
   machine loading the UI (for example `http://192.168.56.1:8001/api` when you
   access the dashboard through `http://192.168.56.1:3000`). Example:

   ```bash
   REACT_APP_API_BASE_URL=http://localhost:8001/api \
   REACT_APP_WS_URL=http://localhost:8001 npm run dev
   ```

3. **Confirm the backend container is healthy** – run `docker compose ps` and
   `docker compose logs backend` to ensure the API started without runtime
   errors. A failing backend container causes the frontend proxy to respond with
   502 errors even though the UI is running.
4. **Expose the backend to your network** if you access the frontend from a
   remote device. Update the backend's `CORS_ORIGINS` to include the host of the
   frontend (for example `http://192.168.56.1:3000`).

After the backend is reachable through the configured URLs, the 502 and Socket.IO
connection errors disappear and the activity history loads normally.

## `/usr/bin/env: 'bash\r'` when starting Docker containers

This error indicates that a shell script inside the container was checked into
Git with Windows (CRLF) line endings. When Docker copies the script into a Linux
image the `\r` characters prevent `/usr/bin/env` from locating `bash`.

### How to fix it

1. **Update your local checkout** – run `git pull` to fetch the `.gitattributes`
   file introduced in this repository. It enforces LF endings for shell
   scripts, Dockerfiles, and nginx templates so future checkouts are
   automatically normalized.
2. **Re-clone if necessary** – if the file is still using CRLF endings, delete
   the affected script (for example `frontend/nginx.conf.template`) and restore
   it via `git checkout -- <path>` so Git re-creates it with Unix line endings.
3. **Verify Docker Desktop settings** – ensure "Use Docker Compose V2" is
   enabled and rerun `docker compose up --build` so the corrected files are
   baked into the images.

After the scripts use LF endings the containers start normally and nginx no
longer aborts with the `bash\r` message.
