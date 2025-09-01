// Gestion offline/online pour FactoSheet
class OfflineManager {
    constructor() {
        this.isOnline = navigator.onLine;
        this.pendingRequests = [];
        this.dbName = 'FactoSheetDB';
        this.dbVersion = 1;
        this.db = null;
        
        this.init();
    }

    async init() {
        // Initialiser IndexedDB
        await this.initDB();
        
        // Écouter les changements de connectivité
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
        
        // Vérifier les données en attente au démarrage
        if (this.isOnline) {
            await this.syncPendingData();
        }
    }

    // Initialiser la base de données locale
    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => reject(request.error);
            
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Store pour les requêtes en attente
                if (!db.objectStoreNames.contains('pending')) {
                    const pendingStore = db.createObjectStore('pending', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    pendingStore.createIndex('timestamp', 'timestamp');
                    pendingStore.createIndex('type', 'type');
                }
                
                // Store pour le cache des données
                if (!db.objectStoreNames.contains('cache')) {
                    const cacheStore = db.createObjectStore('cache', { 
                        keyPath: 'key' 
                    });
                    cacheStore.createIndex('timestamp', 'timestamp');
                }
                
                // Store pour l'historique des extractions
                if (!db.objectStoreNames.contains('extractions')) {
                    const extractionsStore = db.createObjectStore('extractions', { 
                        keyPath: 'id',
                        autoIncrement: true 
                    });
                    extractionsStore.createIndex('timestamp', 'timestamp');
                    extractionsStore.createIndex('status', 'status');
                }
            };
        });
    }

    // Gérer le passage en ligne
    async handleOnline() {
        console.log('📶 Connexion rétablie');
        this.isOnline = true;
        
        // Afficher notification
        this.showNetworkStatus('Connexion rétablie', 'success');
        
        // Synchroniser les données en attente
        await this.syncPendingData();
        
        // Mettre à jour l'interface
        this.updateUI();
    }

    // Gérer le passage hors ligne
    handleOffline() {
        console.log('📵 Connexion perdue');
        this.isOnline = false;
        
        // Afficher notification
        this.showNetworkStatus('Mode hors ligne activé', 'warning');
        
        // Mettre à jour l'interface
        this.updateUI();
    }

    // Afficher le statut réseau
    showNetworkStatus(message, type = 'info') {
        // Supprimer notification existante
        const existing = document.querySelector('.network-status');
        if (existing) {
            existing.remove();
        }

        const notification = document.createElement('div');
        notification.className = `network-status network-${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Supprimer après 3 secondes
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }

    // Mettre à jour l'interface utilisateur
    updateUI() {
        // Ajouter/supprimer classe offline sur le body
        if (this.isOnline) {
            document.body.classList.remove('offline-mode');
        } else {
            document.body.classList.add('offline-mode');
        }

        // Mettre à jour les boutons et formulaires
        const uploadButtons = document.querySelectorAll('.upload-btn, .btn-primary');
        uploadButtons.forEach(btn => {
            if (this.isOnline) {
                btn.disabled = false;
                btn.textContent = btn.textContent.replace(' (Hors ligne)', '');
            } else {
                btn.disabled = false; // Garder actif pour le mode offline
                if (!btn.textContent.includes('Hors ligne')) {
                    btn.textContent += ' (Hors ligne)';
                }
            }
        });
    }

    // Sauvegarder une requête pour synchronisation ultérieure
    async savePendingRequest(type, data, endpoint) {
        if (!this.db) await this.initDB();

        const request = {
            type: type,
            data: data,
            endpoint: endpoint,
            timestamp: Date.now(),
            retries: 0
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['pending'], 'readwrite');
            const store = transaction.objectStore('pending');
            const addRequest = store.add(request);
            
            addRequest.onsuccess = () => {
                console.log('💾 Requête sauvegardée pour synchronisation:', type);
                resolve(addRequest.result);
            };
            
            addRequest.onerror = () => reject(addRequest.error);
        });
    }

    // Synchroniser les données en attente
    async syncPendingData() {
        if (!this.isOnline || !this.db) return;

        console.log('🔄 Synchronisation des données en attente...');

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['pending'], 'readonly');
            const store = transaction.objectStore('pending');
            const getAllRequest = store.getAll();
            
            getAllRequest.onsuccess = async () => {
                const pendingRequests = getAllRequest.result;
                let syncCount = 0;
                
                for (const request of pendingRequests) {
                    try {
                        await this.executeRequest(request);
                        await this.removePendingRequest(request.id);
                        syncCount++;
                    } catch (error) {
                        console.error('Erreur sync:', error);
                        
                        // Incrémenter le compteur de tentatives
                        request.retries++;
                        if (request.retries >= 3) {
                            // Supprimer après 3 tentatives échouées
                            await this.removePendingRequest(request.id);
                        } else {
                            await this.updatePendingRequest(request);
                        }
                    }
                }
                
                if (syncCount > 0) {
                    this.showNetworkStatus(`${syncCount} éléments synchronisés`, 'success');
                }
                
                resolve(syncCount);
            };
            
            getAllRequest.onerror = () => reject(getAllRequest.error);
        });
    }

    // Exécuter une requête en attente
    async executeRequest(request) {
        const response = await fetch(request.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(request.data)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return response.json();
    }

    // Supprimer une requête en attente
    async removePendingRequest(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['pending'], 'readwrite');
            const store = transaction.objectStore('pending');
            const deleteRequest = store.delete(id);
            
            deleteRequest.onsuccess = () => resolve();
            deleteRequest.onerror = () => reject(deleteRequest.error);
        });
    }

    // Mettre à jour une requête en attente
    async updatePendingRequest(request) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['pending'], 'readwrite');
            const store = transaction.objectStore('pending');
            const updateRequest = store.put(request);
            
            updateRequest.onsuccess = () => resolve();
            updateRequest.onerror = () => reject(updateRequest.error);
        });
    }

    // Sauvegarder des données en cache
    async saveToCache(key, data, ttl = 3600000) { // TTL par défaut: 1 heure
        if (!this.db) await this.initDB();

        const cacheEntry = {
            key: key,
            data: data,
            timestamp: Date.now(),
            expires: Date.now() + ttl
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cache'], 'readwrite');
            const store = transaction.objectStore('cache');
            const request = store.put(cacheEntry);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Récupérer des données du cache
    async getFromCache(key) {
        if (!this.db) await this.initDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cache'], 'readonly');
            const store = transaction.objectStore('cache');
            const request = store.get(key);
            
            request.onsuccess = () => {
                const result = request.result;
                
                if (!result) {
                    resolve(null);
                    return;
                }
                
                // Vérifier l'expiration
                if (Date.now() > result.expires) {
                    // Supprimer l'entrée expirée
                    this.removeFromCache(key);
                    resolve(null);
                    return;
                }
                
                resolve(result.data);
            };
            
            request.onerror = () => reject(request.error);
        });
    }

    // Supprimer du cache
    async removeFromCache(key) {
        if (!this.db) await this.initDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cache'], 'readwrite');
            const store = transaction.objectStore('cache');
            const request = store.delete(key);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Sauvegarder une extraction hors ligne
    async saveExtractionOffline(file, result) {
        if (!this.db) await this.initDB();

        // Convertir le fichier en base64 pour stockage
        const fileData = await this.fileToBase64(file);
        
        const extraction = {
            filename: file.name,
            fileData: fileData,
            fileType: file.type,
            result: result,
            timestamp: Date.now(),
            status: 'offline',
            synced: false
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['extractions'], 'readwrite');
            const store = transaction.objectStore('extractions');
            const request = store.add(extraction);
            
            request.onsuccess = () => {
                console.log('💾 Extraction sauvegardée hors ligne');
                resolve(request.result);
            };
            
            request.onerror = () => reject(request.error);
        });
    }

    // Convertir fichier en base64
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // Obtenir le statut de connectivité
    getConnectionStatus() {
        return {
            isOnline: this.isOnline,
            connection: navigator.connection || navigator.mozConnection || navigator.webkitConnection
        };
    }
}

// Instance globale du gestionnaire offline
const offlineManager = new OfflineManager();

// Fonction utilitaire pour vérifier la connectivité
function isOnline() {
    return offlineManager.isOnline;
}

// Fonction pour sauvegarder une requête hors ligne
function saveForLater(type, data, endpoint) {
    return offlineManager.savePendingRequest(type, data, endpoint);
}

// CSS pour les notifications réseau
const networkStyles = `
<style>
    .network-status {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 0.75rem 1.5rem;
        border-radius: 25px;
        color: white;
        font-weight: 500;
        z-index: 10001;
        animation: slideInDown 0.3s ease-out;
    }

    .network-success {
        background: linear-gradient(135deg, #4CAF50, #81C784);
    }

    .network-warning {
        background: linear-gradient(135deg, #FF9800, #FFB74D);
    }

    .network-error {
        background: linear-gradient(135deg, #F44336, #EF5350);
    }

    .offline-mode {
        filter: grayscale(20%);
    }

    .offline-mode::before {
        content: "Mode hors ligne";
        position: fixed;
        bottom: 10px;
        left: 10px;
        background: rgba(255, 152, 0, 0.9);
        color: white;
        padding: 0.5rem 1rem;
        border-radius: 15px;
        font-size: 0.8rem;
        z-index: 1000;
    }

    @keyframes slideInDown {
        from {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
        }
        to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
    }

    @media (max-width: 768px) {
        .network-status {
            top: 10px;
            left: 10px;
            right: 10px;
            transform: none;
            text-align: center;
        }
    }
</style>
`;

// Injecter les styles
document.head.insertAdjacentHTML('beforeend', networkStyles);