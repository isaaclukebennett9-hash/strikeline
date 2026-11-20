// Build the Windows installer into <home>/StrikelineBuild (outside OneDrive, so big build files don't sync).
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const out = path.join(os.homedir(), 'StrikelineBuild');
const cli = path.join(__dirname, '..', 'node_modules', 'electron-builder', 'cli.js');
execFileSync(process.execPath, [cli, '--win', `-c.directories.output=${out}`], { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
