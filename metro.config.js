const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Disable fast refresh to prevent excessive refreshing
config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: false,
    },
  }),
};

// Reduce file watching sensitivity
config.watchFolders = [
  require('path').resolve(__dirname, 'app'),
  require('path').resolve(__dirname, 'components'),
  require('path').resolve(__dirname, 'lib'),
  require('path').resolve(__dirname, 'store'),
  require('path').resolve(__dirname, 'contexts'),
  require('path').resolve(__dirname, 'constants'),
  require('path').resolve(__dirname, 'utils'),
];

// More aggressive watching configuration
config.watcher = {
  ...config.watcher,
  additionalExts: [], // Don't watch additional extensions
  ignoreDirs: [
    'node_modules',
    'ios',
    'android',
    '.git',
    'assets',
    'backend',
    'docs',
    'scripts',
    'supabase',
    '.expo',
    '.expo-shared',
  ],
  // Reduce polling frequency
  usePolling: false,
  interval: 1000, // Check for changes every 1 second instead of default
};

module.exports = config;
