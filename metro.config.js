// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

const isProduction = process.env.NODE_ENV === 'production';

config.transformer = {
  ...config.transformer,
  minifierConfig: {
    compress: {
      drop_console: isProduction,
    },
  },
};

module.exports = config;
