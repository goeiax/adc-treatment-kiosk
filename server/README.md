# Self-hosted server for the ADC kiosk

Runs `../layar-info-perawatan-adc.html` without claude.ai. The clinic display opens `https://<server>/#kiosk`, the marketing admin signs in at `https://<server>/#admin`, and videos, posters and page images are stored on the server.

The page file is not changed and stays the single source of the UI. On claude.ai it reaches its database, the signed-in user and the file store through `window.claude.use('db' | 'user' | 'assets')`. Here `shim.js` defines the same three namespaces over this server's HTTP API, and `server.js` sends the page wrapped as skeleton + shim + page, the way `harness/server.py` does for the local test harness.

| File | What it is |
| --- | --- |
| `server.js` | The whole backend. One file, no dependencies, Node 18 or newer. |
| `shim.js` | Browser side of the contract. Documents come back with sorted keys, as on claude.ai. |
| `migrate.js` | One-off import of the claude.ai data and the media files. |
| `export/live-2026-11-20/` | The artifact's database as exported on 20 Nov 2026 (44 documents). |
| `config.example.json` | Copy to `config.json` (not in git) and set the two passwords. |
| `test.js` | `npm test`: 34 checks of sign-in, access rules, live events, uploads. |

## Run it on this machine

```powershell
cd server
```

```powershell
node server.js init
```

```powershell
node migrate.js
```

```powershell
npm start
```

`init` writes `config.json` with an editor account (`marketing`) and a display account (`layar`), prints their random passwords once and stores only the hashes. To choose the passwords yourself, copy `config.example.json` to `config.json` and edit it instead. `migrate.js` fills `data/` from the export and `../media`. Then open `http://localhost:8080` (or the `port` in `config.json`).

To see both roles at once in one browser, open the admin at `http://localhost:<port>/#admin` and the screen at `http://127.0.0.1:<port>/#kiosk`. The two host names keep separate cookies.

## Accounts and access

| Role | Who | Reads | Writes |
| --- | --- | --- | --- |
| `editor` | Marketing admin | Everything | Everything, uploads and deletes files |
| `display` | The clinic screen | Everything | Only `heartTallies/*` (patient hearts) |

These are the rules the live artifact declares: root read for any signed-in account, write only for Editors, `heartTallies` writable by the screen's own account. `user.me()` returns `canEdit: true` only for an editor, so the display account sees the page's "no edit rights" notice on `#admin`.

- Accounts live in `config.json` under `users`. Each has `role`, `username`, `name` (shown in the change log) and either `password` (plain text) or `passwordHash`. Several editors are allowed.
- `node server.js hash <new password>` prints a hash to paste as `passwordHash`. Restart the service after editing the config. Changing a password signs that account out everywhere.
- Accounts can also come from the environment: `KIOSK_EDITOR_USER`, `KIOSK_EDITOR_PASSWORD` (or `KIOSK_EDITOR_PASSWORD_HASH`), `KIOSK_EDITOR_NAME`, and the same with `KIOSK_DISPLAY_`.
- The session is a signed cookie. An editor stays signed in for 30 days, the display for 400 days (the longest browsers allow). The cookie is renewed whenever the page loads or reconnects, so a screen that is in use never reaches its expiry.
- Sign out at `https://<server>/_auth/logout`.
- Eight wrong passwords from one address lock sign-in from that address for five minutes.

Other settings: `port`, `host` (keep `127.0.0.1` behind nginx), `dataDir`, `pageFile`, `secureCookies` (`"auto"` marks the cookie Secure when the proxy says the request came over HTTPS). `PORT`, `KIOSK_HOST`, `KIOSK_DATA`, `KIOSK_PAGE`, `KIOSK_CONFIG` and `KIOSK_SESSION_SECRET` override them. Relative paths in the config are resolved from the folder the config file is in.

## Where the data lives

Everything is under `dataDir` (`server/data` by default, `/var/lib/adc-kiosk` in the deployment below):

```
data/
  db/<collection>/<document id>.json   one file per document, keys sorted (treatments, promos, videos, pages,
                                       config/settings|log|trash|restore|hearts, published/live|history, versions/vN,
                                       heartTallies/<screen id>)
  assets/<asset id>                    the uploaded file itself (no extension)
  assets/<asset id>.json               its content type, size, upload time and uploader
  session-secret                       signs the cookies; deleting it signs everyone out
```

Uploads are capped at 20 MiB each, the same as on claude.ai, so the admin's own messages stay true. Accepted types are JPEG, PNG, WebP, GIF, AVIF, MP4, WebM, MOV, MP3, M4A and PDF.

### Backup and restore

The documents are a few hundred kilobytes and change with every edit. The assets are large and only grow. One archive a night covers both:

```bash
# /etc/cron.d/adc-kiosk-backup  (keeps 30 nights)
15 2 * * * root tar -czf /var/backups/adc-kiosk-$(date +\%F).tgz -C /var/lib adc-kiosk -C /etc adc-kiosk && find /var/backups -name 'adc-kiosk-*.tgz' -mtime +30 -delete
```

