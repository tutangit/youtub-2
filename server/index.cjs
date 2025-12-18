const express = require('express');
const cors = require('cors');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const app = express();

// Render define a porta automaticamente na variável de ambiente PORT
const PORT = process.env.PORT || 3001;

// Configuração robusta de CORS
app.use(cors({
    origin: '*', // Permite qualquer origem (ideal para o APK)
    exposedHeaders: ['Content-Disposition']
}));

app.use(express.json());

const YTDLP_PATH = path.join(__dirname, 'yt-dlp');

// Rota de Boas-vindas/Saúde
app.get('/', (req, res) => {
    res.send('Music Player Download Server is Online! 🎵');
});

// Função para garantir que o yt-dlp existe no ambiente Linux
const ensureYtDlp = () => {
    if (!fs.existsSync(YTDLP_PATH)) {
        console.log('yt-dlp not found, downloading for Linux...');
        // Comando para baixar o binário do Linux
        const downloadCmd = `curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o "${YTDLP_PATH}" && chmod +x "${YTDLP_PATH}"`;

        exec(downloadCmd, (err, stdout, stderr) => {
            if (err) {
                console.error('CRITICAL: Error downloading yt-dlp:', err);
            } else {
                console.log('yt-dlp downloaded successfully.');
            }
        });
    } else {
        console.log('yt-dlp binary is already present.');
    }
};

ensureYtDlp();

app.get('/download', async (req, res) => {
    const videoURL = req.query.url;
    if (!videoURL) {
        return res.status(400).send('URL is required');
    }

    // Limpeza de URL para focar no vídeo e ignorar lógicas de playlist que podem travar
    let cleanURL = videoURL;
    try {
        const urlObj = new URL(videoURL);
        if (urlObj.searchParams.has('v')) {
            cleanURL = `https://www.youtube.com/watch?v=${urlObj.searchParams.get('v')}`;
        }
    } catch (e) { }

    console.log(`Request received for: ${cleanURL}`);

    // Verifica se o binário existe antes de tentar rodar
    if (!fs.existsSync(YTDLP_PATH)) {
        return res.status(500).send('Server is still initializing (yt-dlp downloading). Please retry in 10 seconds.');
    }

    // Tentar obter o título
    exec(`"${YTDLP_PATH}" --get-title "${cleanURL}"`, (error, stdout) => {
        let title = 'youtube-audio';
        if (!error && stdout) {
            title = stdout.trim().replace(/[^\w\s]/gi, '');
        }

        console.log(`Starting stream: ${title}`);

        res.header('Content-Disposition', `attachment; filename="${title}.mp3"`);

        const ytdlp = spawn(YTDLP_PATH, [
            '-f', 'ba',
            '--no-playlist',
            '--buffer-size', '16K',
            '-o', '-',
            cleanURL
        ]);

        ytdlp.stdout.pipe(res);

        ytdlp.stderr.on('data', (data) => {
            // Logs de erro do yt-dlp úteis para o log do Render
            console.error(`yt-dlp: ${data}`);
        });

        ytdlp.on('close', (code) => {
            console.log(`yt-dlp process closed with code ${code}`);
        });

        req.on('close', () => {
            console.log('Client aborted request, killing yt-dlp process.');
            ytdlp.kill();
        });
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
