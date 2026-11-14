# Vanta

Trading-Journal fürs Handy. Schwarz-Weiß, schnell und nur mit dem Wichtigsten.

Vanta ist eine Web-App. Sie läuft offline und speichert alle Trades nur auf dem Gerät, nichts davon landet in diesem Repository.

## Ablauf

1. **Vor dem Trade** (`+`): Symbol, Long/Short, Datum, dann die Checkliste abhaken und „Macht der Trade Sinn?“ mit 1 bis 5 bewerten. Screenshot und Notiz sind optional. Der Trade ist jetzt **offen**.
2. **Nach dem Trade** (*Abschließen*): Gewinn oder Verlust in € eintragen. Vanta rechnet das Ergebnis in R aus (Risiko = Kontogröße × Risiko %, pro Trade änderbar) und setzt Win, Loss oder BE (BE = innerhalb ±0,1 R).

## Checkliste und Regeln

| Bereich | Punkt | Regel |
|---|---|---|
| Bias | HTF in meine Richtung | Pflicht |
| Bias | HTF-Struktur: BOS / CHoCH | mind. 1 |
| Bias | HTF-Bestätigung: Fibonacci / FVG / IFVG / Breaker | mind. 1 |
| Entry | Liquidität: Daily / HTF / Weekly H/L | mind. 1 |
| Entry | Sweep | optional |
| Entry | Shift | Pflicht |
| Entry | Einstieg über: OTE / Breaker / FVG | mind. 1 |
| Entry | Rejection (z. B. Engulfing) | Pflicht |

Sind alle Pflichtpunkte erfüllt, steht der Trade automatisch auf **Regeln eingehalten**. Das lässt sich pro Trade von Hand umstellen. „Macht der Trade Sinn?“ zählt bewusst nicht zu den Regeln, damit die Statistik zeigen kann, ob Regeln oder Gefühl besser liegen.

## Statistik

Ergebnis in R und €, Trefferquote, Ø R, Anteil eingehaltener Regeln, Equity-Kurve, Regeln eingehalten vs. gebrochen, Regeln × Sinn, Auswertung nach Sinn 1 bis 5, jeder Haken mit/ohne, Long/Short, Symbole, Wochentage. Filter: Woche, Monat, Jahr, Alles. Dazu ein Kalender mit dem Tagesergebnis.

## Installieren

1. Die Seite dieses Repositorys (GitHub Pages) in **Safari** öffnen.
2. Auf **Teilen** tippen.
3. **„Zum Home-Bildschirm“** wählen und **Hinzufügen** tippen.

## Backup

Mehr → **Backup erstellen** sichert alle Trades samt Screenshots als Datei, am besten in iCloud Drive. Mit **Backup laden** kommt alles zurück.

## Technik

Reines HTML, CSS und JavaScript (ES-Module), ohne Build-Schritt. Daten liegen in IndexedDB (`vanta`), ein Service Worker hält die App offline bereit. Zum lokalen Testen: `python3 -m http.server` im Repo-Ordner.
