// Système de caméra mobile pour FactoSheet
class MobileCamera {
    constructor() {
        this.stream = null;
        this.canvas = null;
        this.video = null;
        this.isCapturing = false;
        this.constraints = {
            video: {
                facingMode: 'environment', // Caméra arrière par défaut
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            }
        };
    }

    // Vérifier si la caméra est disponible
    static isSupported() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    }

    // Initialiser la caméra
    async initCamera() {
        if (!MobileCamera.isSupported()) {
            throw new Error('La caméra n\'est pas supportée par ce navigateur');
        }

        try {
            this.stream = await navigator.mediaDevices.getUserMedia(this.constraints);
            return true;
        } catch (error) {
            console.error('Erreur accès caméra:', error);
            throw new Error('Impossible d\'accéder à la caméra: ' + error.message);
        }
    }

    // Démarrer la prévisualisation
    startPreview(videoElement) {
        if (!this.stream) {
            throw new Error('Caméra non initialisée');
        }

        this.video = videoElement;
        this.video.srcObject = this.stream;
        this.video.play();

        return new Promise((resolve) => {
            this.video.onloadedmetadata = () => {
                resolve();
            };
        });
    }

    // Capturer une image
    captureImage() {
        if (!this.video || !this.stream) {
            throw new Error('Caméra non active');
        }

        // Créer un canvas pour capturer l'image
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        // Définir les dimensions du canvas
        canvas.width = this.video.videoWidth;
        canvas.height = this.video.videoHeight;

        // Dessiner l'image du vidéo sur le canvas
        context.drawImage(this.video, 0, 0, canvas.width, canvas.height);

        // Convertir en blob
        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/jpeg', 0.9);
        });
    }

    // Basculer entre caméra avant/arrière
    async switchCamera() {
        const currentFacingMode = this.constraints.video.facingMode;
        this.constraints.video.facingMode = currentFacingMode === 'environment' ? 'user' : 'environment';

        // Arrêter le flux actuel
        this.stopCamera();

        // Redémarrer avec la nouvelle caméra
        await this.initCamera();
        if (this.video) {
            await this.startPreview(this.video);
        }
    }

    // Arrêter la caméra
    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        if (this.video) {
            this.video.srcObject = null;
        }
    }

    // Obtenir les capacités de la caméra
    getCameraCapabilities() {
        if (!this.stream) return null;

        const videoTrack = this.stream.getVideoTracks()[0];
        return videoTrack.getCapabilities();
    }

    // Ajuster les paramètres de la caméra
    async adjustCameraSettings(settings) {
        if (!this.stream) return;

        const videoTrack = this.stream.getVideoTracks()[0];
        await videoTrack.applyConstraints({ video: settings });
    }
}

// Interface utilisateur pour la caméra
class CameraUI {
    constructor() {
        this.camera = new MobileCamera();
        this.isModalOpen = false;
    }

    // Créer l'interface de caméra
    createCameraModal() {
        const modal = document.createElement('div');
        modal.className = 'camera-modal';
        modal.innerHTML = `
            <div class="camera-container">
                <div class="camera-header">
                    <h3>Scanner une facture</h3>
                    <button class="close-camera" onclick="cameraUI.closeCamera()">×</button>
                </div>
                
                <div class="camera-preview">
                    <video id="cameraVideo" autoplay playsinline></video>
                    <div class="camera-overlay">
                        <div class="scan-frame"></div>
                        <div class="scan-instructions">
                            Positionnez la facture dans le cadre
                        </div>
                    </div>
                </div>
                
                <div class="camera-controls">
                    <button class="camera-btn switch-camera" onclick="cameraUI.switchCamera()" title="Changer de caméra">
                        🔄
                    </button>
                    <button class="camera-btn capture-btn" onclick="cameraUI.captureImage()">
                        📷
                    </button>
                    <button class="camera-btn flash-btn" onclick="cameraUI.toggleFlash()" title="Flash">
                        💡
                    </button>
                </div>
                
                <div class="camera-status" id="cameraStatus"></div>
            </div>
        `;

        document.body.appendChild(modal);
        return modal;
    }

    // Ouvrir la caméra
    async openCamera() {
        try {
            if (!MobileCamera.isSupported()) {
                alert('Caméra non supportée par votre navigateur');
                return;
            }

            // Créer l'interface si elle n'existe pas
            if (!document.querySelector('.camera-modal')) {
                this.createCameraModal();
            }

            const modal = document.querySelector('.camera-modal');
            const video = document.getElementById('cameraVideo');
            const status = document.getElementById('cameraStatus');

            // Afficher le modal
            modal.style.display = 'flex';
            this.isModalOpen = true;

            // Initialiser la caméra
            status.textContent = 'Initialisation de la caméra...';
            await this.camera.initCamera();
            await this.camera.startPreview(video);
            status.textContent = 'Caméra prête';

        } catch (error) {
            console.error('Erreur ouverture caméra:', error);
            alert('Erreur: ' + error.message);
            this.closeCamera();
        }
    }

