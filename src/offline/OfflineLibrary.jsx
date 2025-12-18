import React, { useState, useEffect, useRef } from 'react';
import { Upload, Trash2, Play, Pause, Lock, Music, Download } from 'lucide-react';
import { saveSong, getAllSongs, deleteSong } from './db';
import { encryptData, decryptData } from './crypto';

const OfflineLibrary = () => {
    const [songs, setSongs] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [playingId, setPlayingId] = useState(null);
    const [audioUrl, setAudioUrl] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [ytUrl, setYtUrl] = useState('');
    const audioRef = useRef(null);

    useEffect(() => {
        loadSongs();
        return () => {
            if (audioUrl) URL.revokeObjectURL(audioUrl);
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
            const encrypted = await encryptData(file);
            await saveSong({
                name: file.name,
                type: file.type,
                size: file.size,
                data: encrypted,
                createdAt: Date.now()
            });
            await loadSongs();
            alert('Upload concluído!');
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
            const encrypted = await encryptData(blob);
            await saveSong({
                name: filename,
                type: 'audio/mpeg',
                size: blob.size,
                data: encrypted,
                createdAt: Date.now()
            });
            await loadSongs();
            setYtUrl('');
            alert('Download concluído!');
        } catch (error) {
            console.error(error);
            alert('Erro no download.');
        } finally {
            setDownloading(false);
        }
    };

    const clearLibrary = async () => {
        if (!confirm('Limpar biblioteca?')) return;
        const all = await getAllSongs();
        for (const s of all) await deleteSong(s.id);
        setPlayingId(null);
        setAudioUrl(null);
        await loadSongs();
    };

    const playSong = async (song) => {
        try {
            if (playingId === song.id && audioRef.current) {
                if (audioRef.current.paused) audioRef.current.play();
                else audioRef.current.pause();
                return;
            }

            // Inicia nova música
            setPlayingId(song.id);
            setIsPlaying(false);

            const decryptedBuffer = await decryptData(song.data);
            const mimeType = song.type || 'audio/mpeg';

            // Cria URL sem revogar a antiga imediatamente (evita ERR_FILE_NOT_FOUND)
            const oldUrl = audioUrl;

            // Tenta usar MediaSource
            if ('MediaSource' in window && MediaSource.isTypeSupported(mimeType)) {
                const ms = new MediaSource();
                const url = URL.createObjectURL(ms);
                setAudioUrl(url);

                ms.addEventListener('sourceopen', () => {
                    const sb = ms.addSourceBuffer(mimeType);
                    sb.appendBuffer(decryptedBuffer);
                    sb.onupdateend = () => {
                        if (ms.readyState === 'open') ms.endOfStream();
                        if (oldUrl) URL.revokeObjectURL(oldUrl);
                    };
                }, { once: true });
            } else {
                // Fallback para Blob tradicional se MSE não suportar o codec
                const blob = new Blob([decryptedBuffer], { type: mimeType });
                const url = URL.createObjectURL(blob);
                setAudioUrl(url);
                if (oldUrl) setTimeout(() => URL.revokeObjectURL(oldUrl), 1000);
            }

            if ('mediaSession' in navigator) {
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: song.name,
                    artist: 'Offline',
                    album: 'Secure Player'
                });
            }
        } catch (error) {
            console.error('Erro Play:', error);
            alert('Erro ao carregar áudio.');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Excluir?')) return;
        await deleteSong(id);
        if (playingId === id) {
            setAudioUrl(null);
            setPlayingId(null);
        }
        await loadSongs();
    };

    const formatSize = (bytes) => {
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
                            <span>{uploading ? 'Segurando...' : 'Upload Local'}</span>
                        </button>
                        <input type="file" accept="audio/*" onChange={handleFileUpload} />
                    </div>
                    <button className="btn-clear" onClick={clearLibrary}><Trash2 size={20} /></button>
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
                <h3 className="section-title"><Lock size={18} /> Sua Biblioteca Offline</h3>
                <div className="scrollable-list">
                    {songs.map(song => (
                        <div key={song.id} className={`list-item ${playingId === song.id ? 'active' : ''}`}>
                            <div className="track-main-info" onClick={() => playSong(song)}>
                                <div className="play-icon-wrap">
                                    {(playingId === song.id && isPlaying) ? <Pause size={18} /> : <Play size={18} />}
                                </div>
                                <div className="track-details">
                                    <span className="track-name">{song.name}</span>
                                    <span className="track-meta">{formatSize(song.size)} • AES-GCM</span>
                                </div>
                            </div>
                            <button onClick={() => handleDelete(song.id)} className="icon-button delete"><Trash2 size={16} /></button>
                        </div>
                    ))}
                </div>
            </div>

            {playingId && audioUrl && (
                <div className="mini-player glass">
                    <div className="player-info">
                        <Music size={16} className={isPlaying ? "spinning" : ""} />
                        <span>{isPlaying ? 'Tocando Offline' : 'Pausado'}</span>
                    </div>
                    <audio
                        ref={audioRef}
                        src={audioUrl}
                        controls
                        autoPlay
                        className="web-audio-player"
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onEnded={() => {
                            setPlayingId(null);
                            setIsPlaying(false);
                        }}
                    />
                </div>
            )}
        </div>
    );
};

export default OfflineLibrary;