Copy the archives off the server as well (rsync, restic or the provider's snapshots). To restore: stop the service, unpack the archive over `/var/lib/adc-kiosk` and `/etc/adc-kiosk`, start the service. Every published version is also kept as `db/versions/vN.json`, and the admin can restore one from the review page.

## Migration from claude.ai

`node migrate.js` does two things and changes no document:

1. Copies every document from the export folder into `data/db/`.
2. Copies the videos, posters and doctor photos from `../media` into `data/assets/` under the asset ids the documents and the page already use. The id to file map is read from `../harness/server.py` (`BLOBS`). It then checks that every asset id referenced by a document or by the page has a file, and lists any that do not.

It refuses to run over an existing database. `--force` overwrites documents that share a path with the export and leaves the others alone. Options: `--export <folder or writes.json>`, `--media <folder>`, `--assets-dir <folder>`, `--data <folder>`.

### Files missing on a server that is already in use

If videos play but the doctor photos on the hearts page are empty boxes (or any other file from `../media` is missing), the files were not copied into `data/assets/` at the first import. Pull the repo and copy only the files:

```bash
cd /opt/adc-kiosk && sudo git pull
sudo KIOSK_CONFIG=/etc/adc-kiosk/config.json node /opt/adc-kiosk/server/migrate.js --assets-only
sudo chown -R kiosk:kiosk /var/lib/adc-kiosk/assets
```

`--assets-only` writes no document, so promos, treatments, pages, hearts and published versions edited on the server stay as they are. It copies each file the export or the page references that is not yet in `data/assets/` and reports any it has no source for. Reload the screen afterwards; the service does not need a restart. Do not use `--force` for this: it overwrites documents with the export.

### Exporting the live database

The export in `export/live-2026-11-20/` was read from the artifact `https://claude.ai/artifact/YaWie8hkPz4CsJd4XKUgj6` with Claude Code's ArtifactData tool, signed in as the artifact's owner. To take a fresh one, ask Claude Code:

> Export the kiosk artifact's database to `server/export/live-<today>`: ArtifactData `list` with `out_dir` for the collections `treatments`, `promos`, `videos`, `pages`, `config`, `published`, `versions` and `heartTallies`.

That writes `<collection>/<document id>.json`, which is the layout `migrate.js` reads. On 20 Nov 2026 the artifact held 31 treatments, 6 promos, 4 videos, `config/settings`, `config/log` and `published/live`, with no pages, versions or hearts.

### Assets added on claude.ai after this export

A video or photo uploaded on claude.ai after 20 Nov 2026 is not in `../media`. `migrate.js` names each missing id. Download it with Claude Code's Artifact tool (`action: read`, the artifact `url`, `path: <asset id>`, `out_dir: server/export/live-<date>/_assets`), which saves `<asset id>.<ext>`, then run `migrate.js` again with `--force`.

### Cut-over day

1. Deploy the server with the committed export and check it (steps below).
2. Stop editing on claude.ai. Take a fresh export, stop the service, move `/var/lib/adc-kiosk/db` aside, run `migrate.js --export <new folder>`, start the service.
3. Point the display at the new address and sign it in once.
4. Hearts given on the claude.ai screen come across in `heartTallies/` and keep counting in the totals. The display gets a new screen id on the new address, so the admin's Heart dokter tab shows the old and the new screen as two rows.

## Deploying on Ubuntu

Assumes Ubuntu 22.04 or 24.04, a DNS name pointing at the server (`kiosk.example.com` below) and ports 80 and 443 open.

```bash
# Node 22 LTS, nginx, certbot
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs nginx certbot python3-certbot-nginx git

# code, data and config
sudo useradd --system --home /var/lib/adc-kiosk --shell /usr/sbin/nologin kiosk
sudo git clone -b develop https://github.com/goeiax/adc-treatment-kiosk.git /opt/adc-kiosk
sudo mkdir -p /var/lib/adc-kiosk /etc/adc-kiosk
sudo cp /opt/adc-kiosk/server/config.example.json /etc/adc-kiosk/config.json
```

Edit `/etc/adc-kiosk/config.json`: set `"dataDir": "/var/lib/adc-kiosk"`, `"pageFile": "/opt/adc-kiosk/layar-info-perawatan-adc.html"`, and for each user replace `password` with a `passwordHash` from `node /opt/adc-kiosk/server/server.js hash '<password>'`. Then import the data and hand the folders to the service user:

```bash
sudo KIOSK_CONFIG=/etc/adc-kiosk/config.json node /opt/adc-kiosk/server/migrate.js
sudo chown -R kiosk:kiosk /var/lib/adc-kiosk
sudo chown root:kiosk /etc/adc-kiosk/config.json && sudo chmod 640 /etc/adc-kiosk/config.json
```

### One systemd service

`/etc/systemd/system/adc-kiosk.service`:

```ini
[Unit]
Description=ADC waiting-room kiosk
After=network.target

[Service]
User=kiosk
Group=kiosk
WorkingDirectory=/opt/adc-kiosk/server
Environment=KIOSK_CONFIG=/etc/adc-kiosk/config.json
ExecStart=/usr/bin/node /opt/adc-kiosk/server/server.js
Restart=always
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/var/lib/adc-kiosk

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now adc-kiosk
curl -s http://127.0.0.1:8080/_health     # {"ok":true}
journalctl -u adc-kiosk -f                # logs
```

### nginx in front, with HTTPS

`/etc/nginx/sites-available/adc-kiosk` (link it into `sites-enabled`):

```nginx
server {
    listen 80;
    server_name kiosk.example.com;

    client_max_body_size 25m;                 # uploads are capped at 20 MiB by the server

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $http_host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_request_buffering off;          # stream uploads straight to the server
    }

    location = /_api/events {                 # the live-update stream must not be buffered or timed out
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $http_host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_buffering off;
        proxy_read_timeout 1h;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/adc-kiosk /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d kiosk.example.com --redirect     # adds the certificate, the 443 server and the redirect
```

After certbot, add `http2 on;` (nginx 1.25+) or `listen 443 ssl http2;` to the 443 server. The admin holds one event stream per open tab, and HTTP/2 lifts the browser's limit of six connections per site.

Caddy does the same in a few lines, gets its own certificate and streams the event stream unbuffered by itself:

```
kiosk.example.com {
    request_body {
        max_size 25MB
    }
    reverse_proxy 127.0.0.1:8080
}
```

A server on the clinic LAN without a public name also works over plain `http://<lan address>:8080` (set `"host": "0.0.0.0"`). Sign-in then travels unencrypted on that network, so prefer HTTPS when the server can be reached from outside.

### Updating

```bash
cd /opt/adc-kiosk && sudo git pull
sudo systemctl restart adc-kiosk      # only needed when server.js changed
```

The page and the shim are re-read whenever their files change, so a new page version needs no restart. Screens pick it up on their next reload.

## The display PC

Chrome in kiosk mode, with its own profile folder so the sign-in cookie survives restarts:

```bat
"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --user-data-dir=C:\adc-kiosk-profile --autoplay-policy=no-user-gesture-required --disable-pinch --overscroll-history-navigation=0 --noerrdialogs --disable-session-crashed-bubble "https://kiosk.example.com/#kiosk"
```

1. First run: start that command without `--kiosk`, sign in with the **display** account (`layar`), confirm the screen saver plays, close Chrome. The cookie lasts 400 days and is renewed on every load.
2. Put the command in a `.bat` file in the Startup folder (`shell:startup`) so the screen comes up after a power cut. Chrome shows an error page and does not retry if the network is not ready yet, so let the script wait for the server first:

```bat
@echo off
:wait
curl -s -o NUL --max-time 5 https://kiosk.example.com/_health || (timeout /t 5 /nobreak >NUL & goto wait)
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --user-data-dir=C:\adc-kiosk-profile --autoplay-policy=no-user-gesture-required --disable-pinch --overscroll-history-navigation=0 --noerrdialogs --disable-session-crashed-bubble "https://kiosk.example.com/#kiosk"
```

3. Do not use Incognito or "clear cookies on exit" for that profile: either one signs the screen out.

While it runs, the screen follows `published/live` over the event stream, so a publish from the admin shows within a second and no reload is needed. If the connection drops, the screen keeps showing its last content, reconnects by itself and re-reads everything. If the screen ever shows the sign-in form, its cookie was lost: sign the display account in again.

## The marketing admin

Open `https://kiosk.example.com/#admin` in any browser and sign in with the **editor** account. Everything works as on claude.ai: edits are drafts, "Kirim ke tinjauan" queues a page, and **Tinjau & publikasikan** puts the selected changes on the screen as a numbered version. Sign out at `/_auth/logout` on a shared computer.

## What differs from claude.ai

- User ids are the `id` values from `config.json` (`marketing`, `layar`). Older log entries written on claude.ai carry claude.ai ids and show as "Staf".
- `isOwner` is always `false`; the admin shows the role as "Editor".
- The display account opening `#admin` gets the page's notice reworded by `shim.js`: it says to sign in with the admin account and adds a "Ganti akun" button to `/_auth/logout`. The page's own sentence points at the claude.ai Share menu, and the page file is left untouched, so claude.ai and `harness/` still show the original wording.
- The sign-in and sign-out pages are served by `server.js` in the page's brand tokens, with the logotype read from the page file.
- The page loads the Archivo fonts from Google Fonts, so the display needs internet access for the brand typeface (it falls back to a system font without it).
- One server process, files on local disk. That suits one clinic; it is not built to run as several instances behind a load balancer.

## Check after any change

```powershell
npm test
```

Then, as in the repo README: open `#tinjau`, publish a change, and confirm the sidebar badge reads 0 afterwards.
