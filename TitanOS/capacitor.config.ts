module.exports = {
  appId: 'com.titanos.myapp',
  appName: 'TitanOS',
  webDir: 'dist',
  bundledWebRuntime: false,
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      autoHide: true,
    },
    StatusBar: {
      style: 'DARK',
    },
  },
  server: {
    androidScheme: 'https',
  },
};