import base64, glob, json, os, subprocess, sys, time
out = {'python': sys.version}
base = r'C:\Program Files\MetaTrader 5'
path = os.path.join(base, 'terminal64.exe')

def shot(name):
    # Bildschirmfoto vom Runner, um hängende Fenster zu sehen
    ps = (
        "Add-Type -AssemblyName System.Windows.Forms,System.Drawing;"
        "$b=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds;"
        "$bmp=New-Object System.Drawing.Bitmap $b.Width,$b.Height;"
        "$g=[System.Drawing.Graphics]::FromImage($bmp);$g.CopyFromScreen($b.Location,[System.Drawing.Point]::Empty,$b.Size);"
        f"$bmp.Save('{name}.png')"
    )
    r = subprocess.run(['powershell', '-NoProfile', '-Command', ps], capture_output=True, text=True)
    out.setdefault('shots', []).append({name: r.returncode, 'err': r.stderr[-300:]})

def logs():
    res = {}
    for pat in [os.path.join(base, 'logs', '*.log'), os.path.join(os.environ.get('APPDATA', ''), 'MetaQuotes', 'Terminal', '*', 'logs', '*.log')]:
        for f in sorted(glob.glob(pat))[-2:]:
            raw = open(f, 'rb').read()
            try:
                txt = raw.decode('utf-16')
            except Exception:
                txt = raw.decode('utf-8', 'replace')
            res[f] = txt.splitlines()[-40:]
    return res

def procs():
    r = subprocess.run(['tasklist', '/FI', 'IMAGENAME eq terminal64.exe'], capture_output=True, text=True)
    return r.stdout.strip().splitlines()[-3:]

import ctypes, threading
from ctypes import wintypes
user32 = ctypes.windll.user32
closed = []
WNDENUM = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
def title(h):
    n = user32.GetWindowTextLengthW(h)
    b = ctypes.create_unicode_buffer(n + 1)
    user32.GetWindowTextW(h, b, n + 1)
    return b.value
# Dialoge, die MT5 beim ersten Start öffnet und die alles blockieren
BLOCKERS = ('Open an Account', 'Welcome to LiveUpdate', 'Login', 'LiveUpdate', 'Open an account')
def closer(stop):
    while not stop.is_set():
        hits = []
        def cb(h, _):
            if user32.IsWindowVisible(h):
                t = title(h)
                if any(t.startswith(x) for x in BLOCKERS):
                    hits.append((h, t))
            return True
        user32.EnumWindows(WNDENUM(cb), 0)
        for h, t in hits:
            if t.startswith('Welcome to LiveUpdate'):
                # Update annehmen: „Restart“ drücken, damit Terminal und Python-Paket zusammenpassen
                btns = []
                def cb2(c, _):
                    if title(c).replace('&', '') == 'Restart':
                        btns.append(c)
                    return True
                user32.EnumChildWindows(h, WNDENUM(cb2), 0)
                if btns:
                    user32.SendMessageW(btns[0], 0x00F5, 0, 0)  # BM_CLICK
                    restarted.set()
                    closed.append((round(time.time()), t + ' -> Restart'))
                    continue
            user32.PostMessageW(h, 0x0010, 0, 0)  # WM_CLOSE
            closed.append((round(time.time()), t))
        time.sleep(2)
stop = threading.Event()
restarted = threading.Event()
threading.Thread(target=closer, args=(stop,), daemon=True).start()
try:
    import MetaTrader5 as mt5
    out['pkg'] = getattr(mt5, '__version__', '?')
    out['exists'] = os.path.exists(path)
    out['procs_before'] = procs()
    subprocess.run(['taskkill', '/F', '/IM', 'terminal64.exe'], capture_output=True)
    time.sleep(3)
    # Einmal selbst starten (portable), dann verbinden
    # Start mit Konfigurationsdatei: Anmeldung gleich beim Start, so wie es später mit echten Daten läuft
    os.makedirs(r'C:\mt5cfg', exist_ok=True)
    ini = r'C:\mt5cfg\start.ini'
    login = os.environ.get('MT5_LOGIN') or '12345678'
    pw = os.environ.get('MT5_PASSWORD') or 'invalid-probe'
    server = os.environ.get('MT5_SERVER') or 'MetaQuotes-Demo'
    with open(ini, 'w', encoding='utf-16') as f:
        f.write(f'[Common]\nLogin={login}\nPassword={pw}\nServer={server}\nKeepPrivate=1\nNewsEnable=0\nCertInstall=0\n[Experts]\nAllowLiveTrading=0\nAllowDllImport=0\nEnabled=1\nAccount=0\nProfile=0\n')
    out['real_login'] = bool(os.environ.get('MT5_LOGIN'))
    p = subprocess.Popen([path, '/portable', f'/config:{ini}'])
    t0 = time.time()
    restarted.wait(100)
    out['restart_after_s'] = round(time.time() - t0, 1) if restarted.is_set() else None
    time.sleep(45)
    shot('screen1')
    out['procs_after_start'] = procs()
    t0 = time.time()
    ok = mt5.initialize(path=path, portable=True, timeout=90000)
    if not ok:
        out['init1_err'] = mt5.last_error()
        ok = mt5.initialize(path=path, portable=True, timeout=60000, login=int(login), password=pw, server=server)
    out['init'] = ok
    out['init_err'] = mt5.last_error()
    out['init_s'] = round(time.time() - t0, 1)
    shot('screen2')
    if ok or (mt5.last_error() or [0])[0] == -6:
        ok = True
        out['version'] = mt5.version()
        ti = mt5.terminal_info()
        out['terminal'] = {k: v for k, v in ti._asdict().items() if k in ('connected', 'path', 'data_path', 'build', 'company')} if ti else None
        tries = []
        for server in ['MetaQuotes-Demo', 'FTMO-Demo', 'FTMO-Server', 'FundedNext-Server', 'ICMarketsSC-Demo', 'Pepperstone-Demo']:
            t1 = time.time()
            r = mt5.login(12345678, password='invalid-probe', server=server, timeout=30000)
            tries.append({'server': server, 'ok': r, 'err': mt5.last_error(), 's': round(time.time() - t1, 1)})
        out['logins'] = tries
        mt5.shutdown()
except Exception as e:
    out['exception'] = repr(e)
stop.set()
out['closed'] = closed[:30]
out['logs'] = logs()
json.dump(out, open('status.json', 'w'), indent=1, default=str)
print(json.dumps(out, indent=1, default=str)[:6000])
