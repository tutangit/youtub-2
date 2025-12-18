import React, { useState, useEffect, useRef } from 'react';
import { Upload, Trash2, Play, Pause, Library, Music, Download } from 'lucide-react';
import { saveSong, getAllSongs, deleteSong } from './db';

// Variável global para manter o Blob vivo e evitar ERR_FILE_NOT_FOUND
let activeBlobUrl = null;

const OfflineLibrary = () => {
    const [songs, setSongs] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [playingId, setPlayingId] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [ytUrl, setYtUrl] = useState('');
    const audioRef = useRef(null);

    useEffect(() => {
        loadSongs();
        return () => {
            if (activeBlobUrl) URL.revokeObjectURL(activeBlobUrl);
        };
    }, []);

    const loadSongs = async () => {
        const allSongs = await getAllSongs();
        setSongs(allSongs);
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploading(true);
        try {
            const buffer = await file.arrayBuffer();
            await saveSong({
                name: file.name,
                type: file.type || 'audio/mpeg',
                size: file.size,
                data: buffer,
                createdAt: Date.now()
            });
            await loadSongs();
            alert('Música salva com sucesso!');
        } catch (error) {
            console.error(error);
            alert('Erro no upload.');
        } finally {
            setUploading(false);
        }
    };

    const handleYTDownload = async () => {
        if (!ytUrl) return;
        setDownloading(true);
        try {
            const response = await fetch(`https://youtub-2.onrender.com/download?url=${encodeURIComponent(ytUrl)}`);
            if (!response.ok) throw new Error('Download failed');

            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = 'youtube-music.mp3';
            if (contentDisposition) {
                const match = contentDisposition.match(/filename="?(.+?)"?$/);
                if (match) filename = decodeURIComponent(match[1]);
            }

            const blob = await response.blob();
            const buffer = await blob.arrayBuffer();
            await saveSong({
                name: filename,
                type: 'audio/mpeg',
                size: blob.size,
                data: buffer,
                createdAt: Date.now()
            });
            await loadSongs();
            setYtUrl('');
            alert('Música baixada!');
        } catch (error) {
            console.error(error);
            alert('Erro no download.');
        } finally {
            setDownloading(false);
        }
    };

    const playSong = async (song) => {
        try {
            if (playingId === song.id && audioRef.current) {
                if (audioRef.current.paused) {
                    audioRef.current.play().then(() => setIsPlaying(true)).catch(() => { });
                } else {
                    audioRef.current.pause();
                    setIsPlaying(false);
                }
                return;
            }

            setPlayingId(song.id);
            setIsPlaying(false);

            // 1. Limpa o blob anterior ANTES de criar o novo
            if (activeBlobUrl) {
                URL.revokeObjectURL(activeBlobUrl);
            }

            // 2. Garante que temos um Buffer
            let buffer = song.data;
            if (buffer instanceof Blob) {
                buffer = await buffer.arrayBuffer();
            }

            // 3. Cria um novo Blob limpo
            const blob = new Blob([buffer], { type: song.type || 'audio/mpeg' });
            activeBlobUrl = URL.createObjectURL(blob);

            // 4. Configura o player manualmente para evitar problemas de sincronia do React
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = activeBlobUrl;
                audioRef.current.load(); // Força o navegador a re-escanear o arquivo

                // Só dá o play quando o navegador confirmar que os metadados (tempo) estão lá
                const onLoadedMetadata = () => {
                    audioRef.current.play()
                        .then(() => setIsPlaying(true))
                        .catch(e => console.warn("Auto-play blocked/failed", e));
                    audioRef.current.removeEventListener('loadedmetadata', onLoadedMetadata);
                };

                audioRef.current.addEventListener('loadedmetadata', onLoadedMetadata);
            }

            if ('mediaSession' in navigator) {
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: song.name,
                    artist: 'Offline',
                    album: 'Premium Player'
                });
            }
        } catch (error) {
            console.error('Erro no Play:', error);
            alert('Erro ao processar áudio.');
            setPlayingId(null);
        }
    };

    const clearLibrary = async () => {
        if (!confirm('Deseja apagar todas as músicas?')) return;
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = "";
        }
        if (activeBlobUrl) URL.revokeObjectURL(activeBlobUrl);
        activeBlobUrl = null;

        const all = await getAllSongs();
        for (const s of all) await deleteSong(s.id);

        setPlayingId(null);
        setIsPlaying(false);
        await loadSongs();
    };

    const handleDelete = async (id) => {
        if (!confirm('Excluir?')) return;
        if (playingId === id) {
            if (audioRef.current) audioRef.current.pause();
            setPlayingId(null);
        }
        await deleteSong(id);
        await loadSongs();
    };

    const formatSize = (bytes) => {
        if (!bytes) return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + ['B', 'KB', 'MB', 'GB'][i];
    };

    return (
        <div className="offline-library-container">
            <div className="offline-actions glass">
                <div className="actions-header">
                    <div className="file-input-wrapper">
                        <button className="btn-upload" disabled={uploading || downloading}>
                            {uploading ? <span className="spinner-small"></span> : <Upload size={20} />}
                            <span>{uploading ? 'Salvando...' : 'Adicionar Local'}</span>
                        </button>
                        <input type="file" accept="audio/*" onChange={handleFileUpload} />
                    </div>
                    <button className="btn-clear" onClick={clearLibrary} title="Limpar Tudo"><Trash2 size={20} /></button>
                </div>

                <div className="divider-or">OU</div>

                <div className="download-section">
                    <div className="input-group">
                        <input
                            type="text"
                            placeholder="Link do YouTube..."
                            value={ytUrl}
                            onChange={(e) => setYtUrl(e.target.value)}
                            disabled={downloading}
                        />
                        <button onClick={handleYTDownload} disabled={downloading || !ytUrl} className="btn-download">
                            {downloading ? <span className="spinner-small"></span> : <Download size={20} />}
                        </button>
                    </div>
                </div>
            </div>

            <div className="library-section">
                <h3 className="section-title"><Library size={18} /> Sua Biblioteca Offline</h3>
                <div className="scrollable-list">
                    {songs.map(song => (
                        <div key={song.id} className={`list-item ${playingId === song.id ? 'active' : ''}`}>
                            <div className="track-main-info" onClick={() => playSong(song)}>
                                <div className="play-icon-wrap">
                                    {(playingId === song.id && isPlaying) ? <Pause size={18} /> : <Play size={18} />}
                                </div>
                                <div className="track-details">
                                    <span className="track-name">{song.name}</span>
                                    <span className="track-meta">{formatSize(song.size)} • Estável</span>
                                </div>
                            </div>
                            <button onClick={() => handleDelete(song.id)} className="icon-button delete"><Trash2 size={16} /></button>
                        </div>
                    ))}
                    {songs.length === 0 && (
                        <div className="empty-state">
                            <Music size={40} />
                            <p>Biblioteca vazia.</p>
                        </div>
                    )}
                </div>
            </div>

            <div className={`mini-player glass ${playingId ? 'visible' : 'hidden'}`}>
                <div className="player-info">
                    <Music size={16} className={isPlaying ? "spinning" : ""} />
                    <span>{isPlaying ? 'Tocando Agora' : 'Pausado'}</span>
                </div>
                <audio
                    ref={audioRef}
                    controls
                    preload="metadata"
                    className="web-audio-player"
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => {
                        setPlayingId(null);
                        setIsPlaying(false);
                    }}
                    onError={(e) => {
                        console.error("Audio error:", e);
                        // Tenta recuperar se for erro de Range (network)
                        if (playingId && audioRef.current && audioRef.current.error && audioRef.current.error.code === 2) {
                            console.log("Tentando recuperar erro de rede/range...");
                            audioRef.current.load();
                        }
                    }}
                />
            </div>
        </div>
    );
};

export default OfflineLibrary;
