// audio-preview-service.js
// Ruta real: js/features/social/historias/servicio-musica/audio-preview-service.js
//
// Puerto de audio_preview_service.dart. Singleton de reproducción de
// previews de audio, compartido por toda la UI de selección de
// música (fila de canción, mini-player, carrusel de sugerencias).
//
// DIFERENCIA DE PLATAFORMA — Stream<PlayerState> de just_audio: en
// vez de un Stream, se expone un patrón de suscripción simple sobre
// el <audio> nativo (eventos 'play'/'pause'/'ended'/'error'):
// suscribir(cb) llama a cb() cada vez que cambia el estado de
// reproducción, y devuelve la función para desuscribirse — mismo
// criterio que ya usan otros archivos del proyecto para "reactividad"
// sin un framework de por medio.

class AudioPreviewService {
  constructor() {
    this._audio = new Audio();
    this._audio.preload = 'auto';
    this._urlActual = null;
    this._listeners = new Set();

    this._audio.addEventListener('play', () => this._notificar());
    this._audio.addEventListener('pause', () => this._notificar());
    this._audio.addEventListener('ended', () => {
      this._urlActual = null;
      this._notificar();
    });
    this._audio.addEventListener('error', () => {
      console.error('audio-preview-service: error al reproducir', this._urlActual);
      this._urlActual = null;
      this._notificar();
    });
  }

  get urlActual() {
    return this._urlActual;
  }

  get reproduciendo() {
    return !this._audio.paused && this._urlActual != null;
  }

  /** Expone el elemento <audio> nativo, igual que 'player' en el Dart original (para VerHistoria). */
  get elemento() {
    return this._audio;
  }

  async toggle(previewUrl) {
    if (this._urlActual === previewUrl) {
      if (this._audio.paused) {
        try {
          await this._audio.play();
        } catch (error) {
          console.error('audio-preview-service – reanudar:', error);
        }
      } else {
        this._audio.pause();
      }
      return;
    }

    this._audio.pause();
    this._urlActual = previewUrl;
    this._audio.src = previewUrl;

    try {
      await this._audio.play();
    } catch (error) {
      console.error('audio-preview-service – toggle:', error);
      this._urlActual = null;
      this._notificar();
    }
  }

  detener() {
    this._urlActual = null;
    this._audio.pause();
    this._audio.currentTime = 0;
  }

  dispose() {
    this._listeners.clear();
    this.detener();
  }

  /**
   * @param {() => void} callback - se llama cada vez que cambia play/pause/ended/error.
   * @returns {() => void} función para desuscribirse.
   */
  suscribir(callback) {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  }

  _notificar() {
    this._listeners.forEach((cb) => cb());
  }
}

// Mismo patrón singleton que el '.instance' estático del Dart original.
export const audioPreviewService = new AudioPreviewService();