# DHBW Discord Bot

Der Bot gleicht Discord-Fachkategorien mit den zukünftigen Vorlesungen einer konfigurierten
Stundenplan-API ab. Er erstellt fehlende Kategorien und archiviert alte Kategorien. Alle
Befehle sind auf Administratoren beschränkt.

## Befehle

| Befehl | Funktion |
| --- | --- |
| `/createcoursespreview` | Zeigt fehlende Fachkategorien |
| `/createcourses` | Erstellt fehlende Kategorien mit `general` und `bilder` |
| `/archivepreview` | Zeigt geplante Archivierungen |
| `/archive kategorie` | Archiviert eine ausgewählte Kategorie |
| `/archiveall` | Archiviert alle nicht mehr aktiven Fachkategorien |
| `/archiveexception add kategorie` | Schützt eine Kategorie vor `/archiveall` |
| `/archiveexception remove kategorie` | Entfernt den Schutz |
| `/archiveexception list` | Zeigt alle Ausnahmen |
| `/coursealias add fach kategorie` | Ordnet ein Rapla-Fach einer anders benannten Kategorie zu |
| `/coursealias remove fach` | Entfernt eine Fachzuordnung |
| `/coursealias list` | Zeigt alle Fachzuordnungen |

Discord ergänzt Fachnamen per Autocomplete und Kategorien über den nativen Kategorie-Picker.

## Verhalten

Beim Archivieren erhält nur die Kategorie das Präfix `archived-` und wird nach unten
verschoben. Ihre Namen und Unterkanäle bleiben erhalten. Für `@everyone` wird die Kategorie
lesbar, aber schreibgeschützt.

Der Bot berücksichtigt nur zukünftige Einträge mit `entityType: "LECTURE"`. `EVENT`,
`BLOCKER` und diese von Rapla falsch klassifizierten Einträge werden ignoriert:

- `Aufbau StudiInfoTag - VL nur online`
- `StudiInfoTag - VL nur online`
- `geblockt für Klausur`

Ausnahmen, Aliase und archivierte Kategorien speichert der Bot in
`data/archive-state.json`. Die Datei wird automatisch erstellt und nicht von Git erfasst.

Ein Alias wie `Software Engineering → Informatik 2` verhindert, dass `/createcourses` eine
zweite Kategorie erstellt oder `/archiveall` die zugeordnete Kategorie archiviert, solange
das Fach in Rapla aktiv ist.

## Discord einrichten

1. Im [Discord Developer Portal](https://discord.com/developers/applications) eine App
   erstellen.
2. Unter **Bot** einen Token erzeugen. Für eine private App **Public Bot** deaktiviert lassen.
3. Unter **Installation** den **Install Link** auf **None** setzen.
4. Im **OAuth2 URL Generator** die Scopes `bot` und `applications.commands` auswählen.
5. Die Bot-Rechte **Kanäle verwalten** und **Rollen verwalten** auswählen und den Bot über die
   erzeugte URL auf den Server einladen.
6. In Discord den Entwicklermodus aktivieren und über das Kontextmenü des Servers die
   Server-ID kopieren.

Benötigt werden Application ID, Public Key, Bot-Token und Server-ID.

## Installation auf Ubuntu/Debian

```bash
sudo apt update
sudo apt install -y git nodejs npm
sudo useradd --system --create-home --shell /usr/sbin/nologin dcbot
sudo -u dcbot git clone <REPOSITORY_URL> /opt/dhbw-dcbot
cd /opt/dhbw-dcbot
sudo -u dcbot npm ci --omit=dev
sudo -u dcbot cp .env.sample .env
sudo chmod 600 .env
sudo nano .env
```

`.env` konfigurieren:

```dotenv
APP_ID=<APPLICATION_ID>
DISCORD_TOKEN=<BOT_TOKEN>
PUBLIC_KEY=<PUBLIC_KEY>
PORT=3000
DISCORD_GUILD_ID=<SERVER_ID>
LECTURES_API_URL=<STUNDENPLAN_API_URL>
LECTURES_API_TOKEN=
ARCHIVED_PREFIX=archived-
ARCHIVE_STATE_FILE=data/archive-state.json
```

Node.js 18 oder neuer ist erforderlich.

### systemd

`/etc/systemd/system/dhbw-dcbot.service`:

```ini
[Unit]
Description=DHBW Discord Bot
After=network-online.target

[Service]
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

Dienst starten:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now dhbw-dcbot
sudo journalctl -u dhbw-dcbot -f
```

### Nginx Proxy Manager

Einen öffentlichen Proxy Host anlegen:

```text
Domain: <BOT-DOMAIN>
Scheme: http
Forward Hostname/IP: <DOCKER-GATEWAY>
Forward Port: 3000
SSL: Let's Encrypt + Force SSL
WebSocket Support: aus
```

Docker-Gateway ermitteln:

```bash
docker inspect nginx-proxy-manager-npm-1 \
  --format '{{range .NetworkSettings.Networks}}{{.Gateway}}{{"\n"}}{{end}}'
```

Wenn UFW aktiv ist, nur dem NPM-Docker-Netz Zugriff auf Port 3000 geben:

```bash
sudo ufw allow from <DOCKER-SUBNETZ> to any port 3000 proto tcp
```

Im Discord Developer Portal unter **General Information → Interactions Endpoint URL**:

```text
https://<BOT-DOMAIN>/interactions
```

`Cannot GET /interactions` bei einem Browser- oder curl-Aufruf ist korrekt. Discord verwendet
für diesen Endpunkt signierte POST-Anfragen.

## Befehle registrieren und testen

```bash
cd /opt/dhbw-dcbot
sudo -u dcbot npm run register
sudo systemctl restart dhbw-dcbot
```

Danach zuerst `/createcoursespreview` und `/archivepreview` ausführen. Allgemeine Kategorien
vor `/archiveall` mit `/archiveexception add` schützen.

## Aktualisieren

```bash
cd /opt/dhbw-dcbot
sudo -u dcbot git pull --ff-only
sudo -u dcbot npm ci --omit=dev
sudo -u dcbot npm run register
sudo systemctl restart dhbw-dcbot
```

`npm run register` ist nur nach Änderungen an den Slash-Commands erforderlich.

## Entwicklung

```bash
npm ci
npm run check
npm test
```

GitHub Actions führt Syntaxprüfung und Tests bei Pushes und Pull Requests aus.
