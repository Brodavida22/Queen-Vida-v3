const fs = require('fs');
const path = require('path');
const { getMode } = require('../utils/mode');

const CREATOR_NAME = "QUEEN VIDA";
const DISPLAY_CREATOR_NUMBER = "2348138558590";
const CHANNEL_TEXT_LINK = '\n\n📢 *Join QUEEN VIDA Channel:*\nhttps://whatsapp.com/channel/0029Vb8hHHs30LKXQEb4xe38';

module.exports = {
    name: 'menu',
    description: 'Displays the main command categories and bot status dashboard',
    async execute(sock, m, from) {
        const botMode = getMode().toUpperCase();
        let menuText = 
`┏━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┓\n` +
`┃ 🤖 *Status:* Online & Active\n` +
`┃ ⚙️ *Mode:* ${botMode}\n` +
`┃ 👤 *Creator:* ${CREATOR_NAME} (https://wa.me/${DISPLAY_CREATOR_NUMBER})\n` +
`┣━━━━━━━━━━━━━━━━━━━━━━━\n` +
`┃ *📋 COMMAND CATEGORIES*\n` +
`┣━━━━━━━━━━━━━━━━━━━━━━━\n` +
`┃ 🤖 *1. Artificial Intelligence*\n` +
`┃ • *!ai <query>*\n` +
`┃   _Description: Chat with official Gemini AI._\n` +
`┃\n` +
`┃ 📥 *2. Media Downloader*\n` +
`┃ • *!tik <url>*\n` +
`┃   _Description: Download videos from TikTok without watermark._\n` +
`┃ • *!music <song/link>*\n` +
`┃   _Description: Download high-quality music track._\n` +
`┃\n` +
`┃ 👑 *3. Owner & Creator Commands*\n` +
`┃ • *!mode public/private*\n` +
`┃ • *!creategroup <name>*\n` +
`┃ • *!join <invite link>*\n` +
`┃ • *!leave*\n` +
`┃ • *!changename <new name>*\n` +
`┃ • *!changebio <new bio>*\n` +
`┃ • *!block / !unblock*\n` +
`┃\n` +
`┃ 🛡️ *4. Group Management & Security* *(Admin/Creator Only)*\n` +
`┃ • *!agm [on/off]* - Toggle Anti-Group-Mention protection\n` +
`┃ • *!del* - Delete replied message instantly\n` +
`┃ • *!groupinfo* - Group details & link\n` +
`┃ • *!tagadmins <msg>* - Alert all admins\n` +
`┃ • *!hidetag <msg>* - Broadcast hidden tag\n` +
`┃ • *!setpp* - Update group profile picture\n` +
`┃ • *!afk <reason>* - Set away status\n` +
`┃ • *!getpp* - Fetch user profile picture\n` +
`┃ • *!tts <text>* - Convert text to voice note\n` +
`┃ • *!setgroupname <name>* - Update group title\n` +
`┃ • *!setgroupdesc <desc>* - Update group description\n` +
`┃ • *!reaction on/off* - Toggle auto context-aware reactions *(Admins/Creator)*\n` +
`┃ • *!active* / *!topmembers* - Activity leaderboard\n` +
`┃ • *!antilink* / *!antispam* / *!badwords*\n` +
`┃ • *!warn / !warnings* / *!promote / !demote*\n` +
`┃ • *!tagall* / *!add / !kick* / *!mute / !unmute*\n` +
`┃\n` +
`┃ 🛠️ *5. Utilities & Fun Tools*\n` +
`┃ • *!game* - Interactive group mini-games suite *(Trivia, Scramble, Guess)*\n` +
`┃ • *!define <word>* - Dictionary search\n` +
`┃ • *!lyrics <song>* - Search song lyrics\n` +
`┃ • *!sticker* (or *!s*) - Convert media to sticker\n` +
`┃ • *!weather <city>* - Live weather updates\n` +
`┃ • *!calc <expr>* - Math solver\n` +
`┃ • *!vcf* - Export all group contacts into a VCF contact file\n` +
`┃ • *!repo* - View official GitHub repository link & source code\n` +
`┃ • *!update* - Pull updates directly from official repository *(Creator/Bot Only)*\n` +
`┃ • *!quote* / *!poll*\n` +
`┃\n` +
`┃ 🏓 *6. General Utilities*\n` +
`┃ • *!ping* - System latency check\n` +
`┃ • *!botcreator* - View creator contact link\n` +
`┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛\n` +
`> _Powered by ${CREATOR_NAME} (${DISPLAY_CREATOR_NUMBER})_` + CHANNEL_TEXT_LINK;

        const bannerPath = path.join(__dirname, '..', 'banner.png');
        if (fs.existsSync(bannerPath)) {
            try {
                const imageBuffer = fs.readFileSync(bannerPath);
                await sock.sendMessage(from, {
                    image: imageBuffer,
                    caption: menuText
                }, { quoted: m });
                return;
            } catch (err) {
                console.error('Failed to send banner image, falling back to text menu:', err.message);
            }
        }
        
        await sock.sendMessage(from, { text: menuText }, { quoted: m });
    }
};
