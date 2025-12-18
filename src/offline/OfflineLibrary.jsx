import React, { useState, useEffect, useRef } from 'react';
import { Upload, Trash2, Play, Pause, Library, Music, Download } from 'lucide-react';
import { saveSong, getAllSongs, deleteSong } from './db';

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
            await saveSong({
                name: file.name,
                type: file.type || 'audio/mpeg',
                size: file.size,
                data: file, // Salva o arquivo diretamente (Blob)
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
            await saveSong({
                name: filename,
                type: 'audio/mpeg',
                size: blob.size,
                data: blob, // Salva o blob diretamente
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
        if (audioUrl) URL.revokeObjectURL(audioUrl);
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

            // Cria uma URL diretamente do dado salvo
            const url = URL.createObjectURL(song.data);

            // Limpa URL anterior
            if (audioUrl) URL.revokeObjectURL(audioUrl);
            setAudioUrl(url);

            // Força o player a carregar
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = url;
                audioRef.current.load();

                const playPromise = audioRef.current.play();
                if (playPromise !== undefined) {
                    playPromise.then(() => setIsPlaying(true)).catch(e => {
                        console.warn("Playback blocked", e);
                    });
                }
            }

            if ('mediaSession' in navigator) {
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: song.name,
                    artist: 'Offline',
                    album: 'Biblioteca'
                });
            }
        } catch (error) {
            console.error('Erro Play:', error);
            alert('Erro ao tocar a música.');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Excluir?')) return;
        await deleteSong(id);
        if (playingId === id) {
            if (audioUrl) URL.revokeObjectURL(audioUrl);
            setAudioUrl(null);
            setPlayingId(null);
        }
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
                            <span>{uploading ? 'Carregando...' : 'Upload Local'}</span>
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
                                    <span className="track-meta">{formatSize(song.size)} • Áudio Local</span>
                                </div>
                            </div>
                            <button onClick={() => handleDelete(song.id)} className="icon-button delete"><Trash2 size={16} /></button>
                        </div>
                    ))}
                    {songs.length === 0 && (
                        <div className="empty-state">
                            <Music size={40} />
                            <p>Sua biblioteca está vazia.</p>
                        </div>
                    )}
                </div>
            </div>

            <div className={`mini-player glass ${playingId ? 'visible' : 'hidden'}`}>
                <div className="player-info">
                    <Music size={16} className={isPlaying ? "spinning" : ""} />
                    <span>{isPlaying ? 'Tocando Offline' : 'Pausado'}</span>
                </div>
                <audio
                    ref={audioRef}
                    controls
                    className="web-audio-player"
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => {
                        setPlayingId(null);
                        setIsPlaying(false);
                    }}
                />
            </div>
        </div>
    );
};

export default OfflineLibrary;
