module.exports = {
  apps: [
    {
      name: 'asesoria-backend',
      script: 'server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '800M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 4000
      }
    }
  ]
};
