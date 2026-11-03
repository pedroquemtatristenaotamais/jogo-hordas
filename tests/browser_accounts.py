"""Integração no navegador com banco descartável; requer Node e Playwright."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from server import create_server

with tempfile.TemporaryDirectory(prefix='muralha-browser-') as folder:
    private = Path(folder) / 'dados'
    httpd = create_server(root=ROOT, private_dir=private, port=0)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    env = os.environ.copy()
    env['MURALHA_TEST_URL'] = f'http://127.0.0.1:{httpd.server_port}'
    env['MURALHA_TEST_CREDENTIALS'] = str(private / 'admin-inicial.json')
    try:
        result = subprocess.run(['node', str(ROOT / 'tests/browser_accounts.cjs')], env=env, cwd=ROOT)
    finally:
        httpd.shutdown()
        httpd.server_close()
        thread.join()
    raise SystemExit(result.returncode)
