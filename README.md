# Vanta

Trading-Journal fürs Handy. Schwarz-Weiß, schnell und nur mit dem Wichtigsten.

Vanta ist eine Web-App. Sie läuft offline und speichert alle Trades nur auf dem Gerät, nichts davon landet in diesem Repository.

## Home

Der Startbildschirm zeigt das aktive Konto als schwarze Karte: Kontostand, Ergebnis seit Start, Equity-Linie, Fortschritt zum Profitziel und den Puffer bis zum Max-Verlust (in € und in R). Darunter:

- **Diese Woche**, **dieser Monat** und **Disziplin**: Anteil der letzten 20 Trades nach Regeln
- **Wochenleiste** mit dem Ergebnis pro Tag
- **Offene Trades** zum Abschließen
- **Regel-Serie**: wie viele Trades in Folge nach Regeln, mit Rekord und den letzten 12 Trades als Balken
- **Erkenntnisse**: Vanta vergleicht deine Trades und sagt dir, was R bringt und was R kostet: Regeln, Bauchgefühl, stärkster und schwächster Haken, Symbole, Wochentage, Long/Short
- **Zuletzt** abgeschlossene Trades

## Konten

Mehrere Konten (z. B. Challenge, Funded, Demo), umschalten per Tipp auf die Konto-Karte. Pro Konto: Name, Startkapital, Risiko pro Trade, optional Profitziel und Max. Verlust in %. Trades, Statistik und Kalender zeigen immer das aktive Konto.

## Ablauf

1. **Vor dem Trade** (`+`): Symbol, Long/Short, Datum, dann die Checkliste abhaken und „Macht der Trade Sinn?“ mit 1 bis 5 bewerten. Screenshot und Notiz sind optional. Der Trade ist jetzt **offen**.
2. **Nach dem Trade** (*Abschließen*): Gewinn oder Verlust in € eintragen. Vanta rechnet das Ergebnis in R aus (Risiko = Startkapital × Risiko % des Kontos, pro Trade änderbar) und setzt Win, Loss oder BE (BE = innerhalb ±0,1 R).

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

Ergebnis in R und €, Trefferquote, Ø R, Anteil eingehaltener Regeln, Profit-Faktor, Max. Drawdown, Equity-Kurve, Regeln eingehalten vs. gebrochen, Regeln × Sinn, Auswertung nach Sinn 1 bis 5, jeder Haken mit/ohne, Long/Short, Symbole, Wochentage. Filter: Woche, Monat, Jahr, Alles. Dazu ein Kalender mit dem Tagesergebnis.

## Installieren

1. Die Seite dieses Repositorys (GitHub Pages) in **Safari** öffnen.
2. Auf **Teilen** tippen.
3. **„Zum Home-Bildschirm“** wählen und **Hinzufügen** tippen.

## Backup

Einstellungen (Zahnrad auf Home) → **Backup erstellen** sichert alle Trades samt Screenshots als Datei, am besten in iCloud Drive. Mit **Backup laden** kommt alles zurück.

## Technik

Reines HTML, CSS und JavaScript (ES-Module), ohne Build-Schritt. Daten liegen in IndexedDB (`vanta`), ein Service Worker hält die App offline bereit. Zum lokalen Testen: `python3 -m http.server` im Repo-Ordner.
