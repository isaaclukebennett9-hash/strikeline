// Makes "Strikeline Admin" shortcuts on the Desktop and in the Start menu (npm run admin:shortcut).
// They start the admin app from this folder with the Electron that npm installed. Paths are worked out on
// this PC when it runs, so nothing personal is stored in the repo.
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const electron = path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
if (!fs.existsSync(electron)) { console.error('Electron is missing: run "npm install" in this folder first.'); process.exit(1); }
const ps = `
$ErrorActionPreference = 'Stop'
$sh = New-Object -ComObject WScript.Shell
$places = @([Environment]::GetFolderPath('Desktop'), (Join-Path ([Environment]::GetFolderPath('Programs')) 'Strikeline'))
foreach ($dir in $places) {
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
  $l = $sh.CreateShortcut((Join-Path $dir 'Strikeline Admin.lnk'))
  $l.TargetPath = $env:SL_ELECTRON
  $l.Arguments = '"' + $env:SL_MAIN + '"'
  $l.WorkingDirectory = $env:SL_ROOT
  $l.IconLocation = $env:SL_ICON + ',0'
  $l.Description = 'Strikeline server admin: players, bans, lobbies, chat, console'
  $l.Save()
  Write-Output (Join-Path $dir 'Strikeline Admin.lnk')
}`;
const out = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], {
  env: { ...process.env, SL_ELECTRON: electron, SL_MAIN: path.join(__dirname, 'admin.cjs'), SL_ROOT: ROOT, SL_ICON: path.join(__dirname, 'admin-icon.ico') },
  encoding: 'utf8',
});
console.log('Made shortcuts:\n' + out.trim());
