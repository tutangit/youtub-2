const express = require('express');
const cors = require('cors');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// No Render (Linux), o yt-dlp será baixado no diretório atual
const YTDLP_PATH = path.join(__dirname, 'yt-dlp');

// Função para baixar o yt-dlp se ele não existir
const ensureYtDlp = () => {
    if (!fs.existsSync(YTDLP_PATH)) {
        console.log('yt-dlp not found, downloading...');
        exec(`wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O "${YTDLP_PATH}" && chmod +x "${YTDLP_PATH}"`, (err) => {
            if (err) console.error('Error downloading yt-dlp:', err);
            else console.log('yt-dlp downloaded and ready.');
        });
    }
};

ensureYtDlp();

app.get('/download', async (req, res) => {
    const videoURL = req.query.url;
    if (!videoURL) return res.status(400).send('URL is required');

    let cleanURL = videoURL;
    try {
        const urlObj = new URL(videoURL);
        if (urlObj.searchParams.has('v')) {
            cleanURL = `https://www.youtube.com/watch?v=${urlObj.searchParams.get('v')}`;
        }
    } catch (e) { }

    console.log(`Processing: ${cleanURL}`);

    exec(`"${YTDLP_PATH}" --get-title "${cleanURL}"`, (error, stdout) => {
        let title = 'youtube-audio';
        if (!error && stdout) {
            title = stdout.trim().replace(/[^\w\s]/gi, '');
        }

        res.header('Content-Disposition', `attachment; filename="${title}.mp3"`);
        res.header('Access-Control-Expose-Headers', 'Content-Disposition');

        const ytdlp = spawn(YTDLP_PATH, [
            '-f', 'ba',
            '--no-playlist',
            '-o', '-',
            cleanURL
        ]);

        ytdlp.stdout.pipe(res);

        ytdlp.on('close', (code) => {
            console.log(`Process closed code ${code}`);
        });

        req.on('close', () => ytdlp.kill());
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
