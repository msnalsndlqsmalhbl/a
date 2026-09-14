/* ═══════════════════════════════════════════════════════════════
   Service Worker - محسّن للسرعة
   ═══════════════════════════════════════════════════════════════ */

const CACHE_VERSION = 'sandal-rope-v2.0.0';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const FONTS_CACHE = `${CACHE_VERSION}-fonts`;

// الملفات الأساسية
const PRECACHE_URLS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './supabase.js',
  './modules.js',
  './returns.js',
  './advanced.js',
  './reports.js',
  './manifest.json',
  './offline.html'
];

/* ─────────── التثبيت: خزّن كل شيء مرة واحدة ─────────── */
self.addEventListener('install', (event) => {
  console.log('📦 SW: تثبيت...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('📦 SW: تخزين الملفات الأساسية...');
        // تخزين متوازي (أسرع)
        return Promise.all(
          PRECACHE_URLS.map(url => 
            cache.add(new Request(url, { cache: 'reload' }))
              .catch(err => console.warn(`⚠️ فشل تخزين ${url}:`, err))
          )
        );
      })
      .then(() => {
        console.log('✅ SW: التثبيت نجح');
        return self.skipWaiting();
      })
  );
});

/* ─────────── التفعيل: احذف القديم ─────────── */
self.addEventListener('activate', (event) => {
  console.log('🚀 SW: تفعيل...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter(name => name.startsWith('sandal-rope-') && 
              name !== STATIC_CACHE && 
              name !== RUNTIME_CACHE && 
              name !== FONTS_CACHE)
            .map(name => {
              console.log('🗑️ SW: حذف cache قديم:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('✅ SW: التفعيل نجح');
        return self.clients.claim();
      })
  );
});

/* ─────────── Fetch: Cache First للأساسيات ─────────── */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // ❌ تجاهل: Supabase (يحتاج شبكة)
  if (url.hostname.includes('supabase.co')) {
    return;
  }

  // ❌ تجاهل: طلبات POST/PUT/DELETE
  if (request.method !== 'GET') {
    return;
  }

  // ✅ خطوط Google: Cache First (نادرة التغيير)
  if (url.hostname.includes('fonts.googleapis.com') || 
      url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.open(FONTS_CACHE).then(cache => {
        return cache.match(request).then(cached => {
          if (cached) return cached;
          return fetch(request).then(response => {
            if (response && response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          }).catch(() => cached);
        });
      })
    );
    return;
  }

  // ✅ JS SDK من CDN: Cache First
  if (url.hostname.includes('jsdelivr.net') || url.hostname.includes('unpkg.com')) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(cache => {
        return cache.match(request).then(cached => {
          if (cached) return cached;
          return fetch(request).then(response => {
            if (response && response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          }).catch(() => cached);
        });
      })
    );
    return;
  }

  // ✅ الملفات المحلية: Cache First (الأسرع)
  event.respondWith(
    caches.match(request).then((cached) => {
      // إذا موجود → أعده فوراً (0ms)
      if (cached) {
        // ✅ حدّث في الخلفية بدون انتظار
        fetch(request).then((response) => {
          if (response && response.status === 200) {
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, response.clone());
            });
          }
        }).catch(() => {});
        
        return cached;
      }

      // غير موجود → جلبه من الشبكة
      return fetch(request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => {
            cache.put(request, clone);
          });
        }
        return response;
      }).catch(() => {
        if (request.destination === 'document') {
          return caches.match('./offline.html');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

/* ─────────── رسائل من الصفحة ─────────── */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then(names => {
      names.forEach(name => caches.delete(name));
    });
  }
  // ✅ تسريع: طلب تحميل كل الملفات مسبقاً
  if (event.data === 'PRELOAD_ALL') {
    caches.open(STATIC_CACHE).then(cache => {
      PRECACHE_URLS.forEach(url => {
        cache.add(url).catch(() => {});
      });
    });
  }
});