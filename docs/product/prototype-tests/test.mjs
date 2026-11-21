import postgres from 'postgres'; import fs from 'node:fs/promises'; import os from 'node:os'; import path from 'node:path'; import crypto from 'node:crypto';
import { createApp, fsStorage } from './app.mjs';
const sql = postgres({ host: '/tmp', port: 5555, username: 'postgres', database: 'stg', onnotice: () => {}, connection: { 'request.jwt.claim.role': 'service_role' } });
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'anonstore-')); const storage = fsStorage(root);
const logs = [], limiter = { degraded: false }, PEPPER = 'test-pepper-' + crypto.randomBytes(8).toString('hex');
const ORIGIN = 'http://127.0.0.1:0';
const app = createApp({ sql, storage, pepper: PEPPER, origin: 'PLACEHOLDER', logs, limiter });
await new Promise((r) => app.server.listen(0, '127.0.0.1', r)); const port = app.server.address().port; const BASE = `http://127.0.0.1:${port}`;
const appReal = createApp({ sql, storage, pepper: PEPPER, origin: BASE, logs, limiter }); app.server.close(); await new Promise((r) => appReal.server.listen(port, '127.0.0.1', r));
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m); } };
const U = { A: '11111111-aaaa-4aaa-8aaa-111111111111', B: '22222222-bbbb-4bbb-8bbb-222222222222', U: '33333333-cccc-4ccc-8ccc-333333333333' };
const EM = { A: 'alice@example.com', B: 'bob@example.com', U: 'una@example.com' };
await sql`delete from public.anonymous_resumes`; 
for (const k of Object.keys(U)) {
  await sql`insert into auth.users(id,email) values (${U[k]},${EM[k]}) on conflict (id) do nothing`;
  await sql`insert into public.users(id,email,role,email_verified) values (${U[k]},${EM[k]},'candidate',${k !== 'U'}) on conflict (id) do update set email=excluded.email,email_verified=excluded.email_verified`;
  await sql`delete from public.candidates where user_id=${U[k]}`;
  await sql`insert into public.candidates(id,user_id,first_name,last_name) values (gen_random_uuid(),${U[k]},${k},${k})`;
}
const sess = (k) => `sess=${U[k]}.${appReal.hmac('sess:' + U[k])}`;
const pdf = (extra = 2000) => Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(extra, 65), Buffer.from('\n%%EOF')]);
const docx = await fs.readFile('/home/claude/scratch/valid.docx');
const jar = () => ({ c: {} });
const jr = (j, res) => { for (const sc of res.headers.getSetCookie()) { const [kv] = sc.split(';'); const i = kv.indexOf('='); j.c[kv.slice(0, i)] = kv.slice(i + 1); } };
const ck = (j, extra) => Object.entries(j.c).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).concat(extra ? [extra] : []).join('; ');
let ipn = 0; const newIp = () => `10.0.${Math.floor(++ipn / 250)}.${ipn % 250}`;
async function up(j, { buf = pdf(), name = 'cv.pdf', email = EM.A, ip = newIp(), omit = [] } = {}) {
  const f = new FormData(); if (!omit.includes('file')) f.append('file', new Blob([buf]), name); if (!omit.includes('email')) f.append('email', email);
  const res = await fetch(BASE + '/api/resume/anonymous', { method: 'POST', body: f, headers: { origin: BASE, 'x-forwarded-for': ip } }); jr(j, res);
  const body = await res.json().catch(() => ({})); return { res, body, ip };
}
const claim = (j, { who, csrf, origin = BASE, ctype = 'application/json', method = 'POST', sfs, noCookie } = {}) => fetch(BASE + '/api/resume/anonymous/claim', { method, headers: { ...(ctype ? { 'content-type': ctype } : {}), ...(origin ? { origin } : {}), ...(csrf !== undefined ? { 'x-csrf-token': csrf } : {}), ...(sfs ? { 'sec-fetch-site': sfs } : {}), cookie: [noCookie ? '' : ck(j), who ? sess(who) : ''].filter(Boolean).join('; ') }, body: method === 'POST' ? '{}' : undefined });
const cnt = async () => (await sql`select count(*)::int n from public.anonymous_resumes`)[0].n;
const tmpObjs = () => storage.list('resume-temp');
const reset = async () => { limiter.clear(); await sql`delete from public.anonymous_resumes`; await fs.rm(path.join(root, 'resume-temp'), { recursive: true, force: true }); await fs.rm(path.join(root, 'resumes'), { recursive: true, force: true }); await sql`update public.candidates set resume_url=null`; };

