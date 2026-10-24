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

try:
    import MetaTrader5 as mt5
    out['pkg'] = getattr(mt5, '__version__', '?')
    out['exists'] = os.path.exists(path)
    out['procs_before'] = procs()
    subprocess.run(['taskkill', '/F', '/IM', 'terminal64.exe'], capture_output=True)
    time.sleep(3)
    # Einmal selbst starten (portable), dann verbinden
    p = subprocess.Popen([path, '/portable'])
    time.sleep(35)
    shot('screen1')
    out['procs_after_start'] = procs()
    t0 = time.time()
    ok = mt5.initialize(path=path, portable=True, timeout=90000)
    out['init'] = ok
    out['init_err'] = mt5.last_error()
    out['init_s'] = round(time.time() - t0, 1)
    shot('screen2')
    if ok:
        out['version'] = mt5.version()
        ti = mt5.terminal_info()
        out['terminal'] = {k: v for k, v in ti._asdict().items() if k in ('connected', 'path', 'data_path', 'build', 'company')} if ti else None
        tries = []
        for server in ['FTMO-Demo', 'FTMO-Server', 'FundedNext-Server', 'ICMarketsSC-Demo', 'MetaQuotes-Demo']:
            t1 = time.time()
            r = mt5.login(12345678, password='invalid-probe', server=server, timeout=30000)
            tries.append({'server': server, 'ok': r, 'err': mt5.last_error(), 's': round(time.time() - t1, 1)})
        out['logins'] = tries
        mt5.shutdown()
except Exception as e:
    out['exception'] = repr(e)
out['logs'] = logs()
json.dump(out, open('status.json', 'w'), indent=1, default=str)
print(json.dumps(out, indent=1, default=str)[:6000])
