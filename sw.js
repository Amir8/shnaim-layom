var CACHE = "shnaim-v12";
var ASSETS = ["./", "index.html", "styles.css", "app.js", "ygolan.js", "config.js", "manifest.webmanifest",
  ];
self.addEventListener("install", function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(ASSETS); }));
  self.skipWaiting();
});
self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.map(function(k){ if(k !== CACHE) return caches.delete(k); }));
  }));
  self.clients.claim();
});
self.addEventListener("push", function(e){
  var d={}; try{ d=e.data?e.data.json():{}; }catch(x){}
  e.waitUntil(self.registration.showNotification(d.title||"שניים ליום",{
    body:d.body||"זמן לפרק היומי", icon:"icons/icon-192.png", dir:"rtl", lang:"he"
  }));
});
self.addEventListener("notificationclick", function(e){
  e.notification.close();
  e.waitUntil(clients.openWindow("./"));
});
self.addEventListener("fetch", function(e){
  if (e.request.method !== "GET") return;
  var url = new URL(e.request.url);
  /* Only static app assets may enter the offline cache. Never cache account/API data. */
  if (url.origin !== self.location.origin) return;
  var name = url.pathname.split("/").pop();
  if (!["", "index.html", "styles.css", "app.js", "ygolan.js", "config.js", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon.svg", "privacy.html"].includes(name)) return;
  e.respondWith(
    fetch(e.request).then(function(res){
      var copy = res.clone();
      caches.open(CACHE).then(function(c){ c.put(e.request, copy); });
      return res;
    }).catch(function(){ return caches.match(e.request); })
  );
});
