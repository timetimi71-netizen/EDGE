# Edge · MT5-Abruf auf einem GitHub-Rechner (Windows).
# Meldet sich mit dem Investor-Passwort (nur lesen) bei MT5 an, sammelt geschlossene Trades, offene Positionen und den
# Kontostand und schreibt alles verschlüsselt nach sync.json. Nur Edge auf dem iPhone kennt den Schlüssel (SYNC_KEY).
import base64
import ctypes
import glob
import json
import os
import shutil
import subprocess
import sys
import threading
import time

BASE = r'C:\Program Files\MetaTrader 5'
TERMINAL = os.path.join(BASE, 'terminal64.exe')
CFG_DIR = r'C:\mt5cfg'
OUT = os.environ.get('SYNC_OUT', 'sync.json')
DAYS = 120

# MT5-Konstanten
DEAL_BUY, DEAL_SELL = 0, 1
ENTRY_IN, ENTRY_OUT, ENTRY_INOUT, ENTRY_OUT_BY = 0, 1, 2, 3
REASONS = {3: 'so', 4: 'sl', 5: 'tp'}


class SyncError(Exception):
    def __init__(self, code, detail=''):
        super().__init__(code)
        self.code = code
        self.detail = detail


# ---------- Rechnen (ohne MT5, darum lokal testbar) ----------
def build_trades(deals, orders):
    """Fasst Deals zu geschlossenen Positionen zusammen. Teilschließungen zählen erst, wenn die Position ganz zu ist."""
    by_pos = {}
    for d in deals:
        if d.type not in (DEAL_BUY, DEAL_SELL) or not d.position_id:
            continue
        by_pos.setdefault(d.position_id, []).append(d)
    first_order = {}
    for o in sorted(orders, key=lambda o: o.time_setup):
        first_order.setdefault(o.position_id, o)
    trades = []
    for pos, ds in by_pos.items():
        ds.sort(key=lambda d: (d.time_msc, d.ticket))
        ins = [d for d in ds if d.entry == ENTRY_IN]
        outs = [d for d in ds if d.entry in (ENTRY_OUT, ENTRY_OUT_BY)]
        if not ins or not outs:
            continue
        vin = sum(d.volume for d in ins)
        vout = sum(d.volume for d in outs)
        if vout + 1e-9 < vin:
            continue  # noch teilweise offen
        o = first_order.get(pos)
        last = outs[-1]
        trades.append({
            'position': int(pos),
            'symbol': ins[0].symbol,
            'side': 'long' if ins[0].type == DEAL_BUY else 'short',
            'lots': round(vin, 2),
            'entry': round(sum(d.price * d.volume for d in ins) / vin, 6),
            'exit': round(sum(d.price * d.volume for d in outs) / vout, 6),
            'sl': (o.sl or None) if o else None,
            'tp': (o.tp or None) if o else None,
            'profit': round(sum(d.profit for d in outs), 2),
            'fees': round(sum(d.commission + d.swap + getattr(d, 'fee', 0) for d in ds), 2),
            'open': int(ins[0].time),
            'close': int(last.time),
            'reason': REASONS.get(last.reason),
        })
    trades.sort(key=lambda t: t['close'])
    return trades


def build_positions(positions):
    return [{
        'position': int(p.ticket),
        'symbol': p.symbol,
        'side': 'long' if p.type == 0 else 'short',
        'lots': round(p.volume, 2),
        'entry': p.price_open,
        'sl': p.sl or None,
        'tp': p.tp or None,
        'profit': round(p.profit + p.swap, 2),
        'open': int(p.time),
    } for p in positions]


def detect_offset(ticks, now):
    """Zeitzone des Servers in Stunden aus frischen Kursen (Serverzeit minus echte UTC-Zeit).
    Ein Kurs zählt nur, wenn er höchstens zwei Minuten alt ist; mindestens zwei Kurse müssen übereinstimmen."""
    votes = {}
    for t in ticks:
        if not t:
            continue
        diff = t - now
        off = round(diff / 1800) / 2
        if -14 <= off <= 14 and -120 < diff - off * 3600 < 30:
            votes[off] = votes.get(off, 0) + 1
    if not votes:
        return None
    off, n = max(votes.items(), key=lambda kv: kv[1])
    return off if n >= 2 else None