    // Fermer la caméra
    closeCamera() {
        this.camera.stopCamera();
        
        const modal = document.querySelector('.camera-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        
        this.isModalOpen = false;
    }

    // Capturer une image
    async captureImage() {
        try {
            const blob = await this.camera.captureImage();
            
            // Créer un fichier à partir du blob
            const file = new File([blob], `scan_${Date.now()}.jpg`, { type: 'image/jpeg' });
            
            // Fermer la caméra
            this.closeCamera();
            
            // Déclencher l'upload du fichier
            this.processScannedImage(file);
            
        } catch (error) {
            console.error('Erreur capture:', error);
            alert('Erreur lors de la capture: ' + error.message);
        }
    }

    // Changer de caméra
    async switchCamera() {
        try {
            await this.camera.switchCamera();
        } catch (error) {
            console.error('Erreur changement caméra:', error);
        }
    }

    // Toggle flash (si supporté)
    toggleFlash() {
        // Le flash n'est pas encore standardisé dans les navigateurs
        // On peut ajouter cette fonctionnalité plus tard
        alert('Fonctionnalité flash en cours de développement');
    }

    // Traiter l'image scannée
    processScannedImage(file) {
        // Vérifier si on est sur la page dashboard
        if (window.location.pathname === '/dashboard') {
            // Utiliser la fonction d'upload existante
            if (typeof uploadFile === 'function') {
                uploadFile(file);
            } else {
                // Fallback: déclencher l'input file
                const fileInput = document.getElementById('file-input');
                if (fileInput) {
                    // Créer un DataTransfer pour simuler l'upload
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);
                    fileInput.files = dataTransfer.files;
                    
                    // Déclencher l'événement change
                    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        } else {
            // Rediriger vers le dashboard avec le fichier en paramètre
            window.location.href = '/dashboard?scan=true';
        }
    }
}

// Instance globale
const cameraUI = new CameraUI();

// Fonction globale pour ouvrir la caméra
function openMobileCamera() {
    cameraUI.openCamera();
}

// CSS pour l'interface caméra
const cameraStyles = `
<style>
    .camera-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.95);
        display: none;
        z-index: 10000;
        justify-content: center;
        align-items: center;
    }

    .camera-container {
        width: 100%;
        height: 100%;
        max-width: 500px;
        display: flex;
        flex-direction: column;
        background: #000;
        border-radius: 0;
    }

    .camera-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem;
        background: rgba(255, 255, 255, 0.1);
        color: white;
    }

    .close-camera {
        background: none;
        border: none;
        color: white;
        font-size: 2rem;
        cursor: pointer;
    }

    .camera-preview {
        flex: 1;
        position: relative;
        overflow: hidden;
    }

    #cameraVideo {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .camera-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
    }

    .scan-frame {
        width: 80%;
        height: 60%;
        border: 3px solid #4CAF50;
        border-radius: 10px;
        box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.3);
    }

    .scan-instructions {
        position: absolute;
        bottom: 100px;
        color: white;
        background: rgba(0, 0, 0, 0.7);
        padding: 0.5rem 1rem;
        border-radius: 5px;
        font-size: 0.9rem;
    }

    .camera-controls {
        display: flex;
        justify-content: space-around;
        align-items: center;
        padding: 2rem 1rem;
        background: rgba(255, 255, 255, 0.1);
    }

    .camera-btn {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        border: none;
        background: rgba(255, 255, 255, 0.2);
        color: white;
        font-size: 1.5rem;
        cursor: pointer;
        transition: all 0.3s ease;
    }

    .camera-btn:hover {
        background: rgba(255, 255, 255, 0.3);
        transform: scale(1.1);
    }

    .capture-btn {
        width: 80px;
        height: 80px;
        font-size: 2rem;
        background: #4CAF50;
    }

    .camera-status {
        text-align: center;
        color: white;
        padding: 0.5rem;
        font-size: 0.9rem;
    }

    @media (max-width: 768px) {
        .camera-container {
            border-radius: 0;
        }
        
        .scan-frame {
            width: 90%;
            height: 50%;
        }
        
        .camera-controls {
            padding: 1rem;
        }
    }
</style>
`;

// Injecter les styles
document.head.insertAdjacentHTML('beforeend', cameraStyles);