console.log('A. upload, token and cookie properties');
{ await reset(); const j = jar(); const { res, body } = await up(j); const sc = res.headers.getSetCookie().join('|');
  ok(res.status === 200 && body.csrf, 'opt-in upload 200 with csrf');
  ok(/HttpOnly/.test(sc) && /Secure/.test(sc) && /SameSite=Strict/.test(sc) && /Path=\/api\/resume\/anonymous/.test(sc) && /Max-Age=86400/.test(sc), 'cookie flags: HttpOnly, Secure, SameSite=Strict, scoped Path, 24h Max-Age');
  const tok = j.c.nj_resume_claim; ok(Buffer.from(tok, 'base64url').length === 32, 'token is 256-bit (32 random bytes)');
  const [row] = await sql`select * from public.anonymous_resumes`; const dump = JSON.stringify(row);
  ok(row.claim_hash !== tok && !dump.includes(tok), 'raw token is not stored (only HMAC)');
  ok(!dump.includes('alice') && !dump.includes('example.com') && !/\d+\.\d+\.\d+\.\d+/.test(dump), 'no plaintext e-mail or IP stored');
  ok((await tmpObjs()).length === 1, 'exactly one temp object stored'); }

console.log('B. validation: nothing stored on rejection');
{ await reset(); const cases = [
  ['renamed exe (MZ) as .pdf', { buf: Buffer.from('MZ' + 'x'.repeat(3000)) }, 400], ['empty file', { buf: Buffer.alloc(0) }, 400], ['4 MB + 1', { buf: pdf(4 * 1024 * 1024) }, 413],
  ['unsupported .txt', { name: 'cv.txt' }, 400], ['invalid e-mail', { email: 'nope' }, 400], ['missing e-mail', { omit: ['email'] }, 400], ['docx extension but PDF-less junk', { buf: Buffer.from('hello'), name: 'cv.docx' }, 400] ];
  for (const [n, o, st] of cases) { const { res } = await up(jar(), o); ok(res.status === st, `${n} → ${st} (got ${res.status})`); }
  ok((await cnt()) === 0 && (await tmpObjs()).length === 0, 'no row and no object after all rejections');
  const big = await up(jar(), { buf: pdf(5 * 1024 * 1024 + 200000) }); ok(big.res.status === 413, 'oversized body cut off before parsing (413)');
  const exact = await up(jar(), { buf: pdf(4 * 1024 * 1024 - 100) }); ok(exact.res.status === 200, 'just under 4 MB accepted'); const d = await up(jar(), { buf: docx, name: 'cv.docx' }); ok(d.res.status === 200, 'valid DOCX accepted'); }

console.log('C. replace removes the old object; D. rate limit');
{ await reset(); const j1 = jar(); const a = await up(j1, { ip: '9.9.9.9' }); const o1 = (await tmpObjs())[0]; const j2 = jar(); await up(j2, { ip: '9.9.9.9' });
  ok((await cnt()) === 1 && (await tmpObjs()).length === 1 && !(await tmpObjs()).includes(o1), 'second upload from same client replaces row AND deletes the old object');
  await up(jar(), { ip: '9.9.9.9' }); const four = await up(jar(), { ip: '9.9.9.9' }); ok(four.res.status === 429, '4th stored upload within the window → 429');
  limiter.degraded = true; const dg = await up(jar(), { ip: '8.8.8.8' }); ok(dg.res.status === 503, 'limiter degraded → stored upload fails CLOSED (503)'); limiter.degraded = false; }

