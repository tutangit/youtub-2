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
            alert('Música criptografada e salva com sucesso!');
        } catch (error) {
            console.error('Erro no upload:', error);
            alert('Falha ao processar o arquivo.');
        } finally {
            setUploading(false);
        }
    };

    const handleYTDownload = async () => {
        if (!ytUrl) return;
        setDownloading(true);
        try {
            const RENDER_URL = 'https://youtub-2.onrender.com';
            const response = await fetch(`${RENDER_URL}/download?url=${encodeURIComponent(ytUrl)}`);
            if (!response.ok) throw new Error('Download failed');

            const contentDispositionHeader = response.headers.get('Content-Disposition');
            let filename = 'youtube-song.mp3';
            if (contentDispositionHeader) {
                const match = contentDispositionHeader.match(/filename="?(.+?)"?$/);
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
            alert('Música baixada e criptografada com sucesso!');
        } catch (error) {
            console.error('Erro no download:', error);
            alert('Erro ao baixar música. Verifique o link e tente novamente.');
        } finally {
            setDownloading(false);
        }
    };

    const clearLibrary = async () => {
        if (!confirm('Deseja apagar todas as músicas?')) return;
        const allSongs = await getAllSongs();
        for (const s of allSongs) {
            await deleteSong(s.id);
        }
        await loadSongs();
        setAudioUrl(null);
        setPlayingId(null);
    };

    const playSong = async (song) => {
        try {
            if (playingId === song.id && audioRef.current) {
                if (audioRef.current.paused) {
                    await audioRef.current.play().catch(() => { });
                } else {
                    audioRef.current.pause();
                }
                return;
            }

            if (audioUrl) {
                audioRef.current.pause();
                URL.revokeObjectURL(audioUrl);
            }

            const decryptedBuffer = await decryptData(song.data);
            const audioBlob = new Blob([decryptedBuffer], { type: song.type || 'audio/mpeg' });
            const url = URL.createObjectURL(audioBlob);

            setAudioUrl(url);
            setPlayingId(song.id);

            // Reseta e toca o áudio
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = url;
                audioRef.current.load();
                audioRef.current.oncanplay = async () => {
                    await audioRef.current.play().catch(e => console.warn(e));
                    audioRef.current.oncanplay = null;
                };
            }

            if ('mediaSession' in navigator) {
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: song.name,
                    artist: 'Offline',
                    album: 'Secured'
                });
            }
        } catch (error) {
            console.error(error);
            alert('Erro ao tocar música. Tente baixar novamente.');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Excluir esta música?')) return;
        await deleteSong(id);
        if (playingId === id) {
            audioRef.current.pause();
            setAudioUrl(null);
            setPlayingId(null);
        }
        await loadSongs();
    };

    const formatSize = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + ['B', 'KB', 'MB', 'GB'][i];
    };

    return (
        <div className="offline-library-container">
            <div className="offline-actions glass">
                <div className="actions-header">
                    <div className="file-input-wrapper">
                        <button className="btn-upload" disabled={uploading || downloading}>
                            {uploading ? <span className="spinner-small"></span> : <Upload size={20} />}
                            <span>Upload Local</span>
                        </button>
                        <input type="file" accept="audio/*" onChange={handleFileUpload} />
                    </div>

                    <button className="btn-clear" onClick={clearLibrary} title="Limpar Tudo">
                        <Trash2 size={20} />
                    </button>
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

            <audio ref={audioRef} style={{ display: 'none' }} preload="auto" />

            <div className="library-section">
                <h3 className="section-title">
                    <Lock size={18} /> Músicas Criptografadas
                </h3>
                <div className="scrollable-list">
                    {songs.map(song => (
                        <div key={song.id} className={`list-item ${playingId === song.id ? 'active' : ''}`}>
                            <div className="track-main-info" onClick={() => playSong(song)}>
                                <div className="play-icon-wrap">
                                    {playingId === song.id && !audioRef.current?.paused ? <Pause size={18} /> : <Play size={18} />}
                                </div>
                                <div className="track-details">
                                    <span className="track-name">{song.name}</span>
                                    <span className="track-meta">{formatSize(song.size)} • AES-GCM</span>
                                </div>
                            </div>
                            <button onClick={() => handleDelete(song.id)} className="icon-button delete">
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

            {audioUrl && (
                <div className="mini-player glass">
                    <div className="player-info">
                        <Music size={16} className="spinning" />
                        <span>Tocando Offline</span>
                    </div>
                    <audio src={audioUrl} controls autoPlay ref={null} className="web-audio-player" onEnded={() => setPlayingId(null)} />
                </div>
            )}
        </div>
    );
};

export default OfflineLibrary;
