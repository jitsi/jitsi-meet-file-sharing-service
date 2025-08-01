module.exports = {
  apps: [{
    name: 'jitsi-meet-file-sharing-service',
    script: './dist/index.js',
    instances: 1,
    exec_mode: 'fork',
    log_file: './logs/app.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    max_memory_restart: '1G',
    restart_delay: 5000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