console.log('E. status / delete (CSRF) ');
{ await reset(); const j = jar(); const { body } = await up(j);
  const st = await (await fetch(BASE + '/api/resume/anonymous/status', { headers: { cookie: ck(j) } })).json(); ok(st.live === true && st.csrf === body.csrf, 'status live with csrf (same-origin readable only)');
  ok((await (await fetch(BASE + '/api/resume/anonymous/status')).json()).live === false, 'no cookie → not live');
  const d0 = await fetch(BASE + '/api/resume/anonymous', { method: 'DELETE', headers: { origin: BASE, cookie: ck(j) } }); ok(d0.status === 403 && (await cnt()) === 1, 'DELETE without CSRF header → 403, nothing deleted');
  const d1 = await fetch(BASE + '/api/resume/anonymous', { method: 'DELETE', headers: { origin: 'https://evil.example', 'x-csrf-token': body.csrf, cookie: ck(j) } }); ok(d1.status === 403 && (await cnt()) === 1, 'DELETE from foreign Origin → 403');
  const d2 = await fetch(BASE + '/api/resume/anonymous', { method: 'DELETE', headers: { origin: BASE, 'x-csrf-token': body.csrf, cookie: ck(j) } }); jr(j, d2);
  ok(d2.status === 200 && (await cnt()) === 0 && (await tmpObjs()).length === 0, 'DELETE with CSRF → row AND storage object removed'); ok(/Max-Age=0/.test(d2.headers.getSetCookie().join()), 'cookie cleared on delete'); }

console.log('F. happy-path claim');
{ await reset(); const j = jar(); const { body } = await up(j, { email: '  Alice@Example.com ' }); const tmp = (await tmpObjs())[0];
  const r = await claim(j, { who: 'A', csrf: body.csrf }); ok(r.status === 200, 'verified owner with matching e-mail (case/space-insensitive) → 200');
  const [c] = await sql`select id,resume_url from public.candidates where user_id=${U.A}`; ok(c.resume_url === `${c.id}/resume.pdf` && await storage.exists('resumes', c.resume_url), 'permanent copy exists at resumes/{candidateId}/resume.pdf and resume_url set');
  ok(!(await storage.exists('resume-temp', tmp)), 'TEMP OBJECT DELETED from storage after claim'); const [row] = await sql`select claimed_by from public.anonymous_resumes`; ok(row.claimed_by === U.A, 'row bound to claiming user');
  ok(/Max-Age=0/.test(r.headers.getSetCookie().join()), 'claim cookie cleared'); jr(j, r); }

console.log('G. replay and H. stolen token / cross-user');
{ await reset(); const j = jar(); const { body } = await up(j); const stolen = { ...j };
  const b1 = await claim(stolen, { who: 'B', csrf: body.csrf }); ok(b1.status === 404, 'verified user B with stolen cookie+csrf but different e-mail → refused');
  const [r1] = await sql`select claimed_by,bad_claims from public.anonymous_resumes`; ok(r1.claimed_by === null && r1.bad_claims === 1, 'token NOT consumed; bad_claims=1');
  const a1 = await claim(j, { who: 'A', csrf: body.csrf }); ok(a1.status === 200, 'legitimate owner still claims after thief failed');
  const rp = await claim(j, { who: 'A', csrf: body.csrf }); ok(rp.status === 404, 'REPLAY by owner after claim → refused'); const rp2 = await claim(j, { who: 'B', csrf: body.csrf }); ok(rp2.status === 404, 'REPLAY by other user → refused');
  const [ca] = await sql`select resume_url from public.candidates where user_id=${U.A}`; const [cb] = await sql`select resume_url from public.candidates where user_id=${U.B}`; ok(ca.resume_url && !cb.resume_url, "B's profile never received A's resume");
  await reset(); const j2 = jar(); const up2 = await up(j2); for (let i = 0; i < 5; i++) await claim(j2, { who: 'B', csrf: up2.body.csrf });
  const [r5] = await sql`select revoked_at from public.anonymous_resumes`; ok(r5.revoked_at !== null, '5 mismatched attempts revoke the token'); const af = await claim(j2, { who: 'A', csrf: up2.body.csrf }); ok(af.status === 404, 'after revoke even the owner is refused (accepted DoS trade-off; owner re-uploads)'); }

