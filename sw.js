const CACHE='flatstamp-v7';
const ASSETS=[
  './','index.html','styles.css?v=7','app.js?v=7','manifest.webmanifest?v=7','privacy.html','vendor/jspdf.umd.min.js?v=7','vendor/jspdf-LICENSE.txt',
  'icons/icon-192.png?v=7','icons/icon-512.png?v=7','demo/demo-room.jpg?v=7','demo/demo-fixture.jpg?v=7'
];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).then(resp=>{const copy=resp.clone();caches.open(CACHE).then(c=>c.put('./',copy));return resp;}).catch(()=>caches.match('./')));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>{
    const network=fetch(event.request).then(resp=>{if(resp&&resp.ok){const copy=resp.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));}return resp;});
    return cached||network;
  }));
});
