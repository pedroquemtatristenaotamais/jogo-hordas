import concurrent.futures
import http.client
import importlib.util
import json
import os
from pathlib import Path
import sqlite3
import tempfile
import threading
import unittest

ROOT = Path(__file__).resolve().parents[1]

class BackendTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not (ROOT / 'server.py').exists():
            raise AssertionError('API server.py ainda não implementado')
        spec = importlib.util.spec_from_file_location('game_server_under_test', ROOT / 'server.py')
        cls.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.module)

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='contas-api-')
        self.private = Path(self.tmp.name) / '.private'
        self.httpd = self.module.create_server(root=ROOT, private_dir=self.private, port=0)
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()
        self.port = self.httpd.server_port
        self.cookie = ''
        self.csrf = None

    def tearDown(self):
        self.httpd.shutdown()
        self.httpd.server_close()
        self.thread.join()
        self.tmp.cleanup()

    def request(self, path, body=None, method=None, headers=None, cookie=None, csrf=True):
        h = dict(headers or {})
        update_session = cookie is None
        if cookie is None:
            cookie = self.cookie
        if cookie:
            h['Cookie'] = cookie
        if csrf and self.csrf:
            h['X-CSRF-Token'] = self.csrf
        data = None
        if body is not None:
            data = json.dumps(body)
            h['Content-Type'] = 'application/json'
        conn = http.client.HTTPConnection('127.0.0.1', self.port, timeout=10)
        conn.request(method or ('POST' if body is not None else 'GET'), path, data, h)
        r = conn.getresponse()
        raw = r.read()
        result_headers = dict(r.getheaders())
        status = r.status
        conn.close()
        if result_headers.get('Content-Type', '').startswith('application/json'):
            payload = json.loads(raw)
        else:
            payload = raw
        if result_headers.get('Set-Cookie'):
            self.cookie = result_headers['Set-Cookie'].split(';')[0]
        if update_session and isinstance(payload, dict) and 'csrf' in payload:
            self.csrf = payload['csrf']
        return status, payload, result_headers

    def register(self, username='PlayerOne'):
        status, data, headers = self.request('/api/register', {'username': username, 'password': 'SamplePass!2026'})
        self.assertEqual(status, 200, data)
        return data, headers

    def admin(self):
        creds = json.loads((self.private / 'admin-inicial.json').read_text())
        status, data, headers = self.request('/api/login', creds)
        self.assertEqual(status, 200, data)
        self.assertEqual(data['user']['role'], 'admin')
        return data

    def age(self, run_id, seconds):
        with sqlite3.connect(self.private / 'jogo.sqlite3') as db:
            db.execute('UPDATE runs SET started_at=started_at-? WHERE id=?', (seconds, run_id))

    def start(self, practice=False):
        status, data, _ = self.request('/api/runs/start', {'hero': 'vanguard', 'practice': practice})
        self.assertEqual(status, 200, data)
        return data

    def finish(self, run_id, **kwargs):
        payload = dict(run_id=run_id, kills=12, damage=123.9, duration=15.4, hero='vanguard', level=3, victory=False)
        payload.update(kwargs)
        return self.request('/api/runs/finish', payload)

    def test_session_hash_password_validation_and_cookie(self):
        status, data, _ = self.request('/api/session')
        self.assertEqual((status, data['user'], data['csrf']), (200, None, None))
        data, headers = self.register()
        self.assertEqual(data['user']['role'], 'player')
        self.assertIn('HttpOnly', headers['Set-Cookie'])
        self.assertIn('SameSite=Lax', headers['Set-Cookie'])
        with sqlite3.connect(self.private / 'jogo.sqlite3') as db:
            row = db.execute('SELECT password_hash FROM users WHERE id=?', (data['user']['id'],)).fetchone()
            self.assertNotIn('SamplePass!2026', row[0])
            self.assertIn('600000', row[0])
            session_hash = db.execute('SELECT token_hash FROM sessions WHERE user_id=?', (data['user']['id'],)).fetchone()[0]
            self.assertNotEqual(session_hash, self.cookie.split('=', 1)[1])
        self.assertEqual(self.request('/api/admin/users')[0], 403)
        self.assertEqual(self.request('/api/admin/command', {'command': 'god', 'args': {'enabled': True}})[0], 403)
        self.assertEqual(self.request('/api/logout', {}, csrf=False)[0], 403)
        self.assertEqual(self.request('/api/logout', {})[0], 200)
        self.assertEqual(self.request('/api/session')[1]['user'], None)
        self.assertEqual(self.request('/api/login', {'username': 'playerone', 'password': 'SamplePass!2026'})[0], 200)
        self.assertEqual(self.request('/api/password', {'currentPassword': 'wrong', 'newPassword': 'DifferentPass!2026'})[0], 400)
        self.assertEqual(self.request('/api/password', {'currentPassword': 'SamplePass!2026', 'newPassword': 'DifferentPass!2026'})[0], 200)

    def test_registration_rejects_forged_role_duplicates_and_length(self):
        self.assertEqual(self.request('/api/register', {'username':'abc', 'password':'SamplePass!2026', 'role':'admin'})[0], 400)
        self.assertEqual(self.request('/api/register', {'username':'x'*21, 'password':'SamplePass!2026'})[0], 400)
        self.assertEqual(self.request('/api/register', {'username':'xx', 'password':'SamplePass!2026'})[0], 400)
        self.assertEqual(self.request('/api/register', {'username':'abc', 'password':'short'})[0], 400)
        self.register()
        self.request('/api/logout', {})
        self.assertEqual(self.request('/api/register', {'username':'playerone', 'password':'SamplePass!2026'})[0], 409)

    def test_scores_compute_points_reject_replay_and_unreal_time(self):
        self.assertEqual(self.request('/api/runs/start', {'hero':'vanguard', 'practice':False})[0], 401)
        self.register()
        run = self.start()
        self.assertTrue(run['ranked'])
        self.assertEqual(self.finish(run['run_id'], duration=9999)[0], 400)
        self.age(run['run_id'], 30)
        status, data, _ = self.finish(run['run_id'])
        self.assertEqual(status, 200, data)
        self.assertEqual(data, {'saved': True, 'ranked': True, 'points': 1596})
        self.assertEqual(self.finish(run['run_id'])[0], 409)
        entries = self.request('/api/leaderboard?sort=points')[1]['entries']
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0]['points'], 1596)
        self.assertEqual(entries[0]['rank'], 1)
        run = self.start(practice=True)
        self.age(run['run_id'], 30)
        self.assertFalse(self.finish(run['run_id'])[1]['ranked'])
        self.assertEqual(len(self.request('/api/leaderboard')[1]['entries']), 1)

    def test_scores_reject_other_owner_bad_numbers_and_hero(self):
        self.register()
        original_cookie, original_csrf = self.cookie, self.csrf
        run = self.start()
        self.request('/api/logout', {})
        self.register('PlayerTwo')
        self.assertEqual(self.finish(run['run_id'])[0], 404)
        self.request('/api/logout', {})
        self.request('/api/login', {'username':'PlayerOne', 'password':'SamplePass!2026'})
        self.age(run['run_id'], 30)
        for bad in ({'damage':-1}, {'kills':True}, {'hero':'mage'}, {'level':101}, {'victory':1}, {'damage':float('nan')}, {'kills':2.5}):
            self.assertEqual(self.finish(run['run_id'], **bad)[0], 400, bad)
        self.assertEqual(self.finish(run['run_id'])[0], 200)

    def test_leaderboard_best_per_user_sort_and_admin_exclusion(self):
        self.register()
        for kills, damage in ((15,100), (2,1000)):
            r = self.start(); self.age(r['run_id'],30)
            self.assertEqual(self.finish(r['run_id'],kills=kills,damage=damage)[0],200)
        self.assertEqual(self.request('/api/leaderboard?sort=kills')[1]['entries'][0]['kills'],15)
        self.assertEqual(self.request('/api/leaderboard?sort=damage')[1]['entries'][0]['damage'],1000)
        self.request('/api/logout', {})
        self.admin()
        r = self.start(); self.age(r['run_id'],30)
        self.assertFalse(r['ranked'])
        self.assertFalse(self.finish(r['run_id'])[1]['ranked'])
        self.assertEqual(len(self.request('/api/leaderboard')[1]['entries']),1)
        self.assertEqual(self.request('/api/leaderboard?sort=oops')[0],400)

    def test_admin_ban_revokes_sessions_and_hides_scores(self):
        user, _ = self.register()
        r = self.start(); self.age(r['run_id'],30); self.finish(r['run_id'])
        user_cookie = self.cookie
        self.cookie=''; self.csrf=None
        admin = self.admin()
        self.assertEqual(self.request('/api/admin/ban', {'user_id':admin['user']['id'], 'banned':True, 'reason':'test'})[0],400)
        self.assertEqual(self.request('/api/admin/ban', {'user_id':user['user']['id'], 'banned':True, 'reason':'teste'})[0],200)
        self.assertEqual(self.request('/api/session',cookie=user_cookie)[1]['user'],None)
        self.assertEqual(self.request('/api/leaderboard')[1]['entries'],[])
        self.assertEqual(self.request('/api/login', {'username':'PlayerOne','password':'SamplePass!2026'})[0],403)
        self.assertEqual(self.request('/api/admin/ban', {'user_id':user['user']['id'], 'banned':False,'reason':'liberado'})[0],200)
        self.assertEqual(len(self.request('/api/leaderboard')[1]['entries']),1)
        with sqlite3.connect(self.private/'jogo.sqlite3') as db:
            self.assertGreaterEqual(db.execute('SELECT COUNT(*) FROM audit').fetchone()[0],2)

    def test_admin_command_schema_and_settings(self):
        self.admin()
        valid = [
            ('stats',{'hp':100,'maxHp':200,'speed':150,'damage':1,'rate':1,'area':1,'range':1}),
            ('spawn',{'enemy':'bat','count':2}), ('power',{'id':'slash','level':8}),
            ('level',{'level':3}),('xp',{'amount':20}),('teleport',{'x':150,'y':3850}),
            ('god',{'enabled':True}),('spawning',{'enabled':False}),
            *[(name,{}) for name in ['heal','boss','clear','maxpowers','killboss']]
        ]
        for command,args in valid:
            self.assertEqual(self.request('/api/admin/command',{'command':command,'args':args})[:2],(200,{'command':command,'args':args}))
        for command,args in [('spawn',{'enemy':'garbage','count':2}),('spawn',{'enemy':'bat','count':241}),('power',{'id':'slash','level':9}),('god',{'enabled':'yes'}),('heal',{'extra':1}),('stats',{'speed':1501}),('unknown',{}),('stats',{'hp':float('inf')})]:
            self.assertEqual(self.request('/api/admin/command',{'command':command,'args':args})[0],400)
        settings = {'healthDropChance':.2,'bossTime':30,'spawnBaseRate':1,'spawnGrowth':.01,'maxEnemies':120}
        self.assertEqual(self.request('/api/admin/settings',settings)[:2],(200,{'settings':settings}))
        self.assertEqual(self.request('/api/session')[1]['settings'],settings)
        self.assertEqual(self.request('/api/admin/settings',{**settings,'maxEnemies':241})[0],400)

    def test_concurrent_finish_saves_once_and_password_revokes_other_session(self):
        self.register()
        other_cookie = self.cookie
        self.cookie = ''; self.csrf = None
        self.request('/api/login', {'username':'PlayerOne','password':'SamplePass!2026'})
        r = self.start(); self.age(r['run_id'],30)
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            statuses = list(pool.map(lambda _: self.finish(r['run_id'])[0], range(2)))
        self.assertEqual(sorted(statuses),[200,409])
        self.assertEqual(self.request('/api/password', {'currentPassword':'SamplePass!2026','newPassword':'ChangedPass!2026'})[0],200)
        self.assertEqual(self.request('/api/session',cookie=other_cookie)[1]['user'],None)
        self.assertEqual(self.request('/api/session')[1]['user']['username'],'PlayerOne')
        self.assertEqual(self.request('/api/logout',{},headers={'X-CSRF-Token':'é'},csrf=False)[0],403)

    def test_persists_account_sessions_settings_without_reseeding_admin(self):
        self.register()
        r=self.start(); self.age(r['run_id'],30); self.finish(r['run_id'])
        existing = (self.private/'admin-inicial.json').read_bytes()
        app = self.module.GameApplication(ROOT,self.private)
        self.assertEqual((self.private/'admin-inicial.json').read_bytes(),existing)
        with app.connect() as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM users WHERE role='admin'").fetchone()[0],1)
            self.assertEqual(db.execute("SELECT COUNT(*) FROM runs WHERE state='finished'").fetchone()[0],1)
            self.assertEqual(app.session(db,self.cookie)['username'],'PlayerOne')
        (self.private/'admin-inicial.json').unlink()
        self.module.GameApplication(ROOT,self.private)
        self.assertFalse((self.private/'admin-inicial.json').exists())

    def test_rate_limit_json_validation_and_body_size(self):
        for _ in range(12):
            self.assertEqual(self.request('/api/login',{'username':'NoSuchUser','password':'SamplePass!2026'})[0],401)
        self.assertEqual(self.request('/api/login',{'username':'NoSuchUser','password':'SamplePass!2026'})[0],429)
        for raw,status in [('[]',400),('{"username":"one","username":"two","password":"SamplePass!2026"}',400),('{"test":NaN}',400),('x'*16385,413)]:
            conn=http.client.HTTPConnection('127.0.0.1',self.port,timeout=10)
            conn.request('POST','/api/register',raw,{'Content-Type':'application/json'})
            r=conn.getresponse(); r.read(); self.assertEqual(r.status,status); conn.close()

    def test_static_and_cors_exclude_secrets_and_traversal(self):
        for path in ['/.private/admin-inicial.json','/server.py','/docs/contas-plano.md','/.git/config','/%2eprivate/admin-inicial.json','/%2e%2e/server.py','/js/%2e%2e/server.py','/%252eprivate/admin-inicial.json','/js/../server.py','//server.py','/js/%2f../server.py','/INICIAR-JOGO.sh']:
            self.assertIn(self.request(path)[0],(400,403,404),path)
        self.assertEqual(self.request('/')[0],200)
        self.assertEqual(self.request('/js/config.js')[0],200)
        self.assertEqual(self.request('/api/session',headers={'Origin':'https://evil.example'})[0],403)
        status,_,headers = self.request('/api/session',headers={'Origin':'http://localhost:5500'})
        self.assertEqual(status,200)
        self.assertEqual(headers['Access-Control-Allow-Origin'],'http://localhost:5500')
        self.assertEqual(headers['Access-Control-Allow-Credentials'],'true')
        self.assertEqual(self.request('/api/session',headers={'Host':'evil.example'})[0],403)
        self.assertEqual(self.request('/api/register',method='OPTIONS',headers={'Origin':'http://127.0.0.1:5500','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type,x-csrf-token'})[0],204)
        self.assertEqual(os.stat(self.private).st_mode&0o777,0o700)
        self.assertEqual(os.stat(self.private/'admin-inicial.json').st_mode&0o777,0o600)
        self.assertEqual(os.stat(self.private/'jogo.sqlite3').st_mode&0o777,0o600)

if __name__ == '__main__': unittest.main(verbosity=2)