console.log('I. unverified account');
{ await reset(); const j = jar(); const { body } = await up(j, { email: EM.U }); const r = await claim(j, { who: 'U', csrf: body.csrf }); ok(r.status === 403 && (await r.json()).error === 'email_not_verified', 'unverified account → 403 email_not_verified');
  const [row] = await sql`select claimed_by,bad_claims from public.anonymous_resumes`; ok(row.claimed_by === null && row.bad_claims === 0, 'token untouched; resume stays pending until expiry'); const [c] = await sql`select resume_url from public.candidates where user_id=${U.U}`; ok(!c.resume_url, 'no resume attached to unverified profile');
  await sql`update public.users set email_verified=true where id=${U.U}`; const r2 = await claim(j, { who: 'U', csrf: body.csrf }); ok(r2.status === 200, 'after verification the same pending resume can be claimed'); await sql`update public.users set email_verified=false where id=${U.U}`; }

console.log('J. CSRF and request-shape checks (token must stay unconsumed)');
{ await reset(); const j = jar(); const { body } = await up(j);
  const t = [ ['missing CSRF header', claim(j, { who: 'A' }), 403], ['wrong CSRF header', claim(j, { who: 'A', csrf: 'x'.repeat(64) }), 403], ['CSRF of a different token', claim(j, { who: 'A', csrf: appReal.hmac('csrf:other') }), 403],
    ['no Origin', claim(j, { who: 'A', csrf: body.csrf, origin: null }), 403], ['foreign Origin', claim(j, { who: 'A', csrf: body.csrf, origin: 'https://evil.example' }), 403], ['Sec-Fetch-Site cross-site', claim(j, { who: 'A', csrf: body.csrf, sfs: 'cross-site' }), 403],
    ['Content-Type text/plain (simple-form CSRF)', claim(j, { who: 'A', csrf: body.csrf, ctype: 'text/plain' }), 415], ['GET', claim(j, { who: 'A', csrf: body.csrf, method: 'GET' }), 405], ['no session', claim(j, { csrf: body.csrf }), 401], ['no claim cookie', claim(j, { who: 'A', csrf: body.csrf, noCookie: true }), 404] ];
  for (const [n, p, st] of t) { const r = await p; ok(r.status === st, `${n} → ${st} (got ${r.status})`); }
  const [row] = await sql`select claimed_by,bad_claims from public.anonymous_resumes`; ok(row.claimed_by === null && row.bad_claims === 0, 'none of the rejected requests consumed or damaged the token'); }

console.log('K. concurrency');
{ await reset(); const j = jar(); const { body } = await up(j); const rs = await Promise.all(Array.from({ length: 20 }, () => claim(j, { who: 'A', csrf: body.csrf }))); const sts = rs.map((r) => r.status);
  ok(sts.filter((s) => s === 200).length === 1, `20 parallel claims by the owner → exactly ONE 200 (got ${sts.filter((s) => s === 200).length}; others ${[...new Set(sts.filter((s) => s !== 200))]})`);
  const [c] = await sql`select id from public.candidates where user_id=${U.A}`; ok((await storage.list('resumes/' + c.id)).length === 1 && (await tmpObjs()).length === 0, 'one permanent object, zero temp objects');
  await reset(); const j2 = jar(); const b2 = await up(j2); const mix = await Promise.all([...Array.from({ length: 10 }, () => claim(j2, { who: 'A', csrf: b2.body.csrf })), ...Array.from({ length: 10 }, () => claim(j2, { who: 'B', csrf: b2.body.csrf }))]);
  const win = mix.filter((r) => r.status === 200).length; const [row] = await sql`select claimed_by from public.anonymous_resumes`; ok(win === 1 && row.claimed_by === U.A, 'mixed owner+thief race: exactly one winner and it is the e-mail owner'); const [cb] = await sql`select resume_url from public.candidates where user_id=${U.B}`; ok(!cb.resume_url, 'thief gets nothing'); }

