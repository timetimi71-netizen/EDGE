# Findet ein frisches MT5 die Server von Prop-Firmen? Pro Server: Terminal mit Startdatei starten und das Log lesen.
import glob, json, os, subprocess, time
base = r'C:\Program Files\MetaTrader 5'
path = os.path.join(base, 'terminal64.exe')
os.makedirs(r'C:\mt5cfg', exist_ok=True)
out = {}
def log_text():
    fs = sorted(glob.glob(os.path.join(base, 'logs', '2*.log')))
    if not fs:
        return ''
    raw = open(fs[-1], 'rb').read()
    try:
        return raw.decode('utf-16')
    except Exception:
        return raw.decode('utf-8', 'replace')
for server in ['FTMO-Demo', 'FTMO-Server', 'FundedNext-Server', 'The5ers-Server', 'ICMarketsSC-Demo', 'Pepperstone-Demo']:
    subprocess.run(['taskkill', '/F', '/IM', 'terminal64.exe'], capture_output=True)
    time.sleep(3)
    before = len(log_text().splitlines())
    ini = r'C:\mt5cfg\start.ini'
    with open(ini, 'w', encoding='utf-16') as f:
        f.write(f'[Common]\nLogin=12345678\nPassword=invalid-probe\nServer={server}\nKeepPrivate=1\nNewsEnable=0\n')
    subprocess.Popen([path, '/portable', f'/config:{ini}'])
    lines = []
    t0 = time.time()
    while time.time() - t0 < 75:
        time.sleep(5)
        new = log_text().splitlines()[before:]
        lines = [l for l in new if 'Network' in l or server in l]
        if any(('failed' in l or 'no connection' in l) and server in l for l in lines):
            break
    out[server] = {'s': round(time.time() - t0), 'lines': lines[-6:]}
subprocess.run(['taskkill', '/F', '/IM', 'terminal64.exe'], capture_output=True)
json.dump(out, open('status.json', 'w'), indent=1)
print(json.dumps(out, indent=1))
