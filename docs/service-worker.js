const cacheName = "video/v1"

function fetchCached(request) {
  return fetch(request).then(function(response) {
    var clonedResponse = response.clone()
    caches.open(cacheName).then(function(cache) {
      if (response.status < 400) cache.put(request, clonedResponse)
    })
    return response
  })
}

self.addEventListener('fetch', (event) => {
  // first try network then try cache
  event.respondWith(
    fetchCached(event.request).catch(e => {
      return caches.open(cacheName).then(cache => {
        return cache.match(event.request).then(response => {
          return response
        })
      })
    })
  )
})


self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names => {
      return Promise.all(
        cacheNames.filter(name => {
          if (cacheName === name) {
            return false
          }
          return true
        }).map(name => {
          return caches.delete(name)
        })
      );
    })
  );
});
