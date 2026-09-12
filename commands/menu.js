const fs = require('fs');
const path = require('path');
const { getMode } = require('../utils/mode');
const { getPrefix } = require('../utils/prefix');

const CREATOR_NAME = 'QUEEN VIDA';
const VERSION = '3.0.0';
const PLAN = 'PREMIUM';

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

function commandLine(prefix, command, description = '') {
    if (description) {
        return `┃ • *${prefix}${command}* — ${description}\n`;
    }

    return `┃ • *${prefix}${command}*\n`;
}

// Every command name that already appears somewhere in the
// hardcoded sections above. Used so newly added command files
// automatically show up under "NEWLY ADDED" instead of staying
// invisible until someone remembers to edit this file again.
const LISTED_COMMANDS = new Set([
    'menu', 'owner', 'gcstatus', 'prefix', 'ping', 'botcreator',
    'ai',
    'add', 'agm', 'antilink', 'antispam', 'antisticker', 'badwords',
    'clearwarnings', 'del', 'demote', 'groupinfo', 'kick', 'mute',
    'poll', 'promote', 'reaction', 'tagadmins', 'tagall', 'unmute',
    'vcf', 'warn', 'warnings', 'admins', 'approve', 'requests',
    'revoke', 'rules', 'link', 'members', 'groupstats', 'hidetag',
    'afk', 'setpp', 'getpp', 'setgroupname', 'setgroupdesc', 'active',
    'define', 'welcome', 'setwelcome', 'goodbye', 'setgoodbye',
    'block', 'broadcast', 'changebio', 'changename', 'changeprofile',
    'creategroup', 'join', 'leave', 'mode', 'statusreactions',
    'unblock', 'update', 'viewstatus',
    'calc', 'game', 'quote', 'hug', 'kiss', 'slap', 'ship', 'match',
    'roast', 'rate', 'compliment', 'flirt', 'truth', 'dare',
    'tik', 'music', 'save', 'downloadviewonce', 'downloadviewonceprivate',
    'sticker',
    'tts', 'lyrics',
    'weather', 'repo', 'individual', 'profile', 'runtime', 'topmembers'
]);

