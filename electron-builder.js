/**
 * electron-builder config — CommonJS (no "type":"module" in package.json)
 * @type {import('electron-builder').Configuration}
 */
module.exports = {
  appId: 'com.digitalokonma.ghostassist',
  productName: 'GhostAssist AI',
  copyright: 'Copyright © 2025 Digital Okonma Technologies',

  directories: {
    buildResources: 'resources',
    output: 'dist'
  },

  // Use the Electron binary already downloaded by the electron npm package
  // instead of having electron-builder re-download (avoids cache corruption issues)
  electronDist: 'node_modules/electron/dist',

  files: [
    'out/**/*',
    'node_modules/**/*',
    '!node_modules/.cache',
    '!node_modules/**/test/**',
    '!node_modules/**/*.md'
  ],

  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: 'resources/icon.ico',
    requestedExecutionLevel: 'asInvoker'
  },

  nsis: {
    oneClick: false,
    allowElevation: true,
    allowToChangeInstallationDirectory: true,

    // Branding
    installerIcon: 'resources/icon.ico',
    uninstallerIcon: 'resources/icon.ico',
    installerHeaderIcon: 'resources/icon.ico',
    installerSidebar: 'resources/installer-sidebar.bmp',
    installerHeader: 'resources/installer-header.bmp',

    // Screens & shortcuts
    license: 'resources/license.txt',
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'GhostAssist AI',
    menuCategory: 'GhostAssist AI',

    deleteAppDataOnUninstall: true,
    installerLanguages: ['en_US']
  },

  extraMetadata: {
    main: 'out/main/index.js'
  },

  nodeGypRebuild: false,
  buildDependenciesFromSource: false,
  npmRebuild: true
}
