/* ══════════════════════════════════════════════════════════════
   Service Worker — Salsa Pizza Bar
   Versão: 1.0

   O QUE FAZ:
   - Faz cache do Firebase SDK (~150KB) e fontes na primeira abertura
   - A partir da segunda abertura, esses arquivos carregam do cache
     local do celular, sem precisar de rede — elimina a lentidão
   - Nunca cacheia dados do Firestore (comandas, sessões) — esses
     precisam sempre vir da rede para ficarem atualizados
   - Nunca cacheia index.html e admin.html — para que atualizações
     de código cheguem imediatamente sem precisar limpar cache

   QUANDO ATUALIZAR:
   - Se mudar a versão do Firebase no index.html, troque 'salsa-v1'
     para 'salsa-v2' aqui para forçar o cache a se renovar
══════════════════════════════════════════════════════════════ */

const CACHE = 'salsa-v1';

// Assets estáticos que nunca mudam — seguros para cache agressivo
const PRECACHE = [
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js',
  'https://fonts.gstatic.com/s/syne/v22/8vIS7w4qzmVxsWxjBZRjr0FKM_04uQ.woff2',
  'https://fonts.gstatic.com/s/dmsans/v15/rP2tp2ywxg089UriI5-g4vlH9VoD8Cmcqbu6-K6z9mXgjU0.woff2',
];

// ── INSTALL: baixa e cacheia os assets na primeira visita ────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(err => {
        // Se falhar o precache (sem rede), instala mesmo assim
        // O cache vai sendo preenchido conforme os arquivos são acessados
        console.warn('SW precache parcial:', err);
        return self.skipWaiting();
      })
  );
});

// ── ACTIVATE: remove caches antigos de versões anteriores ───
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── FETCH: estratégia por tipo de recurso ───────────────────
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // NUNCA cacheia — dados em tempo real ou páginas que precisam
  // estar sempre atualizadas
  const naoCache =
    url.includes('firestore.googleapis.com') ||  // dados do Firestore
    url.includes('firebase.googleapis.com')   ||  // auth Firebase
    url.includes('identitytoolkit')           ||  // auth Firebase
    url.includes('index.html')                ||  // código do app
    url.includes('admin.html')                ||  // código do admin
    url.includes('sw.js');                        // o próprio SW

  if (naoCache) return; // deixa ir direto pra rede

  // CACHE FIRST para Firebase SDK e fontes (nunca mudam)
  const isStatico =
    url.includes('gstatic.com/firebasejs') ||
    url.includes('fonts.googleapis.com')   ||
    url.includes('fonts.gstatic.com');

  if (isStatico) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached; // serve do cache na hora
        // Não estava no cache — busca na rede e salva
        return fetch(e.request).then(resp => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return resp;
        }).catch(() => cached); // se rede falhar, retorna o que tem
      })
    );
  }
  // Qualquer outra coisa (GitHub Pages assets, etc) vai direto pra rede
});
