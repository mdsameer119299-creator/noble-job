// PROTOTYPE for HTTP-level verification only. Lives in scratch, NOT in the repo. Will be ported to Next route handlers on approval.
import http from 'node:http'; import crypto from 'node:crypto'; import fs from 'node:fs/promises'; import path from 'node:path';
const MAX = 4 * 1024 * 1024, B64 = (b) => Buffer.from(b).toString('base64url');
export function fsStorage(root) {
  const f = (b, k) => path.join(root, b, k);
  return {
    fail: { remove: false, put: false },
    async put(b, k, buf) { if (this.fail.put) throw new Error('put failed'); await fs.mkdir(path.dirname(f(b, k)), { recursive: true }); await fs.writeFile(f(b, k), buf); },
    async get(b, k) { return fs.readFile(f(b, k)); },
    async remove(b, k) { if (this.fail.remove) throw new Error('remove failed'); await fs.rm(f(b, k), { force: true }); },
    async exists(b, k) { try { await fs.access(f(b, k)); return true; } catch { return false; } },
    async list(b) { try { return await fs.readdir(path.join(root, b)); } catch { return []; } },
  };
}
export function createApp({ sql, storage, pepper, origin, logs = [], limiter = { degraded: false } }) {
  const hmac = (s) => crypto.createHmac('sha256', pepper).update(s).digest('hex');
  const csrfOf = (tok) => hmac('csrf:' + tok);
  const eq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
  const log = (...a) => logs.push(a.join(' '));
  const json = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
  const cookies = (req) => Object.fromEntries((req.headers.get('cookie') || '').split(/;\s*/).filter(Boolean).map((c) => { const i = c.indexOf('='); return [c.slice(0, i), c.slice(i + 1)]; }));
  const setC = (tok, age) => `nj_resume_claim=${tok}; HttpOnly; Secure; SameSite=Strict; Path=/api/resume/anonymous; Max-Age=${age}`;
  const sessionUser = (req) => { const c = cookies(req).sess; if (!c) return null; const [id, sig] = c.split('.'); return sig && eq(sig, hmac('sess:' + id)) ? id : null; };
  const sigOk = (buf, ext) => ext === 'pdf' ? buf.subarray(0, 5).toString() === '%PDF-' : (buf[0] === 0x50 && buf[1] === 0x4b);
  const hits = new Map(); limiter.clear = () => hits.clear();
  const limit = (key, max) => { if (limiter.degraded) return 'degraded'; const n = (hits.get(key) || 0) + 1; hits.set(key, n); return n > max ? 'limited' : 'ok'; };
  const sameOrigin = (req) => { const o = req.headers.get('origin'); if (!o || o !== origin) return false; const sf = req.headers.get('sec-fetch-site'); return !sf || sf === 'same-origin'; };
  const client = (req) => hmac('ip:' + (req.headers.get('x-forwarded-for') || 'x'));

  async function removeRow(row) { await storage.remove('resume-temp', row.object_path); await sql`delete from public.anonymous_resumes where id=${row.id}`; }

  async function upload(req) {
    if (!sameOrigin(req)) return json(403, { error: 'bad_origin' });
    const ch = client(req);
    const lim = limit('up:' + ch, 3); if (lim === 'degraded') return json(503, { error: 'try_later' }); if (lim === 'limited') return json(429, { error: 'rate_limited' });
    const form = await req.formData(); const file = form.get('file'); const email = String(form.get('email') || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(400, { error: 'invalid_email' });
    if (!file || typeof file === 'string' || !file.size) return json(400, { error: 'empty_file' });
    if (file.size > MAX) return json(413, { error: 'file_too_large', code: 'file_too_large', maxBytes: MAX });
    const ext = /\.docx$/i.test(file.name) ? 'docx' : /\.pdf$/i.test(file.name) ? 'pdf' : null; if (!ext) return json(400, { error: 'unsupported_type' });
    const buf = Buffer.from(await file.arrayBuffer()); if (!sigOk(buf, ext)) return json(400, { error: 'invalid_file' });
    for (const old of await sql`select * from public.anonymous_resumes where client_hash=${ch} and claimed_by is null`) { try { await removeRow(old); } catch { return json(503, { error: 'try_later' }); } }
    const token = crypto.randomBytes(32), tokStr = B64(token), objectPath = crypto.randomUUID() + '.' + ext;
    await sql`insert into public.anonymous_resumes(claim_hash,email_hash,object_path,ext,size_bytes,sha256,client_hash) values (${hmac(tokStr)},${hmac('email:' + email)},${objectPath},${ext},${buf.length},${crypto.createHash('sha256').update(buf).digest('hex')},${ch})`;
    try { await storage.put('resume-temp', objectPath, buf); } catch { await sql`delete from public.anonymous_resumes where object_path=${objectPath}`; return json(503, { error: 'try_later' }); }
    const h = new Headers({ 'content-type': 'application/json' }); h.append('set-cookie', setC(tokStr, 86400));
    return new Response(JSON.stringify({ score: Math.min(95, 40 + Math.floor(buf.length / 100) % 50), expiresInSeconds: 86400, csrf: csrfOf(tokStr) }), { status: 200, headers: h });
  }
  async function liveRow(req) { const t = cookies(req).nj_resume_claim; if (!t) return {}; const [row] = await sql`select * from public.anonymous_resumes where claim_hash=${hmac(t)} and claimed_by is null and revoked_at is null and expires_at>now()`; return { t, row }; }
  async function status(req) { const { t, row } = await liveRow(req); return json(200, row ? { live: true, csrf: csrfOf(t), expiresAt: row.expires_at } : { live: false }); }
  async function del(req) {
    if (!sameOrigin(req)) return json(403, { error: 'bad_origin' });
    const { t, row } = await liveRow(req); if (!row) return json(404, { error: 'none' });
    if (!eq(req.headers.get('x-csrf-token') || '', csrfOf(t))) return json(403, { error: 'bad_csrf' });
    try { await removeRow(row); } catch { return json(503, { error: 'try_later' }); }
    return new Response(JSON.stringify({ deleted: true }), { status: 200, headers: { 'content-type': 'application/json', 'set-cookie': setC('', 0) } });
  }
  async function claim(req) {
    if (req.method !== 'POST') return json(405, { error: 'method' });
    if (!(req.headers.get('content-type') || '').startsWith('application/json')) return json(415, { error: 'content_type' });
    if (!sameOrigin(req)) return json(403, { error: 'bad_origin' });
    const uid = sessionUser(req); if (!uid) return json(401, { error: 'unauthorized' });
    const t = cookies(req).nj_resume_claim; if (!t) return json(404, { error: 'claim_failed' });
    if (!eq(req.headers.get('x-csrf-token') || '', csrfOf(t))) return json(403, { error: 'bad_csrf' });
    const lim = limit('claim:' + uid, 20); if (lim === 'degraded') return json(503, { error: 'try_later' }); if (lim === 'limited') return json(429, { error: 'rate_limited' });
    const [u] = await sql`select email, email_verified from public.users where id=${uid}`;
    if (!u) return json(401, { error: 'unauthorized' });
    if (!u.email_verified) return json(403, { error: 'email_not_verified' });
    const rows = await sql`select * from public.claim_anonymous_resume(${hmac(t)}, ${uid}::uuid, ${hmac('email:' + u.email.trim().toLowerCase())})`;
    if (!rows.length) { log('claim_failed user', uid); return json(404, { error: 'claim_failed' }); }
    const r = rows[0];
    try {
      const [cand] = await sql`select id from public.candidates where user_id=${uid}`; if (!cand) throw new Error('no candidate');
      const buf = await storage.get('resume-temp', r.object_path);
      if (crypto.createHash('sha256').update(buf).digest('hex') !== r.sha256 || !sigOk(buf, r.ext)) throw new Error('revalidation failed');
      await storage.put('resumes', `${cand.id}/resume.${r.ext}`, buf);
      await sql`update public.candidates set resume_url=${cand.id + '/resume.' + r.ext} where id=${cand.id}`;
    } catch (e) { await sql`update public.anonymous_resumes set claimed_by=null, claimed_at=null where object_path=${r.object_path}`; log('claim_copy_failed'); return json(502, { error: 'try_later' }); }
    try { await storage.remove('resume-temp', r.object_path); } catch { log('temp_remove_failed_will_sweep'); }
    const h = new Headers({ 'content-type': 'application/json' }); h.append('set-cookie', setC('', 0));
    return new Response(JSON.stringify({ claimed: true, score: r.score }), { status: 200, headers: h });
  }
  async function purge() {
    const out = { removedRows: 0, removedObjects: 0, failures: 0, orphans: 0 };
    const expired = await sql`select * from public.anonymous_resumes where (claimed_by is null and expires_at<now())`;
    for (const r of expired) { try { await storage.remove('resume-temp', r.object_path); if (await storage.exists('resume-temp', r.object_path)) throw new Error('still there'); await sql`delete from public.anonymous_resumes where id=${r.id}`; out.removedRows++; out.removedObjects++; } catch { out.failures++; } }
    const claimed = await sql`select * from public.anonymous_resumes where claimed_by is not null`;
    for (const r of claimed) { if (await storage.exists('resume-temp', r.object_path)) { try { await storage.remove('resume-temp', r.object_path); out.removedObjects++; } catch { out.failures++; } } }
    await sql`delete from public.anonymous_resumes where claimed_by is not null and claimed_at<now()-interval '7 days'`;
    const known = new Set((await sql`select object_path from public.anonymous_resumes`).map((r) => r.object_path));
    for (const k of await storage.list('resume-temp')) if (!known.has(k)) { try { await storage.remove('resume-temp', k); out.orphans++; out.removedObjects++; } catch { out.failures++; } }
    return out;
  }
  async function route(req) {
    const p = new URL(req.url).pathname;
    if (p === '/api/resume/anonymous' && req.method === 'POST') return upload(req);
    if (p === '/api/resume/anonymous' && req.method === 'DELETE') return del(req);
    if (p === '/api/resume/anonymous/status' && req.method === 'GET') return status(req);
    if (p === '/api/resume/anonymous/claim') return claim(req);
    if (p === '/api/cron/purge' && req.method === 'POST') return json(200, await purge());
    return json(404, {});
  }
  const server = http.createServer(async (inc, out) => {
    const chunks = []; let n = 0, over = false;
    for await (const c of inc) { n += c.length; if (n > MAX + 64 * 1024) { over = true; break; } chunks.push(c); }
    if (over) { inc.resume(); out.writeHead(413, { 'content-type': 'application/json', connection: 'close' }); return out.end('{"error":"too_large"}'); }
    const url = `http://${inc.headers.host}${inc.url}`; const body = ['GET', 'HEAD'].includes(inc.method) ? undefined : Buffer.concat(chunks);
    const res = await route(new Request(url, { method: inc.method, headers: inc.headers, body }));
    const hd = {}; res.headers.forEach((v, k) => { hd[k] = v; }); const sc = res.headers.getSetCookie?.() || []; if (sc.length) hd['set-cookie'] = sc;
    out.writeHead(res.status, hd); out.end(Buffer.from(await res.arrayBuffer()));
  });
  return { server, purge, hmac };
}
