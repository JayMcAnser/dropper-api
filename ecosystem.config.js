module.exports = {
  apps: [
    {
      name: 'DropperApi',
      exec_mode: 'cluster',
      instances: 'max', // Or a number of instances
      script: './index.js'
    }
  ]
}
