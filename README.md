# 👑 QUEEN VIDA-V3

**Powerful • Smart • Reliable**

A multi-device WhatsApp automation bot for group management and everyday utilities — built on [Baileys](https://github.com/WhiskeySockets/Baileys).

## ✨ Features

- Group moderation — kick, promote, demote, mute, warn, antilink, antispam, badwords filter
- Utilities — sticker maker, TikTok/media downloader, lyrics lookup, weather, polls, VCF export
- Fun — mini-games (trivia, guess, scramble), quotes, status view/download
- Owner tools — change bot profile name/bio/picture, broadcast (tagall), block/unblock

## 🚀 Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Set your phone number for pairing (as an environment variable, e.g. in a `.env` file):
   ```
   PHONE_NUMBER=2348138558590
   ```
3. Start the bot:
   ```bash
   npm start
   ```
4. Enter the pairing code shown in your terminal into WhatsApp on your linked device.

## ⚙️ Configuration

- **Owner number:** set in `index.js` (`CREATOR_NUMBERS`) and mirrored across files in `/commands`.
- **Bot mode:** `bot_mode.json` — `public` or `private`.
- **Channel link:** update `CHANNEL_TEXT_LINK` in `index.js` / `commands/menu.js`.

## 📢 Community

Join the QUEEN VIDA WhatsApp channel:
https://whatsapp.com/channel/0029Vb8hHHs30LKXQEb4xe38

## 📄 License

For personal use. Please don't redistribute as your own without permission.
