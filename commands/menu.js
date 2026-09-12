const fs = require('fs');
const path = require('path');
const { getMode } = require('../utils/mode');
const { getPrefix } = require('../utils/prefix');

function commandLine(prefix, command) {
    return `│ ❯ ${prefix}${command}\n`;
}

function section(title, emoji, prefix, commands) {
    let block = `╭─〔 ${emoji} ${title} 〕\n`;

    for (const cmd of commands) {
        block += commandLine(prefix, cmd);
    }

    block += `╰──────────────────────────\n\n`;

    return block;
}

// Every command name already covered by a section below.
// Used so any newly added command file automatically appears
// under "NEWLY ADDED" instead of staying invisible forever.
const SECTIONS = [
    {
        title: 'SYSTEM',
        emoji: '⚙️',
        commands: [
            'menu', 'ping', 'runtime', 'botcreator', 'owner',
            'repo', 'prefix', 'mode', 'individual', 'profile'
        ]
    },
    {
        title: 'GROUP POWER',
        emoji: '👥',
        commands: [
            'add', 'kick', 'promote', 'demote', 'tagall', 'hidetag',
            'tagadmins', 'mute', 'unmute', 'groupinfo', 'gcstatus',
            'del', 'poll', 'vcf', 'admins', 'approve', 'requests',
            'revoke', 'rules', 'link', 'members', 'groupstats',
            'afk', 'setpp', 'getpp', 'setgroupname', 'setgroupdesc',
            'active', 'topmembers', 'welcome', 'setwelcome',
            'goodbye', 'setgoodbye'
        ]
    },
    {
        title: 'SECURITY',
        emoji: '🛡️',
        commands: [
            'antilink', 'antispam', 'antisticker', 'badwords',
            'agm', 'warn', 'warnings', 'clearwarnings'
        ]
    },
    {
        title: 'AI & TOOLS',
        emoji: '🤖',
        commands: [
            'ai', 'calc', 'weather', 'define', 'quote', 'tts'
        ]
    },
    {
        title: 'MEDIA',
        emoji: '🎵',
        commands: [
            'music', 'tik', 'lyrics', 'sticker', 'save',
            'viewstatus', 'downloadviewonce', 'downloadviewonceprivate'
        ]
    },
    {
        title: 'ENTERTAINMENT',
        emoji: '🎮',
        commands: [
            'game', 'reaction', 'hug', 'kiss', 'slap', 'ship',
            'match', 'roast', 'rate', 'compliment', 'flirt',
            'truth', 'dare'
        ]
    },
    {
        title: 'OWNER ZONE',
        emoji: '👑',
        commands: [
            'block', 'unblock', 'broadcast', 'changename',
            'changebio', 'changeprofile', 'creategroup', 'join',
            'leave', 'update', 'statusreactions'
        ]
    }
];

const LISTED_COMMANDS = new Set(
    SECTIONS.flatMap(s => s.commands)
);

module.exports = {
    name: 'menu',

    description:
        'Displays the QUEEN VIDA-V3 command menu and bot information',

    async execute(sock, m, from) {
        const PREFIX = getPrefix();

        const mode = String(
            getMode() || 'public'
        ).toUpperCase();

        const commandCount =
            (sock.commands && sock.commands.size) || 0;

        let menuText = '';

        // ==============================
        // HEADER
        // ==============================

        menuText +=
`╭━━━〔 👑 QUEEN VIDA-V3 〕━━━╮
┃
┃  ✦ STATUS     : 🟢 ONLINE
┃  ✦ MODE       : ${mode}
┃  ✦ PREFIX     : ${PREFIX}
┃  ✦ VERSION    : V3.0
┃  ✦ COMMANDS   : ${commandCount}
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯

        ✨ COMMAND CENTER ✨

`;

        // ==============================
        // SECTIONS
        // ==============================

        for (const s of SECTIONS) {
            menuText += section(
                s.title,
                s.emoji,
                PREFIX,
                s.commands
            );
        }

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
                menuText += section(
                    'NEWLY ADDED',
                    '🆕',
                    PREFIX,
                    unlisted
                );
            }
        }

        // ==============================
        // FOOTER
        // ==============================

        menuText +=
`╭━━━━━━━━━━━━━━━━━━━━━━━━━━╮
┃ 👑 QUEEN VIDA-V3
┃ ⚡ POWER • SPEED • CONTROL
┃
┃ 💬 Type ${PREFIX}menu for commands
╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

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
