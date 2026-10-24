# Edge

Trading-Journal fürs iPhone, gebaut für Prop-Firm-Challenges: Trades festhalten (von Hand oder per Screenshot aus dem MT5-Verlauf), die Regeln der Challenge im Blick behalten und in der Analyse sehen, wo das Geld verloren geht.

Edge ist eine Web-App. Sie läuft offline und speichert alle Einträge nur auf dem Gerät, nichts davon landet in diesem Repository.

## Vor dem Trade

Der **Check** auf „Heute“ rechnet die Lotgröße und zeigt eine Ampel: Rot, wenn eine Grenze oder Regel verletzt ist (Tageslimit, Verluste in Folge, Pause nach einem Verlust, eigene Regeln), Gelb bei Warnzeichen (gegen den Marktplan, Stress, Symbole oder Uhrzeiten, die bisher schlecht liefen), Grün, wenn alles passt. Ist der Trade raus, merkt Edge ihn sich; das Ergebnis kommt später von Hand oder per MT5-Screenshot dazu.

## MT5 automatisch

Wie bei FX Replay: Der GitHub-Workflow „MT5 Sync“ meldet sich etwa alle 30 Minuten (Sonntagabend bis Freitag) mit dem Investor-Passwort bei MT5 an, holt geschlossene Trades, offene Positionen und den Kontostand und legt sie verschlüsselt im Zweig `mt5-data` ab. Edge holt sie beim Öffnen ab und entschlüsselt sie auf dem Gerät. Einrichten in Edge unter Einstellungen → MT5 automatisch; dort steht, welche vier Secrets (`MT5_LOGIN`, `MT5_PASSWORD`, `MT5_SERVER`, `SYNC_KEY`) in diesem Repository anzulegen sind. Optional `MT5_COMPANY`, falls MT5 die Firma unter dem Servernamen nicht findet.

## Installieren

1. Die Seite dieses Repositorys (GitHub Pages) in **Safari** öffnen.
2. Auf **Teilen** tippen.
3. **„Zum Home-Bildschirm“** wählen und **Hinzufügen** tippen.

## Screenshots aus MT5

Das Auslesen läuft über die kostenlose Gemini-API von Google. Den Schlüssel gibt es unter [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Er bleibt nur auf dem iPhone, auch nicht im Backup.

## Backup

Einstellungen → Daten → **Backup erstellen** sichert alles als Datei, am besten in iCloud Drive.
