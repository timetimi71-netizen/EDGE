import glob, json, os, sys, time
out = {'python': sys.version}
try:
    import MetaTrader5 as mt5
    out['pkg'] = getattr(mt5, '__version__', '?')
    base = r'C:\Program Files\MetaTrader 5'
    path = os.path.join(base, 'terminal64.exe')
    out['exists'] = os.path.exists(path)
    t0 = time.time()
    ok = mt5.initialize(path=path, timeout=120000)
    out['init'] = ok
    out['init_err'] = mt5.last_error()
    out['init_s'] = round(time.time() - t0, 1)
    if ok:
        out['version'] = mt5.version()
        ti = mt5.terminal_info()
        out['terminal'] = {k: v for k, v in ti._asdict().items() if k in ('connected', 'trade_allowed', 'path', 'data_path', 'build', 'company')} if ti else None
        tries = []
        for server in ['FTMO-Demo', 'FTMO-Server', 'FundedNext-Server', 'TheFundedTrader-Server', 'ICMarketsSC-Demo', 'MetaQuotes-Demo']:
            t1 = time.time()
            r = mt5.login(12345678, password='invalid-probe', server=server, timeout=30000)
            tries.append({'server': server, 'ok': r, 'err': mt5.last_error(), 's': round(time.time() - t1, 1)})
        out['logins'] = tries
        dp = ti.data_path if ti else base
        logs = sorted(glob.glob(os.path.join(dp, 'logs', '*.log')))
        if logs:
            raw = open(logs[-1], 'rb').read()
            try:
                txt = raw.decode('utf-16')
            except Exception:
                txt = raw.decode('utf-8', 'replace')
            out['log_tail'] = txt.splitlines()[-60:]
        mt5.shutdown()
except Exception as e:
    out['exception'] = repr(e)
json.dump(out, open('status.json', 'w'), indent=1, default=str)
print(json.dumps(out, indent=1, default=str)[:4000])
