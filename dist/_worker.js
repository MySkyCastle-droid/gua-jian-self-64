/* Cloudflare Pages advanced mode. Static assets are never used as an analytics fallback. */
const COOKIE = '__Host-gj-visitor';
const LIFETIME = 365 * 24 * 60 * 60;
const PUBLIC_HOST = 'gua-jian-self-64.pages.dev';
const TOTALS = 'SELECT visits, engaged, completed FROM traffic_totals WHERE id = 1';
function json(data,status=200,headers={}) {
  return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
}
function readOnly(request,url) {
  if (url.hostname !== PUBLIC_HOST || url.searchParams.has('qa') || request.headers.get('X-Gua-QA')) return true;
  const referer=request.headers.get('Referer');
  if (referer) { try { if (new URL(referer).searchParams.has('qa')) return true; } catch {} }
  return false;
}
function identity(request) {
  const match=(request.headers.get('Cookie')||'').match(/(?:^|;\s*)__Host-gj-visitor=([^;]+)/);
  const value=match?.[1];
  return value && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value) ? value : null;
}
function aggregates(row) {
  if (!row || !['visits','engaged','completed'].every(key=>Number.isSafeInteger(row[key])&&row[key]>=0)) throw new Error('Traffic totals unavailable');
  return {visits:row.visits,engaged:row.engaged,completed:row.completed};
}
export default {
  async fetch(request,env) {
    const url=new URL(request.url);
    if (url.pathname!=='/api/traffic') return env.ASSETS.fetch(request);
    if (!['GET','POST'].includes(request.method)) return json({error:'method_not_allowed'},405,{'Allow':'GET, POST'});
    if (!env.TRAFFIC_DB) return json({error:'traffic_unavailable'},503);
    const db=env.TRAFFIC_DB;
    try {
      if (request.method==='GET') return json({totals:aggregates(await db.prepare(TOTALS).first()),readOnly:readOnly(request,url)},200,{'Cache-Control':'public, max-age=30, s-maxage=30'});
      if (readOnly(request,url)) return json({totals:aggregates(await db.prepare(TOTALS).first()),readOnly:true});
      if (request.headers.get('Origin')!==url.origin || request.headers.get('Sec-Fetch-Site')==='cross-site') return json({error:'origin_not_allowed'},403);
      if (!(request.headers.get('Content-Type')||'').startsWith('application/json')) return json({error:'json_required'},415);
      const declared=Number(request.headers.get('Content-Length')||0);
      if (declared>256) return json({error:'payload_too_large'},413);
      const text=await request.text(); if (text.length>256) return json({error:'payload_too_large'},413);
      let body; try { body=JSON.parse(text); } catch { return json({error:'invalid_json'},400); }
      if (!body || typeof body!=='object' || Array.isArray(body) || !['visit','engaged','completed'].includes(body.event) || Object.keys(body).some(k=>!['event','visibleMs'].includes(k))) return json({error:'invalid_event'},400);
      if (body.event==='engaged' && (!Number.isFinite(body.visibleMs) || body.visibleMs<60000 || body.visibleMs>31536000000)) return json({error:'visible_time_required'},400);
      const now=Math.floor(Date.now()/1000),existing=identity(request);
      if (!existing && body.event!=='visit') return json({error:'visit_required'},409);
      const id=existing||crypto.randomUUID();
      const statements=[];
      if (body.event==='visit') statements.push(db.prepare('INSERT OR IGNORE INTO traffic_visitors (id,created_at) VALUES (?,?)').bind(id,now));
      if (body.event==='engaged') statements.push(db.prepare('UPDATE traffic_visitors SET engaged_at = ? WHERE id = ? AND engaged_at IS NULL AND created_at <= ?').bind(now,id,now-60));
      if (body.event==='completed') statements.push(db.prepare('UPDATE traffic_visitors SET completed_at = ? WHERE id = ? AND completed_at IS NULL').bind(now,id));
      statements.push(db.prepare('DELETE FROM traffic_visitors WHERE created_at < ?').bind(now-LIFETIME));
      statements.push(db.prepare('SELECT created_at,engaged_at,completed_at FROM traffic_visitors WHERE id = ?').bind(id));
      statements.push(db.prepare(TOTALS));
      const result=await db.batch(statements),visitor=result.at(-2)?.results?.[0];
      if (!visitor) return json({error:'visit_required'},409);
      const payload={totals:aggregates(result.at(-1)?.results?.[0]),visitor:{engaged:visitor.engaged_at!==null,completed:visitor.completed_at!==null},readOnly:false};
      if (body.event==='engaged' && !payload.visitor.engaged) payload.retryAfterSeconds=Math.max(1,60-(now-visitor.created_at));
      const headers=existing?{}:{'Set-Cookie':`${COOKIE}=${id}; Path=/; Max-Age=${LIFETIME}; HttpOnly; Secure; SameSite=Lax`};
      return json(payload,200,headers);
    } catch { return json({error:'traffic_unavailable'},503); }
  }
};
