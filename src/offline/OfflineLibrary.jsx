import React, { useState, useEffect, useRef } from 'react';
import { Upload, Trash2, Play, Pause, Library, Music, Download, AlertTriangle } from 'lucide-react';
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
            if (audioUrl && audioUrl.startsWith('blob:')) URL.revokeObjectURL(audioUrl);
        };
    }, []);

    const loadSongs = async () => {
        const allSongs = await getAllSongs();
        setSongs(allSongs);
    };

    // Helper para converter Buffer em Data URL (Base64)
    // Resolve problemas de "Range Not Satisfiable" e "00:00" em PWAs
    const bufferToDataUrl = (buffer, type) => {
        return new Promise((resolve) => {
            const blob = new Blob([buffer], { type });
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
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
            alert('Música adicionada à biblioteca!');
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
                type: blob.type || 'audio/mpeg',
                size: blob.size,
                data: buffer,
                createdAt: Date.now()
            });
            await loadSongs();
            setYtUrl('');
            alert('Download concluído com sucesso!');
        } catch (error) {
            console.error(error);
            alert('Erro ao baixar áudio.');
        } finally {
            setDownloading(false);
        }
    };

    const stopAudio = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = "";
            audioRef.current.load();
        }
        if (audioUrl && audioUrl.startsWith('blob:')) URL.revokeObjectURL(audioUrl);
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

            // Exibe carregando
            setPlayingId(song.id);
            setIsPlaying(false);

            // Garante que temos um ArrayBuffer
            let buffer = song.data;
            if (buffer instanceof Blob) {
                buffer = await buffer.arrayBuffer();
            }

            // Converte para Data URL (Base64) - O MÉTODO MAIS ESTÁVEL
            // Isso engana o navegador para não pedir "Range Requests"
            const dataUrl = await bufferToDataUrl(buffer, song.type || 'audio/mpeg');

            if (audioUrl && audioUrl.startsWith('blob:')) URL.revokeObjectURL(audioUrl);
            setAudioUrl(dataUrl);

            // O audio element vai detectar o src novo e os metadados virão juntos
        } catch (error) {
            console.error('Erro ao tocar:', error);
            alert('Erro ao processar arquivo para tocar.');
            setPlayingId(null);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Deseja excluir esta música?')) return;
        if (playingId === id) stopAudio();
        await deleteSong(id);
        await loadSongs();
    };

    const clearLibrary = async () => {
        if (!confirm('ATENÇÃO: Isso apagará TODA a biblioteca permanentemente. Continuar?')) return;
        stopAudio();
        const all = await getAllSongs();
        for (const s of all) await deleteSong(s.id);
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
                            <span>{uploading ? 'Processando...' : 'Adicionar Local'}</span>
                        </button>
                        <input type="file" accept="audio/*" onChange={handleFileUpload} />
                    </div>
                    <button className="btn-clear" onClick={clearLibrary} title="Esvaziar Biblioteca">
                        <Trash2 size={20} />
                    </button>
                </div>

                <div className="divider-or">OU</div>

                <div className="download-section">
                    <div className="input-group">
                        <input
                            type="text"
                            placeholder="Cole o link do YouTube aqui..."
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
                <h3 className="section-title"><Library size={18} /> Sua Música Offline</h3>
                <div className="scrollable-list">
                    {songs.map(song => (
                        <div key={song.id} className={`list-item ${playingId === song.id ? 'active' : ''}`}>
                            <div className="track-main-info" onClick={() => playSong(song)}>
                                <div className="play-icon-wrap">
                                    {(playingId === song.id && isPlaying) ? <Pause size={18} /> : <Play size={18} />}
                                    {playingId === song.id && !isPlaying && <div className="spinner-extra-small"></div>}
                                </div>
                                <div className="track-details">
                                    <span className="track-name">{song.name}</span>
                                    <span className="track-meta">{formatSize(song.size)} • PWA Stable</span>
                                </div>
                            </div>
                            <button onClick={() => handleDelete(song.id)} className="icon-button delete" title="Remover">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                    {songs.length === 0 && (
                        <div className="empty-state">
                            <Music size={40} />
                            <p>Biblioteca vazia</p>
                        </div>
                    )}
                </div>
            </div>

            <div className={`mini-player glass ${playingId ? 'visible' : 'hidden'}`}>
                <div className="player-info">
                    <Music size={16} className={isPlaying ? "spinning" : ""} />
                    <span>{isPlaying ? 'Reproduzindo' : 'Carregando...'}</span>
                </div>
                <audio
                    ref={audioRef}
                    src={audioUrl}
                    controls
                    autoPlay
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => stopAudio()}
                    onError={(e) => {
                        console.error("Audio internal error:", e);
                        // Se falhar mesmo com Base64, pode ser o codec do arquivo
                        if (playingId) {
                            alert("Não foi possível reproduzir este arquivo. O formato pode não ser compatível com seu navegador.");
                            stopAudio();
                        }
                    }}
                    className="web-audio-player"
                />
            </div>
        </div>
    );
};

export default OfflineLibrary;