def encrypt(payload, passphrase):
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    salt = os.urandom(16)
    iv = os.urandom(12)
    key = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=150000).derive(passphrase.encode('utf-8'))
    data = AESGCM(key).encrypt(iv, json.dumps(payload, separators=(',', ':')).encode('utf-8'), None)
    b64 = lambda b: base64.b64encode(b).decode('ascii')
    return {'alg': 'PBKDF2-SHA256-150000/AES-GCM', 'salt': b64(salt), 'iv': b64(iv), 'data': b64(data)}


# ---------- Terminal steuern ----------
def log_text():
    files = sorted(glob.glob(os.path.join(BASE, 'logs', '2*.log')))
    if not files:
        return ''
    raw = open(files[-1], 'rb').read()
    try:
        return raw.decode('utf-16')
    except Exception:
        return raw.decode('utf-8', 'replace')


def kill():
    subprocess.run(['taskkill', '/F', '/IM', 'terminal64.exe'], capture_output=True)
    time.sleep(3)


class Dialogs:
    """Schließt Fenster, die MT5 beim Start öffnet und die alles blockieren. Kann die Firmensuche bedienen."""

    def __init__(self):
        from ctypes import wintypes
        self.u = ctypes.windll.user32
        self.ENUM = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
        self.stop = threading.Event()
        self.keep_wizard = False
        self.closed = []

    def text(self, h):
        n = self.u.GetWindowTextLengthW(h)
        b = ctypes.create_unicode_buffer(n + 1)
        self.u.GetWindowTextW(h, b, n + 1)
        return b.value

    def cls(self, h):
        b = ctypes.create_unicode_buffer(256)
        self.u.GetClassNameW(h, b, 256)
        return b.value

    def tops(self, prefix):
        res = []

        def cb(h, _):
            if self.u.IsWindowVisible(h) and self.text(h).startswith(prefix):
                res.append(h)
            return True
        self.u.EnumWindows(self.ENUM(cb), 0)
        return res

    def kids(self, h):
        res = []

        def cb(c, _):
            res.append((c, self.cls(c), self.text(c).replace('&', '')))
            return True
        self.u.EnumChildWindows(h, self.ENUM(cb), 0)
        return res

    def loop(self):
        while not self.stop.is_set():
            for prefix in ('Welcome to LiveUpdate', 'LiveUpdate', 'Login', 'Open an Account'):
                if prefix == 'Open an Account' and self.keep_wizard:
                    continue
                for h in self.tops(prefix):
                    self.u.PostMessageW(h, 0x0010, 0, 0)  # WM_CLOSE
                    self.closed.append(prefix)
            time.sleep(1.5)

    def start(self):
        threading.Thread(target=self.loop, daemon=True).start()

    def search_company(self, company):
        """Im Dialog „Open an Account“ nach der Firma suchen. Dabei lädt MT5 deren Serverliste."""
        self.keep_wizard = True
        try:
            for _ in range(45):
                w = self.tops('Open an Account')
                if w:
                    break
                time.sleep(2)
            else:
                return False
            time.sleep(2)
            ks = self.kids(w[0])
            edits = [h for h, c, t in ks if c == 'Edit']
            finds = [h for h, c, t in ks if t.startswith('Find your company')]
            if not edits or not finds:
                return False
            self.u.SendMessageW(edits[0], 0x000C, 0, ctypes.c_wchar_p(company))  # WM_SETTEXT
            self.u.SendMessageW(finds[0], 0x00F5, 0, 0)  # BM_CLICK
            time.sleep(20)
            return True
        finally:
            self.keep_wizard = False


def write_ini(login, password, server):
    os.makedirs(CFG_DIR, exist_ok=True)
    ini = os.path.join(CFG_DIR, 'start.ini')
    with open(ini, 'w', encoding='utf-16') as f:
        f.write(f'[Common]\nLogin={login}\nPassword={password}\nServer={server}\nKeepPrivate=1\nNewsEnable=0\nCertInstall=0\n'
                '[Experts]\nAllowLiveTrading=0\nAllowDllImport=0\nEnabled=1\nAccount=0\nProfile=0\n')
    return ini


