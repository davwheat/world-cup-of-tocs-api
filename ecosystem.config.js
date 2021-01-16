module.exports = {
  apps: [
    {
      name: 'WCOTOCs API v2',
      script: 'index.js',
      watch: true,
      watch_delay: 1000,
      ignore_watch: ['node_modules', 'data', './cup.json', '.git', 'access.log'],
      args: ['--color', '--time', '--merge-logs'],
    },
  ],
}
