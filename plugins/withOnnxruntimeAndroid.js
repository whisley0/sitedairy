// Custom Expo config plugin: register OnnxruntimePackage in MainApplication.kt.
//
// onnxruntime-react-native (1.24.3) ships a `unimodule.json`, which makes Expo's
// autolinking skip it, but it uses the legacy ReactPackage pattern so it is never
// registered on the RN side either. The result is `NativeModules.Onnxruntime === null`
// and a "Cannot read property 'install' of null" crash at startup
// (microsoft/onnxruntime#29004). The bundled app.plugin.js only patches the Gradle
// dependency + Podfile, not MainApplication, so we add the package manually here.
//
// This runs idempotently during `expo prebuild` (managed safe via mergeContents tags).
const { withMainApplication } = require('@expo/config-plugins');
const generateCode = require('@expo/config-plugins/build/utils/generateCode');

const PACKAGE_FQN = 'ai.onnxruntime.reactnative.OnnxruntimePackage';

const withOnnxruntimeAndroid = (config) =>
  withMainApplication(config, (config) => {
    const main = config.modResults;

    if (main.language !== 'kt') {
      throw new Error(
        `withOnnxruntimeAndroid expected a Kotlin MainApplication but found "${main.language}".`,
      );
    }

    if (main.contents.includes(PACKAGE_FQN)) {
      return config;
    }

    // SDK 56 templates build the list via `PackageList(this).packages.apply { ... }`
    // (the receiver inside the block is the MutableList), so we anchor on that and
    // call `add(...)` directly rather than `packages.add(...)`.
    const anchor = /PackageList\(this\)\.packages\.apply\s*\{/;
    if (!anchor.test(main.contents)) {
      throw new Error(
        'withOnnxruntimeAndroid could not find "PackageList(this).packages.apply {" ' +
          'in MainApplication.kt to register OnnxruntimePackage.',
      );
    }

    main.contents = generateCode.mergeContents({
      src: main.contents,
      newSrc: `          add(${PACKAGE_FQN}())`,
      tag: 'onnxruntime-react-native-package',
      anchor,
      offset: 1,
      comment: '          // onnxruntime-react-native (manual registration, see plugins/withOnnxruntimeAndroid.js)',
    }).contents;

    return config;
  });

module.exports = withOnnxruntimeAndroid;
