import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Globe, HardDrive, Music } from 'lucide-react';
import YoutubePlayer from './online/YoutubePlayer';
import OfflineLibrary from './offline/OfflineLibrary';
import './index.css';

function App() {
  const [activeTab, setActiveTab] = useState('online');
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="app-container">
      <header className="header">
        <div className="logo">
          <Music size={28} />
          <span>Antigravity Music</span>
        </div>

        <nav className="nav-tabs">
          <button
            className={`tab-btn ${activeTab === 'online' ? 'active' : ''}`}
            onClick={() => setActiveTab('online')}
          >
            <Globe size={18} />
            <span>Online</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'offline' ? 'active' : ''}`}
            onClick={() => setActiveTab('offline')}
          >
            <HardDrive size={18} />
            <span>Offline</span>
          </button>
        </nav>

        <div className={`status-indicator ${isOnline ? 'online' : 'offline'}`}>
          {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
          <span>{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
        </div>
      </header>

      <main className="content-area">
        {!isOnline && activeTab === 'online' ? (
          <div className="glass empty-state">
            <WifiOff size={48} />
            <h2>Você está Offline</h2>
            <p>O Streaming do YouTube requer conexão com a internet. Mude para a biblioteca Offline para ouvir suas músicas salvas.</p>
            <button className="tab-btn active" onClick={() => setActiveTab('offline')} style={{ marginTop: '1rem' }}>
              Ir para Biblioteca Offline
            </button>
          </div>
        ) : (
          <div className="fade-in">
            {activeTab === 'online' ? (
              <YoutubePlayer />
            ) : (
              <OfflineLibrary />
            )}
          </div>
        )}
      </main>

      <footer style={{ marginTop: '2rem', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
        &copy; 2025 Antigravity Player • Secure AES-GCM Storage
      </footer>
    </div>
  );
}

export default App;