module.exports = {
    name: 'menu',

    description:
        'Displays the QUEEN VIDA-V3 command menu and bot information',

    async execute(sock, m, from) {
        const PREFIX = getPrefix();

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

        // ==============================
        // HEADER
        // ==============================

        menuText +=
`╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
┃       👑 *QUEEN VIDA* 👑
┃        *V3 • MD BOT*
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ♕ *Welcome to the Palace*
┃
┃ ◈ Status : *ONLINE* 🟢
┃ ◈ Mode   : *${mode}*
┃ ◈ Prefix : *[ ${PREFIX} ]*
┃ ◈ Version: *v${VERSION}*
┃ ◈ Plan   : *${PLAN}*
┃ ◈ User   : *${userName}*
┃ ◈ Mood   : *${mood}*
┃ ◈ Time   : *${time}*
┃ ◈ Uptime : *${uptime}*
┃ ◈ Date   : *${date}*
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

`;

        // ==============================
        // ROYAL CHAMBERS
        // ==============================

        menuText +=
`╭━━━〔 👑 *ROYAL CHAMBERS* 〕━━━╮
┃
${commandLine(PREFIX, 'menu', 'Display this command menu')}
${commandLine(PREFIX, 'owner', 'Show bot creator')}
${commandLine(PREFIX, 'gcstatus', 'Show detailed group status')}
${commandLine(PREFIX, 'prefix', 'Change bot command prefix')}
${commandLine(PREFIX, 'ping', 'Check bot response speed')}
${commandLine(PREFIX, 'botcreator', 'Show creator information')}
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

`;

        // ==============================
        // AI
        // ==============================

        menuText +=
`╭━━━〔 🤖 *AI* 〕━━━╮
${commandLine(PREFIX, 'ai <query>', 'Chat with AI')}
╰━━━━━━━━━━━━━━━━━━╯

`;

        // ==============================
        // GROUP
        // ==============================

        menuText +=
`╭━━━〔 🛡️ *GROUP* 〕━━━╮
${commandLine(PREFIX, 'add <number>', 'Add a member')}
${commandLine(PREFIX, 'agm on/off', 'Anti-group mention')}
${commandLine(PREFIX, 'antilink on/off', 'Anti-link protection')}
${commandLine(PREFIX, 'antispam on/off', 'Anti-spam protection')}
${commandLine(PREFIX, 'antisticker on/off', 'Delete member stickers')}
${commandLine(PREFIX, 'badwords', 'Profanity filter')}
${commandLine(PREFIX, 'clearwarnings', 'Clear warnings')}
${commandLine(PREFIX, 'del', 'Delete replied message')}
${commandLine(PREFIX, 'demote', 'Demote admin')}
${commandLine(PREFIX, 'groupinfo', 'Group information')}
${commandLine(PREFIX, 'gcstatus', 'Detailed group status')}
${commandLine(PREFIX, 'kick', 'Remove member')}
${commandLine(PREFIX, 'mute', 'Lock group')}
${commandLine(PREFIX, 'poll', 'Create a poll')}
${commandLine(PREFIX, 'promote', 'Promote member')}
${commandLine(PREFIX, 'reaction on/off', 'Automatic reactions')}
${commandLine(PREFIX, 'tagadmins <msg>', 'Mention admins')}
${commandLine(PREFIX, 'tagall <msg>', 'Mention everyone')}
${commandLine(PREFIX, 'unmute', 'Unlock group')}
${commandLine(PREFIX, 'vcf', 'Export contacts')}
${commandLine(PREFIX, 'warn', 'Warn member')}
${commandLine(PREFIX, 'warnings', 'Check warnings')}
${commandLine(PREFIX, 'admins', 'Show group administrators')}
${commandLine(PREFIX, 'approve', 'Approve a pending join request')}
${commandLine(PREFIX, 'requests', 'Show pending join requests')}
${commandLine(PREFIX, 'revoke', 'Revoke the group invite link')}
${commandLine(PREFIX, 'rules', 'Show or set group rules')}
${commandLine(PREFIX, 'link', 'Get the group invite link')}
${commandLine(PREFIX, 'members', 'Show group member count')}
${commandLine(PREFIX, 'groupstats', 'Basic group statistics')}
${commandLine(PREFIX, 'hidetag <msg>', 'Hidden tag to all members')}
${commandLine(PREFIX, 'afk <reason>', 'Set yourself as AFK')}
${commandLine(PREFIX, 'setpp', 'Change group profile picture')}
${commandLine(PREFIX, 'getpp @user', "Fetch a user's profile picture")}
${commandLine(PREFIX, 'setgroupname <n>', 'Change group title')}
${commandLine(PREFIX, 'setgroupdesc <text>', 'Change group description')}
${commandLine(PREFIX, 'active', 'Most active members leaderboard')}
${commandLine(PREFIX, 'define <word>', 'Dictionary definition of a word')}
${commandLine(PREFIX, 'welcome on/off', 'Toggle welcome messages')}
${commandLine(PREFIX, 'setwelcome <text>', 'Set custom welcome message')}
${commandLine(PREFIX, 'goodbye on/off', 'Toggle goodbye messages')}
${commandLine(PREFIX, 'setgoodbye <text>', 'Set custom goodbye message')}
╰━━━━━━━━━━━━━━━━━━━━╯

`;

        // ==============================
        // OWNER
        // ==============================

        menuText +=
`╭━━━〔 👑 *OWNER* 〕━━━╮
${commandLine(PREFIX, 'block', 'Block a WhatsApp user')}
${commandLine(PREFIX, 'broadcast', 'Broadcast message')}
${commandLine(PREFIX, 'changebio <text>', 'Change bot bio')}
${commandLine(PREFIX, 'changename <name>', 'Change bot name')}
${commandLine(PREFIX, 'changeprofile', 'Change profile picture')}
${commandLine(PREFIX, 'creategroup <name>', 'Create group')}
${commandLine(PREFIX, 'join <link>', 'Join group')}
${commandLine(PREFIX, 'leave', 'Leave group')}
${commandLine(PREFIX, 'mode public/private', 'Change bot mode')}
${commandLine(PREFIX, 'statusreactions on/off', 'Status reactions')}
${commandLine(PREFIX, 'unblock', 'Unblock user')}
${commandLine(PREFIX, 'update', 'Update bot')}
${commandLine(PREFIX, 'viewstatus on/off', 'Automatic status viewing')}
╰━━━━━━━━━━━━━━━━━━━━━━╯

`;

        // ==============================
        // FUN
        // ==============================

        menuText +=
`╭━━━〔 🎭 *FUN* 〕━━━╮
${commandLine(PREFIX, 'calc <expression>', 'Calculate')}
${commandLine(PREFIX, 'game', 'Open games')}
${commandLine(PREFIX, 'quote', 'Random quote')}
${commandLine(PREFIX, 'hug @user', 'Hug someone')}
${commandLine(PREFIX, 'kiss @user', 'Kiss someone')}
${commandLine(PREFIX, 'slap @user', 'Slap someone')}
${commandLine(PREFIX, 'ship @user1 @user2', 'Ship two group members')}
${commandLine(PREFIX, 'match @user1 @user2', 'Match two people')}
${commandLine(PREFIX, 'roast @user', 'Roast someone')}
${commandLine(PREFIX, 'rate @user', 'Rate someone')}
${commandLine(PREFIX, 'compliment @user', 'Compliment someone')}
${commandLine(PREFIX, 'flirt', 'Send a random flirty line')}
${commandLine(PREFIX, 'truth', 'Random truth question')}
${commandLine(PREFIX, 'dare', 'Random dare')}
╰━━━━━━━━━━━━━━━━━━━╯

`;

        // ==============================
        // DOWNLOAD
        // ==============================

        menuText +=
`╭━━━〔 📥 *DOWNLOAD* 〕━━━╮
${commandLine(PREFIX, 'tik <url>', 'Download TikTok video')}
${commandLine(PREFIX, 'music <song/link>', 'Download music')}
${commandLine(PREFIX, 'save', 'Save disappearing media')}
${commandLine(PREFIX, 'downloadviewonce', 'Download view-once media')}
${commandLine(PREFIX, 'downloadviewonceprivate', 'Send view-once media privately')}
╰━━━━━━━━━━━━━━━━━━━━━━━╯

`;

        // ==============================
        // STICKER
        // ==============================

        menuText +=
`╭━━━〔 🧩 *STICKER* 〕━━━╮
${commandLine(PREFIX, 'sticker', 'Convert media to sticker')}
${commandLine(PREFIX, 'antisticker on/off', 'Control sticker protection')}
╰━━━━━━━━━━━━━━━━━━━━━━━╯

`;

        // ==============================
        // SOUND
        // ==============================

        menuText +=
`╭━━━〔 🔊 *SOUND* 〕━━━╮
${commandLine(PREFIX, 'tts <text>', 'Text to voice')}
${commandLine(PREFIX, 'music <song/link>', 'Download music')}
${commandLine(PREFIX, 'lyrics <song>', 'Find lyrics')}
╰━━━━━━━━━━━━━━━━━━━━━━╯

`;

        // ==============================
        // GAME
        // ==============================

        menuText +=
`╭━━━〔 🎮 *GAME* 〕━━━╮
${commandLine(PREFIX, 'game', 'Open mini-games')}
╰━━━━━━━━━━━━━━━━━━━━━╯

`;

        // ==============================
        // OTHER
        // ==============================

        menuText +=
`╭━━━〔 🛠️ *OTHER* 〕━━━╮
${commandLine(PREFIX, 'ping', 'Check latency')}
${commandLine(PREFIX, 'weather <city>', 'Weather information')}
${commandLine(PREFIX, 'lyrics <song>', 'Search lyrics')}
${commandLine(PREFIX, 'repo', 'Bot repository')}
${commandLine(PREFIX, 'individual', 'Private utilities')}
${commandLine(PREFIX, 'profile @user', 'Show a member profile')}
${commandLine(PREFIX, 'runtime', 'Show how long the bot has been online')}
${commandLine(PREFIX, 'topmembers', 'Alias for active leaderboard')}
╰━━━━━━━━━━━━━━━━━━━━━━╯

`;

        // ==============================
        // ANIME
        // ==============================

        menuText +=
`╭━━━〔 🎌 *ANIME* 〕━━━╮
┃ • Anime commands coming soon.
╰━━━━━━━━━━━━━━━━━━━━━╯

`;

        // ==============================
        // ANIME LOVERS
        // ==============================

        menuText +=
`╭━━━〔 💕 *ANIME LOVERS* 〕━━━╮
┃ • Anime-lover commands coming soon.
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

`;

        // ==============================
        // EPHOTO
        // ==============================

        menuText +=
`╭━━━〔 📸 *EPHOTO* 〕━━━╮
┃ • Ephoto commands coming soon.
╰━━━━━━━━━━━━━━━━━━━━━━╯

`;

        // ==============================
        // LOGO
        // ==============================

        menuText +=
`╭━━━〔 🖼️ *LOGO* 〕━━━╮
┃ • Logo commands coming soon.
╰━━━━━━━━━━━━━━━━━━━━━╯

`;

        // ==============================
        // PANEL SHOP
        // ==============================

        menuText +=
`╭━━━〔 🛍️ *PANEL SHOP* 〕━━━╮
┃ • Panel shop commands coming soon.
╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯

`;

        // ==============================
        // NEWLY ADDED (auto-detected)
        // ==============================
        // Safety net: any command registered in sock.commands that
        // isn't in LISTED_COMMANDS above shows up here automatically,
        // so a new command file is never silently missing from /menu.

        if (sock.commands && sock.commands.size) {
            const unlisted = [...sock.commands.keys()]
                .filter(name => !LISTED_COMMANDS.has(name))
                .sort();

            if (unlisted.length) {
                menuText +=
`╭━━━〔 🆕 *NEWLY ADDED* 〕━━━╮
┃
`;
                for (const name of unlisted) {
                    const cmd = sock.commands.get(name);
                    menuText += commandLine(
                        PREFIX,
                        name,
                        (cmd && cmd.description) || ''
                    );
                }
                menuText +=
`┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯

`;
            }
        }

        // ==============================
        // FOOTER
        // ==============================

        menuText +=
`╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
┃        👑 *QUEEN VIDA* 👑
┃
┃  *Royal Chambers Edition*
┃  V3 • MD BOT
┃
┃  Prefix: *[ ${PREFIX} ]*
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
${CHANNEL_TEXT_LINK}`;

        const bannerImagePath = path.join(
            __dirname,
            '../banner.png'
        );

        if (fs.existsSync(bannerImagePath)) {
            await sock.sendMessage(
                from,
                {
                    image: fs.readFileSync(bannerImagePath),
                    caption: menuText
                },
                { quoted: m }
            );
        } else {
            await sock.sendMessage(
                from,
                {
                    text: menuText
                },
                { quoted: m }
            );
        }
    }
};