def wait_login(login, server, since, seconds):
    """Liest das Terminal-Log: angemeldet, abgelehnt oder keine Antwort (Server unbekannt)."""
    t0 = time.time()
    seen = False
    while time.time() - t0 < seconds:
        time.sleep(3)
        for line in log_text().splitlines()[since:]:
            if f"'{login}'" not in line:
                continue
            if 'authorized on' in line:
                return 'ok'
            if 'authorization on' in line and 'failed' in line:
                return 'login'
            if 'no connection' in line:
                seen = True
    return 'connect' if seen else 'server'


def login_terminal(login, password, server, company, dialogs):
    for attempt in range(2):
        kill()
        since = len(log_text().splitlines())
        subprocess.Popen([TERMINAL, '/portable', f'/config:{write_ini(login, password, server)}'])
        state = wait_login(login, server, since, 75 if attempt == 0 else 90)
        if state == 'ok':
            return
        if state == 'login':
            raise SyncError('login')
        if attempt == 0:
            # Server unbekannt: einmal über die Firmensuche nachladen
            kill()
            subprocess.Popen([TERMINAL, '/portable'])
            if not dialogs.search_company(company):
                raise SyncError('search')
    raise SyncError(state)


def main():
    login = os.environ.get('MT5_LOGIN', '').strip()
    password = os.environ.get('MT5_PASSWORD', '').strip()
    server = os.environ.get('MT5_SERVER', '').strip()
    key = os.environ.get('SYNC_KEY', '').strip()
    company = os.environ.get('MT5_COMPANY', '').strip() or server.split('-')[0].strip()
    status = {'v': 1, 'at': int(time.time()), 'ok': False}
    try:
        if not (login and password and server and key):
            raise SyncError('secrets')
        if not login.isdigit():
            raise SyncError('login-format')
        import MetaTrader5 as mt5
        dialogs = Dialogs()
        dialogs.start()
        login_terminal(login, password, server, company, dialogs)
        ok = mt5.initialize(path=TERMINAL, portable=True, login=int(login), password=password, server=server, timeout=90000)
        if not ok:
            time.sleep(10)
            ok = mt5.initialize(path=TERMINAL, portable=True, login=int(login), password=password, server=server, timeout=90000)
        if not ok:
            raise SyncError('ipc', str(mt5.last_error()))
        try:
            acc = mt5.account_info()
            now = time.time()
            # weit genug in die Zukunft, falls der Server einige Stunden vor UTC liegt
            frm, to = int(now - DAYS * 86400), int(now + 2 * 86400)
            deals = mt5.history_deals_get(frm, to) or ()
            orders = mt5.history_orders_get(frm, to) or ()
            positions = mt5.positions_get() or ()
            syms = list(dict.fromkeys([p.symbol for p in positions] + [d.symbol for d in deals if d.symbol][-20:] + ['EURUSD', 'XAUUSD', 'GBPUSD', 'US30', 'NAS100']))
            ticks = []
            for s in syms[:12]:
                mt5.symbol_select(s, True)
                t = mt5.symbol_info_tick(s)
                ticks.append(t.time if t else None)
            payload = {
                'v': 1,
                'at': int(now),
                'login': int(login),
                'server': server,
                'currency': acc.currency if acc else None,
                'balance': acc.balance if acc else None,
                'equity': acc.equity if acc else None,
                'offsetH': detect_offset(ticks, now),
                'trades': build_trades(deals, orders),
                'positions': build_positions(positions),
            }
        finally:
            mt5.shutdown()
        status.update({'ok': True, 'n': len(payload['trades']), 'open': len(payload['positions']), 'enc': encrypt(payload, key)})
        print(f"ok: {len(payload['trades'])} trades, {len(payload['positions'])} open, offset {payload['offsetH']}")
    except SyncError as e:
        status['error'] = e.code
        print(f'error: {e.code} {e.detail}')
    except Exception as e:
        status['error'] = 'other'
        print(f'error: {e!r}')
    finally:
        kill()
        # Zugangsdaten und Konto-Spuren nicht im Cache lassen
        shutil.rmtree(CFG_DIR, ignore_errors=True)
        for f in glob.glob(os.path.join(BASE, 'config', 'accounts.dat')) + glob.glob(os.path.join(BASE, 'logs', '*.log')):
            try:
                os.remove(f)
            except OSError:
                pass
    json.dump(status, open(OUT, 'w'), separators=(',', ':'))
    return 0


if __name__ == '__main__':
    sys.exit(main())
