# Edge

Trading-Journal fürs iPhone, gebaut für Prop-Firm-Challenges: Trades festhalten (von Hand oder per Screenshot aus dem MT5-Verlauf), die Regeln der Challenge im Blick behalten und in der Analyse sehen, wo das Geld verloren geht.

Edge ist eine Web-App. Sie läuft offline und speichert alle Einträge nur auf dem Gerät, nichts davon landet in diesem Repository.

## Vor dem Trade

Der **Check** auf „Heute“ rechnet die Lotgröße und zeigt eine Ampel: Rot, wenn eine Grenze oder Regel verletzt ist (Tageslimit, Verluste in Folge, Pause nach einem Verlust, eigene Regeln), Gelb bei Warnzeichen (gegen den Marktplan, Stress, Symbole oder Uhrzeiten, die bisher schlecht liefen), Grün, wenn alles passt. Ist der Trade raus, merkt Edge ihn sich; das Ergebnis kommt später von Hand oder per MT5-Screenshot dazu.

## Installieren

1. Die Seite dieses Repositorys (GitHub Pages) in **Safari** öffnen.
2. Auf **Teilen** tippen.
3. **„Zum Home-Bildschirm“** wählen und **Hinzufügen** tippen.

## Screenshots aus MT5

Das Auslesen läuft über die kostenlose Gemini-API von Google. Den Schlüssel gibt es unter [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Er bleibt nur auf dem iPhone, auch nicht im Backup.

## Backup

Einstellungen → Daten → **Backup erstellen** sichert alles als Datei, am besten in iCloud Drive.
