// Metro config for Site Diary.
// Extends Expo's default config to bundle the on-device CDV classifier models
// (*.onnx) as binary assets so they can be loaded by onnxruntime-react-native.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

if (!config.resolver.assetExts.includes('onnx')) {
  config.resolver.assetExts.push('onnx');
}

module.exports = config;
