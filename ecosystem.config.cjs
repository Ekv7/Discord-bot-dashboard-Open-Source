// Starten:  pm2 start ecosystem.config.cjs
// Stoppen:  pm2 stop mynex
// Logs:     pm2 logs mynex
// Status:   pm2 status
//
// Umgebungsvariablen: index.js laedt .env per dotenv (cwd = Projektroot).
// NODE_ENV wird hier auf production gesetzt.

module.exports = {
    apps: [
        {
            name: 'mynex',
            script: 'index.js',
            cwd: __dirname,
            interpreter: 'node',
            watch: false,
            autorestart: true,
            max_restarts: 10,
            restart_delay: 3000,
            error_file: 'logs/pm2-error.log',
            out_file: 'logs/pm2-out.log',
            merge_logs: true,
            time: true,
            env: {
                NODE_ENV: 'production',
            },
        },
    ],
};
