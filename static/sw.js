// Service Worker pour FactoSheet PWA
const CACHE_NAME = 'factosheet-v1.0.0';
const OFFLINE_URL = '/offline.html';

// Fichiers essentiels à mettre en cache
const urlsToCache = [
  '/',
  '/dashboard',
  '/compte',
  '/static/css/style.css',
  '/static/js/theme.js',
  '/static/js/camera.js',
  '/static/js/offline.js',
  '/static/manifest.json',
  OFFLINE_URL
];

// Installation du Service Worker
self.addEventListener('install', event => {
  console.log('Service Worker: Installation en cours...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Mise en cache des fichiers essentiels');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker: Installation terminée');
        return self.skipWaiting();
      })
  );
});

// Activation du Service Worker
self.addEventListener('activate', event => {
  console.log('Service Worker: Activation en cours...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Suppression ancien cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Activation terminée');
      return self.clients.claim();
    })
  );
});

// Interception des requêtes réseau
self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate') {
    // Stratégie Network First pour la navigation
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match(OFFLINE_URL);
        })
    );
  } else {
    // Stratégie Cache First pour les ressources statiques
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          if (response) {
            return response;
          }
          
          return fetch(event.request).then(response => {
            // Vérifier que la réponse est valide
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Cloner la réponse
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          });
        })
    );
  }
});

// Gestion des messages depuis l'app
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Notification de mise à jour
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

// Synchronisation en arrière-plan
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    console.log('Service Worker: Synchronisation en arrière-plan');
    event.waitUntil(syncData());
  }
});

// Fonction de synchronisation des données
async function syncData() {
  try {
    // Récupérer les données en attente depuis IndexedDB
    const pendingData = await getPendingData();
    
    for (const data of pendingData) {
      try {
        await fetch('/api/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data)
        });
        
        // Supprimer les données synchronisées
        await removePendingData(data.id);
      } catch (error) {
        console.log('Erreur synchronisation:', error);
      }
    }
  } catch (error) {
    console.log('Erreur synchronisation globale:', error);
  }
}

// Fonctions utilitaires pour IndexedDB
async function getPendingData() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('FactoSheetDB', 1);
    
    request.onsuccess = event => {
      const db = event.target.result;
      const transaction = db.transaction(['pending'], 'readonly');
      const store = transaction.objectStore('pending');
      const getAll = store.getAll();
      
      getAll.onsuccess = () => resolve(getAll.result);
      getAll.onerror = () => reject(getAll.error);
    };
    
    request.onerror = () => reject(request.error);
  });
}

async function removePendingData(id) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('FactoSheetDB', 1);
    
    request.onsuccess = event => {
      const db = event.target.result;
      const transaction = db.transaction(['pending'], 'readwrite');
      const store = transaction.objectStore('pending');
      const deleteRequest = store.delete(id);
      
      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => reject(deleteRequest.error);
    };
    
    request.onerror = () => reject(request.error);
  });
}