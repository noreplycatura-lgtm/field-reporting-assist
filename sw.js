// ============================================
// FIELD REPORTING ASSIST - SERVICE WORKER
// Version: 1.0
// ============================================

const CACHE_NAME = 'field-reporting-v1';
const STATIC_CACHE = 'static-v1';
const DYNAMIC_CACHE = 'dynamic-v1';

// Files to cache
const STATIC_FILES = [
    '/field-reporting-assist/',
    '/field-reporting-assist/index.html',
    '/field-reporting-assist/style.css',
    '/field-reporting-assist/app.js',
    '/field-reporting-assist/manifest.json',
    'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// Install Event
self.addEventListener('install', event => {
    console.log('[Service Worker] Installing...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('[Service Worker] Caching static files');
                return cache.addAll(STATIC_FILES);
            })
            .catch(err => {
                console.log('[Service Worker] Error caching static files:', err);
            })
    );
    
    self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', event => {
    console.log('[Service Worker] Activating...');
    
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
                    .map(key => {
                        console.log('[Service Worker] Removing old cache:', key);
                        return caches.delete(key);
                    })
            );
        })
    );
    
    return self.clients.claim();
});

// Fetch Event
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip Google Apps Script API calls
    if (url.hostname.includes('script.google.com')) {
        return;
    }
    
    // Skip cross-origin requests except for CDN files
    if (url.origin !== location.origin && 
        !url.hostname.includes('fonts.googleapis.com') &&
        !url.hostname.includes('fonts.gstatic.com') &&
        !url.hostname.includes('cdnjs.cloudflare.com') &&
        !url.hostname.includes('unpkg.com')) {
        return;
    }
    
    event.respondWith(
        caches.match(request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    // Return cached version
                    return cachedResponse;
                }
                
                // Fetch from network
                return fetch(request)
                    .then(networkResponse => {
                        // Check if valid response
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            return networkResponse;
                        }
                        
                        // Clone response
                        const responseToCache = networkResponse.clone();
                        
                        // Cache the response
                        caches.open(DYNAMIC_CACHE)
                            .then(cache => {
                                cache.put(request, responseToCache);
                            });
                        
                        return networkResponse;
                    })
                    .catch(err => {
                        console.log('[Service Worker] Fetch error:', err);
                        
                        // Return offline page for navigation requests
                        if (request.mode === 'navigate') {
                            return caches.match('/field-reporting-assist/index.html');
                        }
                        
                        return null;
                    });
            })
    );
});

// Background Sync (for offline data submission)
self.addEventListener('sync', event => {
    console.log('[Service Worker] Sync event:', event.tag);
    
    if (event.tag === 'sync-visits') {
        event.waitUntil(syncVisits());
    }
    
    if (event.tag === 'sync-expenses') {
        event.waitUntil(syncExpenses());
    }
});

// Push Notifications
self.addEventListener('push', event => {
    console.log('[Service Worker] Push received');
    
    let data = {
        title: 'Field Reporting Assist',
        body: 'You have a new notification',
        icon: '/field-reporting-assist/icons/icon-192x192.png'
    };
    
    if (event.data) {
        data = event.data.json();
    }
    
    const options = {
        body: data.body,
        icon: data.icon || '/field-reporting-assist/icons/icon-192x192.png',
        badge: '/field-reporting-assist/icons/icon-72x72.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'open',
                title: 'Open App'
            },
            {
                action: 'close',
                title: 'Close'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Notification Click
self.addEventListener('notificationclick', event => {
    console.log('[Service Worker] Notification clicked');
    
    event.notification.close();
    
    if (event.action === 'open') {
        event.waitUntil(
            clients.openWindow('/field-reporting-assist/')
        );
    }
});

// Helper Functions for Background Sync
async function syncVisits() {
    try {
        const pendingVisits = await getFromIndexedDB('pendingVisits');
        
        for (const visit of pendingVisits) {
            await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'submitVisit',
                    ...visit
                })
            });
            
            await removeFromIndexedDB('pendingVisits', visit.id);
        }
        
        console.log('[Service Worker] Visits synced successfully');
    } catch (error) {
        console.log('[Service Worker] Error syncing visits:', error);
    }
}

async function syncExpenses() {
    try {
        const pendingExpenses = await getFromIndexedDB('pendingExpenses');
        
        for (const expense of pendingExpenses) {
            await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'saveExpense',
                    ...expense
                })
            });
            
            await removeFromIndexedDB('pendingExpenses', expense.id);
        }
        
        console.log('[Service Worker] Expenses synced successfully');
    } catch (error) {
        console.log('[Service Worker] Error syncing expenses:', error);
    }
}

// IndexedDB Helper Functions
function getFromIndexedDB(storeName) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('FieldReportingDB', 1);
        
        request.onerror = () => reject(request.error);
        
        request.onsuccess = () => {
            const db = request.result;
            
            if (!db.objectStoreNames.contains(storeName)) {
                resolve([]);
                return;
            }
            
            const transaction = db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const getAllRequest = store.getAll();
            
            getAllRequest.onsuccess = () => resolve(getAllRequest.result);
            getAllRequest.onerror = () => reject(getAllRequest.error);
        };
    });
}

function removeFromIndexedDB(storeName, id) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('FieldReportingDB', 1);
        
        request.onerror = () => reject(request.error);
        
        request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const deleteRequest = store.delete(id);
            
            deleteRequest.onsuccess = () => resolve();
            deleteRequest.onerror = () => reject(deleteRequest.error);
        };
    });
}

console.log('[Service Worker] Loaded successfully');
