/* 업무 대시보드 v3 — 서비스워커
   전략: 네트워크 우선(network-first) → 새 버전이 즉시 반영된다.
   Supabase(family_sync)와 /api/ 요청은 절대 캐시하지 않고 그대로 네트워크로 통과.
   오프라인일 때만 마지막으로 받아 둔 화면/정적 파일로 뜬다. */
const CACHE = 'work-dashboard-v3-1';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon-180.png'];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(CORE.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('work-dashboard-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

function bypass(url) {
  const u = new URL(url);
  if (u.hostname === 'supabase.co' || u.hostname.endsWith('.supabase.co')) return true;
  if (u.pathname.indexOf('/api/') >= 0) return true;
  return false;
}

async function networkFirst(req) {
  const c = await caches.open(CACHE);
  try {
    const res = await fetch(req, { cache: 'no-store' });
    if (res && res.status === 200 && res.type === 'basic') c.put(req, res.clone()).catch(() => {});
    return res;
  } catch (e) {
    const hit = await c.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') {
      const idx = await c.match('./index.html') || await c.match('./');
      if (idx) return idx;
    }
    throw e;
  }
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;                 // Supabase 저장(POST)은 그대로 통과
  if (bypass(req.url)) return;                      // family_sync · Gemini API 는 캐시 금지
  event.respondWith(networkFirst(req));
});
