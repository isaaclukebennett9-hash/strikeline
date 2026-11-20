// Publish an update to GitHub:  node desktop/release.cjs ["what changed"]
//  • game.zip     — the game files (server, shared code, client) + the ws module. Friends' apps download this.
//  • version.json — { version, shell, game, setup } read by the app on start-up.
//  • the installer for this version, if it has been built (npm run dist) — used for app (shell) updates.
// Then commits + pushes the source. The app's own version (shell) only changes when a new installer is built.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;
const notes = process.argv[2] || `Strikeline ${version}`;
const GH = fs.existsSync('C:/Program Files/GitHub CLI/gh.exe') ? 'C:/Program Files/GitHub CLI/gh.exe' : 'gh';
const GIT = fs.existsSync('C:/Program Files/Git/cmd/git.exe') ? 'C:/Program Files/Git/cmd/git.exe' : 'git';
const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, stdio: 'inherit' });

const out = path.join(root, 'release');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);

// game.zip (Windows' built-in tar can write zip files)
const zip = path.join(out, 'game.zip');
run('tar', ['-a', '-c', '-f', zip, 'server.js', 'package.json', 'shared', 'public', 'node_modules/ws']);

// the installer, if this version has been built
const setupDir = path.join(require('os').homedir(), 'StrikelineBuild');
const setupSrc = path.join(setupDir, `Strikeline Setup ${version}.exe`);
const files = [zip];
const REPO = 'isaaclukebennett9-hash/strikeline';
let shell = null;
if (fs.existsSync(setupSrc)) { shell = version; fs.copyFileSync(setupSrc, path.join(out, 'Strikeline-Setup.exe')); files.push(path.join(out, 'Strikeline-Setup.exe')); }
else { // game-only release: keep pointing at the newest released installer
  try { shell = JSON.parse(execFileSync(GH, ['release', 'download', '--pattern', 'version.json', '--output', '-'], { cwd: root }).toString()).shell; } catch {}
}
const setup = shell ? `https://github.com/${REPO}/releases/download/v${shell}/Strikeline-Setup.exe` : null;
fs.writeFileSync(path.join(out, 'version.json'), JSON.stringify({ version, shell, game: 'game.zip', setup }, null, 2));
files.push(path.join(out, 'version.json'));

// commit + push source, then create the release
try { run(GIT, ['add', '-A']); run(GIT, ['commit', '-m', notes]); } catch { console.log('(nothing new to commit)'); }
run(GIT, ['push', 'origin', 'HEAD']);
run(GH, ['release', 'create', `v${version}`, ...files, '--title', `Strikeline ${version}`, '--notes', notes, '--latest']);
console.log(`Released v${version}`);
