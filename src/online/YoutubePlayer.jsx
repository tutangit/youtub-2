import React, { useState, useEffect } from 'react';
import YouTube from 'react-youtube';
import { Play, Search, ListMusic, Trash2 } from 'lucide-react';

const YoutubePlayer = ({ onTrackEnd }) => {
    const [url, setUrl] = useState('');
    const [videoId, setVideoId] = useState('');
    const [playlist, setPlaylist] = useState([]);
    const [currentTrackIndex, setCurrentTrackIndex] = useState(-1);

    useEffect(() => {
        const savedPlaylist = localStorage.getItem('online_playlist');
        if (savedPlaylist) {
            setPlaylist(JSON.parse(savedPlaylist));
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('online_playlist', JSON.stringify(playlist));
    }, [playlist]);

    const extractVideoId = (input) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = input.match(regExp);
        return (match && match[2].length === 11) ? match[2] : input;
    };

    const addToPlaylist = () => {
        const id = extractVideoId(url);
        if (id && !playlist.includes(id)) {
            setPlaylist([...playlist, id]);
            setUrl('');
            if (currentTrackIndex === -1) {
                setCurrentTrackIndex(playlist.length);
                setVideoId(id);
            }
        }
    };

    const playTrack = (index) => {
        setCurrentTrackIndex(index);
        setVideoId(playlist[index]);
    };

    const removeTrack = (e, index) => {
        e.stopPropagation();
        const newPlaylist = playlist.filter((_, i) => i !== index);
        setPlaylist(newPlaylist);
        if (currentTrackIndex === index) {
            setVideoId('');
            setCurrentTrackIndex(-1);
        } else if (currentTrackIndex > index) {
            setCurrentTrackIndex(currentTrackIndex - 1);
        }
    };

    const onPlayerEnd = (event) => {
        if (currentTrackIndex < playlist.length - 1) {
            playTrack(currentTrackIndex + 1);
        } else {
            onTrackEnd && onTrackEnd();
        }
    };

    const opts = {
        height: '390',
        width: '100%',
        playerVars: {
            autoplay: 1,
        },
    };

    return (
        <div className="online-player-container">
            <div className="search-section">
                <div className="input-group">
                    <input
                        type="text"
                        placeholder="Cole URL ou ID do YouTube"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="modern-input"
                    />
                    <button onClick={addToPlaylist} className="icon-button primary">
                        <Search size={20} />
                    </button>
                </div>
            </div>

            <div className="player-wrapper">
                {videoId ? (
                    <YouTube videoId={videoId} opts={opts} onEnd={onPlayerEnd} className="youtube-player" />
                ) : (
                    <div className="player-placeholder">
                        <Play size={48} className="placeholder-icon" />
                        <p>Selecione uma música da playlist</p>
                    </div>
                )}
            </div>

            <div className="playlist-section">
                <h3 className="section-title">
                    <ListMusic size={20} /> Playlist Online
                </h3>
                <div className="scrollable-list">
                    {playlist.map((id, index) => (
                        <div
                            key={id + index}
                            className={`list-item ${currentTrackIndex === index ? 'active' : ''}`}
                            onClick={() => playTrack(index)}
                        >
                            <span className="track-info">ID: {id}</span>
                            <button
                                onClick={(e) => removeTrack(e, index)}
                                className="icon-button delete"
                                title="Remover"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                    {playlist.length === 0 && (
                        <p className="empty-message">Sua playlist está vazia.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default YoutubePlayer;
