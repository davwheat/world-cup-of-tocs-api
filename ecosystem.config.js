module.exports = {
  apps: [
    {
      name: 'WCOTOCs API',
      script: 'index.js',
      watch: true,
      watch_delay: 1000,
      ignore_watch: ['node_modules', 'data', './cup.json', '.git'],
      args: ['--color', '--time'],
    },
  ],
}
