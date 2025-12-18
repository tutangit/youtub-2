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
            // Converte para ArrayBuffer antes de salvar (mais estável no IndexedDB)
            const buffer = await file.arrayBuffer();
            await saveSong({
                name: file.name,
                type: file.type || 'audio/mpeg',
                size: file.size,
                data: buffer,
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
        stopAudio();
        await loadSongs();
    };

    const stopAudio = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = "";
        }
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
        setPlayingId(null);
        setIsPlaying(false);
    };

    const playSong = async (song) => {
        try {
            if (playingId === song.id && audioRef.current) {
                if (audioRef.current.paused) audioRef.current.play().catch(() => { });
                else audioRef.current.pause();
                return;
            }

            // Para o que está tocando
            if (audioUrl) URL.revokeObjectURL(audioUrl);

            // Recria o Blob a partir do ArrayBuffer
            // MUITO IMPORTANTE: Garante que o tipo seja áudio para o navegador não rejeitar
            const blob = new Blob([song.data], { type: song.type || 'audio/mpeg' });
            const url = URL.createObjectURL(blob);

            setAudioUrl(url);
            setPlayingId(song.id);
            setIsPlaying(false);

            // Deixa o React atualizar o <audio src={audioUrl}>
            // O autoPlay vai cuidar do resto.
        } catch (error) {
            console.error('Erro Play:', error);
            alert('Erro ao carregar áudio.');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Excluir?')) return;
        if (playingId === id) stopAudio();
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
                            <span>{uploading ? 'Processando...' : 'Upload Local'}</span>
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
                                    <span className="track-meta">{formatSize(song.size)} • Áudio Salvo</span>
                                </div>
                            </div>
                            <button onClick={() => handleDelete(song.id)} className="icon-button delete" title="Remover"><Trash2 size={16} /></button>
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
                    onEnded={() => stopAudio()}
                    onError={(e) => {
                        console.error("Erro no elemento de áudio:", e);
                        if (playingId) alert("Erro ao reproduzir este arquivo. Ele pode estar corrompido.");
                    }}
                />
            </div>
        </div>
    );
};

export default OfflineLibrary;
