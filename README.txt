STRIKELINE - multiplayer browser FPS
====================================

START
  Double-click "Start Strikeline.bat". It installs on first run, starts the server
  and opens http://localhost:3080 in your browser. Keep the black window open while playing.
  (Needs Node.js, which is already installed on this PC.)

PLAY WITH A FRIEND
  Same Wi-Fi:  your friend opens the "Friend (LAN)" address shown in the server window,
               e.g. http://192.168.1.23:3080. If Windows Firewall asks, allow Node.js on
               Private networks.
  Over the internet: while the server is running, open another terminal in this folder and run
               npx localtunnel --port 3080
               then send your friend the https link it prints.
  Anyone in the match can change map, bot count and bot difficulty from the Esc menu.

CONTENT
  10 guns  : AR-7 Falcon (AR), M4 Tri-Burst, Vector-K (SMG), Breacher 12 (shotgun),
             SR-25 Marksman (DMR), Longbow .50 (sniper), Hammer M60 (LMG), Thumper RPG,
             plus P9 Viper, Kodiak .44 revolver, Stinger machine pistol, and a knife.
  5 maps   : Foundry, Dune Ruins, Neon District, Frostbite, Killhouse
  10 weapon skins, 8 operator skins
  Free-for-all, first to 30 kills or 10 minutes, then the next map. Bots fill the lobby.

CONTROLS
  WASD move, Mouse aim/shoot, Right-click aim down sights, Shift sprint, Space jump,
  C/Ctrl crouch, R reload, 1/2/3 or wheel switch weapon, V knife, Tab scores, T chat, Esc menu.

FILES
  server.js        match server (players, bots, rockets, scoring)
  shared/          maps, weapons and physics used by both server and browser
  public/          the game client (Three.js)
