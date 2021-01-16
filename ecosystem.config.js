module.exports = {
  apps: [
    {
      name: 'WCOTOCs API v2',
      script: 'index.js',
      log_file: 'combined_pm2.log',
      watch: true,
      watch_delay: 1000,
      ignore_watch: ['node_modules', 'data', './cup.json', '.git', '*.log'],
      args: ['--color', '--time'],
    },
  ],
}
