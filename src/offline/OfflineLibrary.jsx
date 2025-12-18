import React, { useState, useEffect, useRef } from 'react';
import { Upload, Trash2, Play, Pause, Music, Lock, Download, Search } from 'lucide-react';
import { saveSong, getAllSongs, deleteSong } from './db';
import { encryptData, decryptData } from './crypto';

const OfflineLibrary = () => {
    const [songs, setSongs] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [ytUrl, setYtUrl] = useState('');
    const [playingId, setPlayingId] = useState(null);
    const [audioUrl, setAudioUrl] = useState(null);
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
            const encryptedData = await encryptData(file);
            const song = {
                id: crypto.randomUUID(),
                name: file.name,
                type: file.type,
                size: file.size,
                data: encryptedData,
                addedAt: Date.now(),
            };
            await saveSong(song);
            await loadSongs();
        } catch (error) {
            console.error('Erro ao criptografar/salvar arquivo:', error);
            alert('Falha ao processar arquivo.');
        } finally {
            setUploading(false);
            if (e.target) e.target.value = '';
        }
    };

    const handleYTDownload = async () => {
        if (!ytUrl) return;
        setDownloading(true);
        try {
            const RENDER_URL = 'https://youtub-2.onrender.com';
            const response = await fetch(`${RENDER_URL}/download?url=${encodeURIComponent(ytUrl)}`);
            if (!response.ok) throw new Error('Download failed');

            const contentDisposition = response.headers.get('Content-Disposition');
            let fileName = 'youtube-audio.mp3';
            if (contentDisposition && contentDisposition.includes('filename=')) {
                fileName = contentDisposition.split('filename=')[1].replace(/"/g, '');
            }

            const blob = await response.blob();
            const encryptedData = await encryptData(blob);

            const song = {
                id: crypto.randomUUID(),
                name: fileName,
                type: 'audio/mpeg',
                size: blob.size,
                data: encryptedData,
                addedAt: Date.now(),
            };

            await saveSong(song);
            await loadSongs();
            setYtUrl('');
            alert('Música baixada e criptografada com sucesso!');
        } catch (error) {
            console.error('Erro no download:', error);
            alert('Erro ao baixar música. Certifique-se que o backend está rodando.');
        } finally {
            setDownloading(false);
        }
    };

    const playSong = async (song) => {
        try {
            if (playingId === song.id) {
                if (audioRef.current.paused) {
                    await audioRef.current.play().catch(() => { });
                } else {
                    audioRef.current.pause();
                }
                return;
            }

            // Limpa recursos anteriores
            if (audioUrl) {
                audioRef.current.pause();
                audioRef.current.src = "";
                audioRef.current.load();
                URL.revokeObjectURL(audioUrl);
            }

            const decryptedData = await decryptData(song.data);
            const audioBlob = new Blob([decryptedData], { type: song.type || 'audio/mpeg' });
            const url = URL.createObjectURL(audioBlob);

            setAudioUrl(url);
            setPlayingId(song.id);

            // Importante: Aguardar o próximo frame para garantir que o src foi atualizado
            setTimeout(async () => {
                if (audioRef.current) {
                    audioRef.current.src = url;
                    audioRef.current.load();
                    try {
                        await audioRef.current.play();
                    } catch (e) {
                        console.warn("Auto-play bloqueado ou interrompido");
                    }
                }
            }, 50);

            if ('mediaSession' in navigator) {
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: song.name,
                    artist: 'Biblioteca Offline',
                    album: 'Música Protegida',
                });
            }
        } catch (error) {
            console.error('Erro ao tocar música:', error);
            alert('Erro técnico ao processar o arquivo. Tente baixar novamente.');
        }
    };

    const handleDelete = async (id) => {
        if (confirm('Tem certeza que deseja remover esta música?')) {
            await deleteSong(id);
            if (playingId === id) {
                setPlayingId(null);
                setAudioUrl(null);
            }
            await loadSongs();
        }
    };

    const formatSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="offline-library-container">
            <div className="offline-actions glass">
                <div className="upload-section">
                    <label className="upload-label">
                        <input
                            type="file"
                            accept="audio/*"
                            onChange={handleFileUpload}
                            disabled={uploading || downloading}
                            hidden
                        />
                        <div className="upload-button-content">
                            {uploading ? (
                                <div className="spinner"></div>
                            ) : (
                                <Upload size={24} />
                            )}
                            <span>{uploading ? 'Criptografando...' : 'Upload Local'}</span>
                        </div>
                    </label>
                </div>

                <div className="divider-or">OU</div>

                <div className="download-section">
                    <div className="input-group">
                        <input
                            type="text"
                            placeholder="Link do YouTube para salvar offline"
                            value={ytUrl}
                            onChange={(e) => setYtUrl(e.target.value)}
                            className="modern-input"
                            disabled={uploading || downloading}
                        />
                        <button
                            onClick={handleYTDownload}
                            className="icon-button primary"
                            disabled={uploading || downloading || !ytUrl}
                        >
                            {downloading ? <div className="spinner small"></div> : <Download size={20} />}
                        </button>
                    </div>
                </div>
            </div>

            <div className="playback-controls">
                {audioUrl && (
                    <div className="mini-player glass">
                        <div className="player-info">
                            <Music size={18} />
                            <span>Agora tocando (Offline)</span>
                        </div>
                        <audio
                            ref={audioRef}
                            src={audioUrl}
                            controls
                            autoPlay
                            onEnded={() => setPlayingId(null)}
                            className="web-audio-player"
                        />
                    </div>
                )}
            </div>

            <div className="library-section">
                <h3 className="section-title">
                    <Lock size={20} /> Biblioteca Criptografada
                </h3>
                <div className="scrollable-list">
                    {songs.map((song) => (
                        <div
                            key={song.id}
                            className={`list-item ${playingId === song.id ? 'active' : ''}`}
                        >
                            <div className="track-main-info" onClick={() => playSong(song)}>
                                <div className="play-icon-wrap">
                                    {playingId === song.id ? <Pause size={18} /> : <Play size={18} />}
                                </div>
                                <div className="track-details">
                                    <span className="track-name">{song.name}</span>
                                    <span className="track-meta">{formatSize(song.size)} • Secura AES-GCM</span>
                                </div>
                            </div>
                            <button
                                onClick={() => handleDelete(song.id)}
                                className="icon-button delete"
                                title="Remover permanentemente"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                    {songs.length === 0 && (
                        <div className="empty-state">
                            <Music size={48} />
                            <p>Nenhuma música offline encontrada.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OfflineLibrary;
