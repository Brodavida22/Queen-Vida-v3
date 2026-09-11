const fs = require('fs');
const path = require('path');
const { getMode } = require('../utils/mode');

const CREATOR_NAME = 'QUEEN VIDA';
const DISPLAY_CREATOR_NUMBER = '2348138558590';
const VERSION = '3.0.0';
const PREFIX = '!';
const PLAN = 'FREE';

const CHANNEL_TEXT_LINK =
    '\n\n📢 *Join QUEEN VIDA Channel:*\n' +
    'https://whatsapp.com/channel/0029Vb8hHHs30LKXQEb4xe38';

function formatUptime(seconds) {
    seconds = Math.floor(seconds);

    const days = Math.floor(seconds / 86400);
    seconds %= 86400;

    const hours = Math.floor(seconds / 3600);
    seconds %= 3600;

    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;

    const parts = [];

    if (days) parts.push(`${days}d`);
    if (hours || days) parts.push(`${hours}h`);
    if (minutes || hours || days) parts.push(`${minutes}m`);

    parts.push(`${secs}s`);

    return parts.join(' ');
}

function getMood() {
    const moods = [
        '👑 Royal',
        '🔥 Active',
        '😈 Chaotic',
        '💎 Fresh',
        '⚡ Hyper'
    ];

    return moods[Math.floor(Math.random() * moods.length)];
}

function getToday() {
    const now = new Date();

    return {
        time: now.toLocaleTimeString('en-NG', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
            timeZone: 'Africa/Lagos'
        }),

        date: now.toLocaleDateString('en-NG', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            timeZone: 'Africa/Lagos'
        })
    };
}

function commandLine(command, description = '') {
    if (description) {
        return `┃ • *${PREFIX}${command}* — ${description}\n`;
    }

    return `┃ • *${PREFIX}${command}*\n`;
}

