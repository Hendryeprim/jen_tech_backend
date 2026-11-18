module.exports = {
  apps: [
    {
      name: 'jentech-backend',
      script: 'src/server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 5005,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5005,
      },
      watch: false,
      max_memory_restart: '500M',
      time: true,
    },
  ],
};
