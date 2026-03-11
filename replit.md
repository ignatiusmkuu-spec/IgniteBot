# IgniteBot — WhatsApp Bot

A WhatsApp bot built with Node.js and the Baileys library. Connects to WhatsApp Web via QR code scan and responds to commands.

## Architecture

- **Runtime**: Node.js 20
- **WhatsApp library**: @whiskeysockets/baileys (WhatsApp Web API)
- **Web server**: Express (serves QR code UI and status)
- **Port**: 5000 (Replit) / `process.env.PORT` (Heroku)

## Files

- `index.js` — Main bot logic + Express web server
- `package.json` — Dependencies and scripts
- `Procfile` — Heroku deployment configuration
- `.gitignore` — Excludes auth session and node_modules
- `auth_info_baileys/` — Created at runtime, stores WhatsApp session (auto-created, gitignored)

## How It Works

1. Start the bot with `node index.js`
2. A QR code is displayed in the web preview and in the terminal
3. Scan with WhatsApp (Menu → Linked Devices → Link a Device)
4. Once connected, the bot listens for messages starting with `!`

## Bot Commands

| Command | Description |
|---------|-------------|
| `!ping` | Check if the bot is alive |
| `!hello` | Get a greeting message |
| `!help` | List all commands |
| `!time` | Show current server time |
| `!echo [text]` | Echo the text back |

## Heroku Deployment

1. Push to a GitHub repo
2. Create a Heroku app and connect the repo
3. The `Procfile` handles startup: `web: node index.js`
4. Visit the Heroku app URL to scan the QR code

## Re-authentication

If the bot gets logged out, it automatically deletes the `auth_info_baileys/` folder and shows a new QR code.

## Development Notes

- Session credentials are saved in `auth_info_baileys/` (created automatically)
- The web server auto-refreshes every 5 seconds while showing the QR code
- Pino logger is set to `silent` to keep terminal output clean