console.log('L. expiry/cleanup deletes REAL storage objects');
{ await reset(); const js = []; for (let i = 0; i < 4; i++) { const j = jar(); await up(j); js.push(j); }
  const rows = await sql`select object_path from public.anonymous_resumes order by created_at`; await sql`update public.anonymous_resumes set expires_at=now()-interval '1 minute' where object_path in ${sql(rows.slice(0, 3).map((r) => r.object_path))}`;
  await storage.put('resume-temp', 'orphan-no-row.pdf', pdf()); 
  const stale = await claim(js[0], { who: 'A', csrf: appReal.hmac('csrf:' + js[0].c.nj_resume_claim) }); ok(stale.status === 404, 'expired token cannot be claimed even BEFORE cleanup runs (DB enforces expiry)');
  storage.fail.remove = true; const p1 = await (await fetch(BASE + '/api/cron/purge', { method: 'POST' })).json(); storage.fail.remove = false;
  ok(p1.failures >= 3 && (await cnt()) === 4, 'storage delete failing → rows KEPT for retry (never row-deleted while object remains)');
  const p2 = await (await fetch(BASE + '/api/cron/purge', { method: 'POST' })).json(); const left = await tmpObjs(); const dbPaths = (await sql`select object_path from public.anonymous_resumes`).map((r) => r.object_path);
  ok(p2.removedRows === 3 && p2.orphans === 1 && p2.failures === 0, `purge removed 3 expired rows + 1 orphan (${JSON.stringify(p2)})`); ok(left.length === 1 && dbPaths.length === 1 && left[0] === dbPaths[0], 'on DISK only the one unexpired object remains; matches the one remaining row');
  for (const r of rows.slice(0, 3)) ok(!(await storage.exists('resume-temp', r.object_path)), `expired object ${r.object_path.slice(0, 8)}… physically gone`); ok(!(await storage.exists('resume-temp', 'orphan-no-row.pdf')), 'orphan object (no row) physically gone'); }

console.log('M. leftover temp object after a claim, and N. copy failure release');
{ await reset(); const j = jar(); const { body } = await up(j); const tmp = (await tmpObjs())[0]; const orig = storage.remove.bind(storage); storage.remove = async () => { throw new Error('boom'); };
  const r = await claim(j, { who: 'A', csrf: body.csrf }); storage.remove = orig; ok(r.status === 200 && (await storage.exists('resume-temp', tmp)), 'claim succeeds even if temp removal fails; object left behind');
  const p = await (await fetch(BASE + '/api/cron/purge', { method: 'POST' })).json(); ok(!(await storage.exists('resume-temp', tmp)) && p.removedObjects >= 1, 'sweep removes the leftover temp object of a CLAIMED row');
  await reset(); const j2 = jar(); const b2 = await up(j2); storage.fail.put = true; const r2 = await claim(j2, { who: 'A', csrf: b2.body.csrf }); storage.fail.put = false; ok(r2.status === 502, 'permanent copy fails → 502');
  const [row] = await sql`select claimed_by from public.anonymous_resumes`; ok(row.claimed_by === null, 'claim released after failure'); const r3 = await claim(j2, { who: 'A', csrf: b2.body.csrf }); ok(r3.status === 200, 'retry succeeds'); }

console.log('O. logs');
{ const all = logs.join('\n'); const toks = []; ok(!/alice|bob|una@|@example/i.test(all), 'no e-mail addresses in logs'); ok(!/nj_resume_claim|x-csrf/i.test(all) && !/[A-Za-z0-9_-]{43}/.test(all), 'no tokens / CSRF values / cookies in logs'); }

console.log(`\nRESULT: ${pass} passed, ${fail} failed`); appReal.server.close(); await sql.end(); await fs.rm(root, { recursive: true, force: true }); process.exit(fail ? 1 : 0);