module.exports = {
    name: 'menu',

    description:
        'Displays the QUEEN VIDA-V3 command menu and bot information',

    async execute(sock, m, from) {
        const { time, date } = getToday();

        const mode = String(
            getMode() || 'public'
        ).toUpperCase();

        const uptime = formatUptime(process.uptime());

        const userName =
            m.pushName ||
            'User';

        const mood = getMood();

        let menuText = '';

        /*
         * ==============================
         * HEADER
         * ==============================
         */

        menuText +=
`╭━━━〔 👑 *QUEEN VIDA-V3* 👑 〕━━━╮
┃ 👤 *Owner:* ${CREATOR_NAME}
┃ ⚙️ *Version:* v${VERSION}
┃ 🔣 *Prefix:* ${PREFIX}
┃ 🙋 *User:* ${userName}
┃ 💳 *Plan:* ${PLAN}
┃ 🕐 *Time:* ${time}
┃ ⏱️ *Uptime:* ${uptime}
┃ 📅 *Today:* ${date}
┃ 🔐 *Mode:* ${mode}
┃ 😈 *Mood:* ${mood}
╰━━━━━━━━━━━━━━━━━━━━━━╯

`;

        /*
         * ==============================
         * AI
         * ==============================
         */

        menuText += `╭━━〔 🤖 *AI* 〕━━╮\n`;

        menuText += commandLine(
            'ai <query>',
            'Chat with Gemini AI'
        );

        menuText += `╰━━━━━━━━━━━━━━╯\n\n`;

        /*
         * ==============================
         * GROUP
         * ==============================
         */

        menuText += `╭━━〔 🛡️ *GROUP* 〕━━╮\n`;

        menuText += commandLine(
            'add <number>',
            'Add a member'
        );

        menuText += commandLine(
            'agm on/off',
            'Anti-group-mention protection'
        );

        menuText += commandLine(
            'antilink on/off',
            'Anti-link security'
        );

        menuText += commandLine(
            'antispam on/off',
            'Anti-spam protection'
        );

        menuText += commandLine(
            'badwords',
            'Profanity filter'
        );

        menuText += commandLine(
            'clearwarnings',
            'Reset member warnings'
        );

        menuText += commandLine(
            'del',
            'Delete a replied message'
        );

        menuText += commandLine(
            'demote',
            'Demote a group admin'
        );

        menuText += commandLine(
            'groupinfo',
            'Show group information'
        );

        menuText += commandLine(
            'kick',
            'Remove a member'
        );

        menuText += commandLine(
            'mute',
            'Lock group chat'
        );

        menuText += commandLine(
            'poll',
            'Create an interactive poll'
        );

        menuText += commandLine(
            'promote',
            'Promote a member to admin'
        );

        menuText += commandLine(
            'reaction on/off',
            'Toggle automatic reactions'
        );

        menuText += commandLine(
            'tagadmins <msg>',
            'Mention all group admins'
        );

        menuText += commandLine(
            'tagall <msg>',
            'Mention all group members'
        );

        menuText += commandLine(
            'unmute',
            'Unlock group chat'
        );

        menuText += commandLine(
            'vcf',
            'Export group contacts'
        );

        menuText += commandLine(
            'warn',
            'Warn a member'
        );

        menuText += commandLine(
            'warnings',
            'Check warning count'
        );

        menuText += `╰━━━━━━━━━━━━━━╯\n\n`;

        /*
         * ==============================
         * OWNER
         * ==============================
         */

        menuText += `╭━━〔 👑 *OWNER* 〕━━╮\n`;

        menuText += commandLine(
            'block',
            'Block a WhatsApp user'
        );

        menuText += commandLine(
            'botcreator',
            'Creator information'
        );

        menuText += commandLine(
            'broadcast',
            'Broadcast to groups'
        );

        menuText += commandLine(
            'changebio <text>',
            'Change bot bio'
        );

        menuText += commandLine(
            'changename <name>',
            'Change bot name'
        );

        menuText += commandLine(
            'changeprofile',
            'Change bot profile picture'
        );

        menuText += commandLine(
            'creategroup <name>',
            'Create a new group'
        );

        menuText += commandLine(
            'join <link>',
            'Join a group by invite'
        );

        menuText += commandLine(
            'leave',
            'Leave the current group'
        );

        menuText += commandLine(
            'mode public/private',
            'Change bot operating mode'
        );

        menuText += commandLine(
            'statusreactions on/off',
            'Toggle status reactions'
        );

        menuText += commandLine(
            'unblock',
            'Unblock a WhatsApp user'
        );

        menuText += commandLine(
            'update',
            'Pull bot updates'
        );

        menuText += commandLine(
            'viewstatus on/off',
            'Toggle automatic status viewing'
        );

        menuText += `╰━━━━━━━━━━━━━━╯\n\n`;

        /*
         * ==============================
         * FUN
         * ==============================
         */

        menuText += `╭━━〔 🎭 *FUN* 〕━━╮\n`;

        menuText += commandLine(
            'calc <expression>',
            'Calculate an expression'
        );

        menuText += commandLine(
            'game',
            'Open the mini-games dashboard'
        );

        menuText += commandLine(
            'quote',
            'Get a random inspirational quote'
        );

        menuText += `╰━━━━━━━━━━━━━━╯\n\n`;

        /*
         * ==============================
         * ANIME
         * ==============================
         */

        menuText += `╭━━〔 🎌 *ANIME* 〕━━╮\n`;

        menuText +=
            `┃ • No dedicated anime command is installed yet.\n`;

        menuText += `╰━━━━━━━━━━━━━━╯\n\n`;

        /*
         * ==============================
         * DOWNLOAD
         * ==============================
         */

        menuText += `╭━━〔 📥 *DOWNLOAD* 〕━━╮\n`;

        menuText += commandLine(
            'tik <url>',
            'Download TikTok videos without watermark'
        );

        menuText += commandLine(
            'music <song/link>',
            'Download music from YouTube'
        );

        menuText += commandLine(
            'save',
            'Save disappearing/view-once media'
        );

        menuText += commandLine(
            'downloadviewonce',
            'Reveal quoted view-once media'
        );

        menuText += commandLine(
            'downloadviewonceprivate',
            'Send quoted view-once media to DM'
        );

        menuText += `╰━━━━━━━━━━━━━━╯\n\n`;

        /*
         * ==============================
         * LOGO
         * ==============================
         */

        menuText += `╭━━〔 🖼️ *LOGO* 〕━━╮\n`;

        menuText +=
            `┃ • No dedicated logo command is installed yet.\n`;

        menuText += `╰━━━━━━━━━━━━━━╯\n\n`;

        /*
         * ==============================
         * STICKER
         * ==============================
         */

        menuText += `╭━━〔 🧩 *STICKER* 〕━━╮\n`;

        menuText += commandLine(
            'sticker',
            'Convert image/video to sticker'
        );

        menuText += `╰━━━━━━━━━━━━━━╯\n\n`;

        /*
         * ==============================
         * SOUND
         * ==============================
         */

        menuText += `╭━━〔 🔊 *SOUND* 〕━━╮\n`;

        menuText += commandLine(
            'tts <text>',
            'Convert text to a voice note'
        );

        menuText += commandLine(
            'music <song/link>',
            'Download music'
        );

        menuText += commandLine(
            'lyrics <song>',
            'Search song lyrics'
        );

        menuText += `╰━━━━━━━━━━━━━━╯\n\n`;

        /*
         * ==============================
         * GAME
         * ==============================
         */

        menuText += `╭━━〔 🎮 *GAME* 〕━━╮\n`;

        menuText += commandLine(
            'game',
            'Interactive mini-games suite'
        );

        menuText += `╰━━━━━━━━━━━━━━╯\n\n`;

        /*
         * ==============================
         * OTHER
         * ==============================
         */

        menuText += `╭━━〔 🛠️ *OTHER* 〕━━╮\n`;

        menuText += commandLine(
            'ping',
            'Check bot latency'
        );

        menuText += commandLine(
            'weather <city>',
            'Get current weather'
        );

        menuText += commandLine(
            'lyrics <song>',
            'Search song lyrics'
        );

        menuText += commandLine(
            'repo',
            'View the bot repository'
        );

        menuText += commandLine(
            'individual',
            'Open private utilities menu'
        );

        menuText += `╰━━━━━━━━━━━━━━╯\n\n`;

        /*
         * ==============================
         * ANIME LOVERS
         * ==============================
         */

        menuText += `╭━━〔 💕 *ANIME LOVERS* 〕━━╮\n`;

        menuText +=
            `┃ • Anime-lover commands coming soon.\n`;

        menuText += `╰━━━━━━━━━━━━━━━━╯\n\n`;

        /*
         * ==============================
         * EPHOTO
         * ==============================
         */

        menuText += `╭━━〔 📸 *EPHOTO* 〕━━╮\n`;

        menuText +=
            `┃ • No ephoto command is installed yet.\n`;

        menuText += `╰━━━━━━━━━━━━━━╯\n\n`;

        /*
         * ==============================
         * PANEL SHOP
         * ==============================
         */

        menuText += `╭━━〔 🛍️ *PANEL SHOP* 〕━━╮\n`;

        menuText +=
            `┃ • Panel shop commands are not installed.\n`;

        menuText += `╰━━━━━━━━━━━━━━━━╯\n\n`;

        /*
         * ==============================
         * PAIRING
         * ==============================
         */

        menuText += `╭━━〔 🔗 *PAIRING* 〕━━╮\n`;

        menuText +=
            `┃ • Pairing is handled automatically when the bot is unlinked.\n`;

        menuText +=
            `┃ • Link with the phone number shown by the bot console.\n`;

        menuText += `╰━━━━━━━━━━━━━━╯\n\n`;

        /*
         * ==============================
         * NEWSLETTER
         * ==============================
         */

        menuText += `╭━━〔 📢 *NEWSLETTER* 〕━━╮\n`;

        menuText +=
            `┃ • Follow the official QUEEN VIDA channel for updates.\n`;

        menuText += `╰━━━━━━━━━━━━━━━━╯\n\n`;

        /*
         * ==============================
         * CRAZY CHECK
         * ==============================
         */

        menuText += `╭━━〔 🤪 *CRAZY CHECK* 〕━━╮\n`;

        menuText +=
            `┃ • No crazy-check command is installed yet.\n`;

        menuText += `╰━━━━━━━━━━━━━━━━╯\n\n`;

        /*
         * ==============================
         * FOOTER
         * ==============================
         */

        menuText +=
`┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 👑 *QUEEN VIDA-V3*
┃ ⚡ Fast • Stable • Active
┃ 👨‍💻 *Creator:* ${CREATOR_NAME}
┃ 📱 *Contact:* wa.me/${DISPLAY_CREATOR_NUMBER}
┗━━━━━━━━━━━━━━━━━━━━━━━┛`;

        menuText += CHANNEL_TEXT_LINK;

        /*
         * ==============================
         * SEND MENU
         * ==============================
         */

        const bannerPath = path.join(
            __dirname,
            '..',
            'banner.png'
        );

        if (fs.existsSync(bannerPath)) {
            try {
                const imageBuffer =
                    fs.readFileSync(bannerPath);

                await sock.sendMessage(
                    from,
                    {
                        image: imageBuffer,
                        caption: menuText
                    },
                    {
                        quoted: m
                    }
                );

                return;

            } catch (err) {
                console.error(
                    'Failed to send menu banner:',
                    err.message
                );
            }
        }

        await sock.sendMessage(
            from,
            {
                text: menuText
            },
            {
                quoted: m
            }
        );
    }
};
