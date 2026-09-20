# DHBW Discord Bot

Der Bot gleicht Discord-Fachkategorien mit dem Rapla-Stundenplan ab. Als aktive Fächer zählen
nur zukünftige Einträge mit `entityType: "LECTURE"`. `EVENT`- und `BLOCKER`-Einträge erzeugen
keine Kategorien.

## Inhaltsverzeichnis

- [Befehle](#befehle)
- [Rapla-Filter](#rapla-filter)
- [Schritt-für-Schritt-Einrichtung](#schritt-für-schritt-einrichtung)
  - [Voraussetzungen installieren](#1-voraussetzungen-installieren)
  - [Private Discord-App erstellen](#2-private-discord-app-erstellen)
  - [Zugangsdaten kopieren](#3-zugangsdaten-kopieren)
  - [Server-ID ermitteln](#4-server-id-ermitteln)
  - [Bot auf den Server einladen](#5-bot-auf-den-server-einladen)
  - [Slash-Commands registrieren](#6-slash-commands-registrieren)
  - [Öffentlichen Interaction-Endpunkt bereitstellen](#7-öffentlichen-interaction-endpunkt-bereitstellen)
  - [Funktion testen](#8-funktion-testen)
  - [Fehlerbehebung](#fehlerbehebung)
- [Dauerhaft auf Ubuntu/Debian betreiben](#dauerhaft-auf-ubuntudebian-betreiben)
  - [Server vorbereiten](#1-server-vorbereiten)
  - [Projekt installieren](#2-projekt-installieren)
  - [systemd-Dienst einrichten](#3-systemd-dienst-einrichten)
  - [Nginx-Reverse-Proxy konfigurieren](#4-nginx-reverse-proxy-konfigurieren)
  - [HTTPS aktivieren](#5-https-aktivieren)
  - [Updates installieren](#6-updates-installieren)
- [Entwicklung](#entwicklung)

## Befehle

| Befehl | Funktion |
| --- | --- |
| `/archive kategorie` | Archiviert eine ausgewählte Kategorie |
| `/archiveall` | Archiviert alle Kategorien, deren Fach nicht mehr in der API vorkommt |
| `/archivepreview` | Zeigt erwartete Fächer, Ausnahmen, gespeicherte und geplante Archivierungen |
| `/archiveexception add kategorie` | Schützt eine Kategorie vor `/archiveall` |
| `/archiveexception remove kategorie` | Entfernt den Schutz |
| `/archiveexception list` | Zeigt alle geschützten Kategorien |
| `/createcourses` | Erstellt fehlende Fachkategorien mit `general` und `bilder` |
| `/createcoursespreview` | Zeigt vorher, welche Fachkategorien erstellt würden |

Archivieren bedeutet:

- Die Kategorie erhält das Präfix `archived-`.
- Die Kategorie wird unter die aktiven Kategorien verschoben.
- `@everyone` kann die Kategorie und synchronisierte Unterkanäle weiterhin sehen und lesen,
  aber nicht schreiben oder Threads erstellen.
- Unterkanäle werden weder umbenannt noch einzeln verschoben.

Ausnahmen und archivierte Kategorien werden minimal in `data/archive-state.json` gespeichert.
Die Datei wird automatisch erstellt und nicht versioniert.

## Rapla-Filter

Der Bot erstellt Fachkategorien nur für zukünftige Rapla-Einträge, die als `LECTURE`
gekennzeichnet sind. Einträge vom Typ `EVENT` oder `BLOCKER` werden nicht berücksichtigt.

Die DHBW-API kennzeichnet einige organisatorische Termine trotzdem als `LECTURE`. Deshalb
ignoriert der Bot standardmäßig:

- `Aufbau StudiInfoTag - VL nur online`
- `StudiInfoTag - VL nur online`
- `geblockt für Klausur`

Leerzeichen und Groß-/Kleinschreibung werden beim Vergleich normalisiert. Mit
`/createcoursespreview` lässt sich prüfen, welche Kategorien erstellt würden.

## Schritt-für-Schritt-Einrichtung

### 1. Voraussetzungen installieren

Benötigt werden Node.js 18 oder neuer, npm und ein Discord-Server, auf dem du Administrator
bist.

```powershell
node --version
npm --version
npm install
Copy-Item .env.sample .env
```

### 2. Private Discord-App erstellen

1. Öffne das [Discord Developer Portal](https://discord.com/developers/applications).
2. Klicke auf **New Application**, gib einen Namen ein und erstelle die App.
3. Öffne **Bot** und erzeuge mit **Reset Token** einen Bot-Token.
4. Lass **Public Bot** deaktiviert, wenn nur du den Bot installieren dürfen sollst.
5. Öffne **Installation** und setze **Install Link** auf **None**. Private Apps dürfen keinen
   standardmäßigen Autorisierungslink besitzen.

Der Bot benötigt keine privilegierten Gateway-Intents.

### 3. Zugangsdaten kopieren

Öffne **General Information** und kopiere:

- **Application ID** nach `APP_ID`
- **Public Key** nach `PUBLIC_KEY`

Kopiere außerdem den Token von der Seite **Bot** nach `DISCORD_TOKEN`. Der Token ist geheim und
darf weder geteilt noch committed werden.

### 4. Server-ID ermitteln

1. Öffne in Discord **Benutzereinstellungen → Erweitert**.
2. Aktiviere den **Entwicklermodus**.
3. Klicke mit der rechten Maustaste auf das Server-Symbol.
4. Wähle **Server-ID kopieren**.
5. Trage die ID als `DISCORD_GUILD_ID` ein.

Die fertige `.env` sieht so aus:

```dotenv
APP_ID=<APPLICATION_ID>
DISCORD_TOKEN=<BOT_TOKEN>
PUBLIC_KEY=<PUBLIC_KEY>
PORT=3000
DISCORD_GUILD_ID=<SERVER_ID>
LECTURES_API_URL=<LECTURES_API_URL>
LECTURES_API_TOKEN=
ARCHIVED_PREFIX=archived-
ARCHIVE_STATE_FILE=data/archive-state.json
```

### 5. Bot auf den Server einladen

Öffne im Developer Portal **OAuth2 → URL Generator**:

1. Wähle unter **Scopes** `bot` und `applications.commands`.
2. Wähle unter **Bot Permissions**:
   - **Kanäle verwalten**
   - **Rollen verwalten**
3. Kopiere die generierte URL und öffne sie im Browser.
4. Wähle den Server aus `DISCORD_GUILD_ID` und bestätige die Einladung.

Die Bot-Rolle muss in der Rollenliste über Rollen stehen, deren Rechte sie bearbeiten soll.
Die Slash-Commands sind zusätzlich auf Discord-Mitglieder mit **Administrator** beschränkt.

### 6. Slash-Commands registrieren

```powershell
npm run register
```

Das veröffentlicht den Bot nicht. Die Befehle werden nur für den Server aus
`DISCORD_GUILD_ID` registriert und sollten dort sofort verfügbar sein. Falls Discord sie noch
nicht anzeigt, den Client mit `Strg+R` neu laden.

### 7. Öffentlichen Interaction-Endpunkt bereitstellen

Discord muss den lokal laufenden Webserver über HTTPS erreichen können. Zum lokalen Testen
kann beispielsweise [ngrok](https://ngrok.com/download) verwendet werden:

```powershell
npm start
```

In einem zweiten Terminal:

```powershell
ngrok http 3000
```

Kopiere die angezeigte HTTPS-Adresse und ergänze `/interactions`, zum Beispiel:

```text
https://abc123.ngrok-free.app/interactions
```

Trage diese URL im Developer Portal unter **General Information → Interactions Endpoint URL**
ein und speichere sie. Während Discord die URL prüft, müssen sowohl `npm start` als auch ngrok
laufen.

Für den dauerhaften Betrieb muss die App auf einem öffentlich erreichbaren Server laufen. Eine
kostenlose ngrok-Adresse ändert sich normalerweise bei jedem Neustart und muss dann erneut im
Developer Portal eingetragen werden.

### 8. Funktion testen

Öffne einen Serverkanal und führe die Befehle in dieser Reihenfolge aus:

1. `/createcoursespreview` zeigt fehlende Fachkategorien, ohne etwas zu verändern.
2. `/createcourses` erstellt diese Kategorien mit `general` und `bilder`.
3. `/archiveexception add` schützt allgemeine Kategorien wie Information oder Organisation.
4. `/archivepreview` zeigt die geplante Archivierung.
5. `/archiveall` führt die geplante Archivierung aus.

`/archive kategorie` archiviert unabhängig vom Stundenplan eine einzelne ausgewählte Kategorie.

### Fehlerbehebung

| Problem | Lösung |
| --- | --- |
| Commands fehlen | `npm run register` ausführen und Discord mit `Strg+R` neu laden |
| Bot erscheint offline | Erwartbar: Diese App verwendet keinen Gateway-Client; Slash-Commands funktionieren trotzdem |
| `Invalid Interaction Endpoint` | `npm start` und den HTTPS-Tunnel starten; URL muss auf `/interactions` enden |
| `Private application cannot have a default authorization link` | Unter **Installation** den **Install Link** auf **None** setzen |
| Nur „Keine Berechtigung“ erscheint | Der ausführende Discord-Benutzer benötigt **Administrator** |
| Kategorien lassen sich nicht ändern | Bot-Rechte und Position der Bot-Rolle prüfen |

## Dauerhaft auf Ubuntu/Debian betreiben

In den folgenden Beispielen wird `bot.example.de` durch deine Domain oder Subdomain ersetzt.
Ihr DNS-A-Record muss auf die öffentliche IPv4-Adresse des Servers zeigen. Bei IPv6 zusätzlich
einen passenden AAAA-Record setzen.

### 1. Server vorbereiten

```bash
sudo apt update
sudo apt install -y git nodejs npm nginx certbot python3-certbot-nginx
node --version
```

Die Node.js-Version muss mindestens 18 sein. Falls die Distribution eine ältere Version
liefert, zuerst eine aktuelle Node.js-LTS-Version über die offizielle
[Node.js-Installationsanleitung](https://nodejs.org/en/download/package-manager) installieren.

Erstelle einen Benutzer, unter dem ausschließlich der Bot läuft:

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin dcbot
sudo mkdir -p /opt/dhbw-dcbot
sudo chown dcbot:dcbot /opt/dhbw-dcbot
```

### 2. Projekt installieren

Bei einem öffentlichen Repository:

```bash
sudo -u dcbot git clone https://github.com/HaidarCodes/dhbw_dcbot.git /opt/dhbw-dcbot
cd /opt/dhbw-dcbot
sudo -u dcbot npm ci --omit=dev
sudo -u dcbot cp .env.sample .env
sudo chmod 600 .env
```

Bei einem privaten Repository das Projekt stattdessen per SSH-Deploy-Key klonen oder als
Archiv nach `/opt/dhbw-dcbot` übertragen. Keine Zugangstoken in die Clone-URL schreiben.

Bearbeite anschließend die Konfiguration:

```bash
sudo nano /opt/dhbw-dcbot/.env
```

Mindestens diese Werte müssen gesetzt sein:

```dotenv
APP_ID=<APPLICATION_ID>
DISCORD_TOKEN=<BOT_TOKEN>
PUBLIC_KEY=<PUBLIC_KEY>
PORT=3000
DISCORD_GUILD_ID=<SERVER_ID>
LECTURES_API_URL=<LECTURES_API_URL>
LECTURES_API_TOKEN=
ARCHIVED_PREFIX=archived-
ARCHIVE_STATE_FILE=data/archive-state.json
```

Registriere danach einmalig die servergebundenen Slash-Commands:

```bash
cd /opt/dhbw-dcbot
sudo -u dcbot npm run register
```

### 3. systemd-Dienst einrichten

Erstelle `/etc/systemd/system/dhbw-dcbot.service`:

```bash
sudo nano /etc/systemd/system/dhbw-dcbot.service
```

Inhalt:

```ini
[Unit]
Description=DHBW Discord Bot
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=dcbot
Group=dcbot
WorkingDirectory=/opt/dhbw-dcbot
EnvironmentFile=/opt/dhbw-dcbot/.env
ExecStart=/usr/bin/node app.js
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Aktiviere und starte den Dienst:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now dhbw-dcbot
sudo systemctl status dhbw-dcbot
```

Logs anzeigen:

```bash
sudo journalctl -u dhbw-dcbot -f
```

### 4. Nginx-Reverse-Proxy konfigurieren

Erstelle `/etc/nginx/sites-available/dhbw-dcbot`:

```bash
sudo nano /etc/nginx/sites-available/dhbw-dcbot
```

Inhalt:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name bot.example.de;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Konfiguration aktivieren:

```bash
sudo ln -s /etc/nginx/sites-available/dhbw-dcbot /etc/nginx/sites-enabled/dhbw-dcbot
sudo nginx -t
sudo systemctl reload nginx
```

Falls eine Firewall aktiv ist:

```bash
sudo ufw allow 'Nginx Full'
```

Port 3000 muss nicht öffentlich freigegeben werden, da Nginx intern darauf zugreift.

### 5. HTTPS aktivieren

```bash
sudo certbot --nginx -d bot.example.de
sudo certbot renew --dry-run
```

Trage anschließend im Discord Developer Portal unter
**General Information → Interactions Endpoint URL** ein:

```text
https://bot.example.de/interactions
```

Discord prüft die URL sofort. Der systemd-Dienst und Nginx müssen dabei laufen.

### 6. Updates installieren

```bash
cd /opt/dhbw-dcbot
sudo -u dcbot git pull --ff-only
sudo -u dcbot npm ci --omit=dev
sudo -u dcbot npm run register
sudo systemctl restart dhbw-dcbot
sudo systemctl status dhbw-dcbot
```

`npm run register` ist nach Änderungen an `commands.js` nötig. Bei reinen internen Änderungen
reicht ein Neustart des Dienstes.

## Entwicklung

```powershell
npm run check
npm test
```

Der Workflow `.github/workflows/ci.yml` führt beide Prüfungen bei Pushes und Pull Requests aus.
