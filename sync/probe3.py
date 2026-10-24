# Firmen-Suche im „Open an Account“-Dialog automatisch bedienen, damit MT5 die Server der Prop-Firma lädt
import ctypes, glob, json, os, subprocess, time
from ctypes import wintypes
user32 = ctypes.windll.user32
WNDENUM = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
base = r'C:\Program Files\MetaTrader 5'
path = os.path.join(base, 'terminal64.exe')
out = {}
COMPANY = os.environ.get('MT5_COMPANY') or 'FTMO'
SERVER = os.environ.get('MT5_SERVER') or 'FTMO-Demo'

def text(h):
    n = user32.GetWindowTextLengthW(h)
    b = ctypes.create_unicode_buffer(n + 1)
    user32.GetWindowTextW(h, b, n + 1)
    return b.value
def cls(h):
    b = ctypes.create_unicode_buffer(256)
    user32.GetClassNameW(h, b, 256)
    return b.value
def tops(prefix):
    res = []
    def cb(h, _):
        if user32.IsWindowVisible(h) and text(h).startswith(prefix):
            res.append(h)
        return True
    user32.EnumWindows(WNDENUM(cb), 0)
    return res
def kids(h):
    res = []
    def cb(c, _):
        res.append((c, cls(c), text(c)))
        return True
    user32.EnumChildWindows(h, WNDENUM(cb), 0)
    return res
def shot(name):
    ps = ("Add-Type -AssemblyName System.Windows.Forms,System.Drawing;$b=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds;"
          "$bmp=New-Object System.Drawing.Bitmap $b.Width,$b.Height;$g=[System.Drawing.Graphics]::FromImage($bmp);"
          f"$g.CopyFromScreen($b.Location,[System.Drawing.Point]::Empty,$b.Size);$bmp.Save('{name}.png')")
    subprocess.run(['powershell', '-NoProfile', '-Command', ps], capture_output=True)
def log_text():
    fs = sorted(glob.glob(os.path.join(base, 'logs', '2*.log')))
    raw = open(fs[-1], 'rb').read() if fs else b''
    try:
        return raw.decode('utf-16')
    except Exception:
        return raw.decode('utf-8', 'replace')
def servers_dat():
    f = os.path.join(base, 'config', 'servers.dat')
    return os.path.getsize(f) if os.path.exists(f) else None

subprocess.run(['taskkill', '/F', '/IM', 'terminal64.exe'], capture_output=True)
out['servers_dat_before'] = servers_dat()
subprocess.Popen([path, '/portable'])
dlg = None
for _ in range(40):
    time.sleep(2)
    w = tops('Open an Account')
    if w:
        dlg = w[0]
        break
out['dialog'] = bool(dlg)
if dlg:
    time.sleep(2)
    ks = kids(dlg)
    out['controls'] = [(c, t) for _, c, t in ks][:40]
    edits = [h for h, c, t in ks if c == 'Edit']
    finds = [h for h, c, t in ks if t.replace('&', '').startswith('Find your company')]
    if edits:
        user32.SendMessageW(edits[0], 0x000C, 0, ctypes.c_wchar_p(COMPANY))  # WM_SETTEXT
    if finds:
        user32.SendMessageW(finds[0], 0x00F5, 0, 0)  # BM_CLICK
    out['typed'] = bool(edits)
    out['clicked'] = bool(finds)
    time.sleep(20)
    shot('screen1')
    out['servers_dat_after_search'] = servers_dat()
    out['log_search'] = [l for l in log_text().splitlines() if COMPANY.lower() in l.lower() or 'Network' in l][-8:]
subprocess.run(['taskkill', '/F', '/IM', 'terminal64.exe'], capture_output=True)
time.sleep(3)
# Jetzt mit Startdatei anmelden (ausgedachtes Konto): kommt eine Antwort vom Prop-Firm-Server?
os.makedirs(r'C:\mt5cfg', exist_ok=True)
ini = r'C:\mt5cfg\start.ini'
with open(ini, 'w', encoding='utf-16') as f:
    f.write(f'[Common]\nLogin=12345678\nPassword=invalid-probe\nServer={SERVER}\nKeepPrivate=1\nNewsEnable=0\n')
before = len(log_text().splitlines())
subprocess.Popen([path, '/portable', f'/config:{ini}'])
t0 = time.time()
lines = []
while time.time() - t0 < 90:
    time.sleep(5)
    lines = [l for l in log_text().splitlines()[before:] if 'Network' in l or SERVER in l]
    if any(SERVER in l and ('failed' in l or 'no connection' in l) for l in lines):
        break
out['login_lines'] = lines[-6:]
shot('screen2')
subprocess.run(['taskkill', '/F', '/IM', 'terminal64.exe'], capture_output=True)
json.dump(out, open('status.json', 'w'), indent=1, default=str)
print(json.dumps(out, indent=1, default=str))
