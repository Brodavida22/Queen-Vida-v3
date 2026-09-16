const fs = require('fs');
const path = require('path');
const { getMode } = require('../utils/mode');
const { getPrefix } = require('../utils/prefix');

/*
 * ============================================================
 * QUEEN VIDA-V3
 * PREMIUM COMMAND MENU
 * ============================================================
 *
 * This file controls ONLY the visual menu.
 *
 * Existing functionality preserved:
 * - Dynamic prefix
 * - Dynamic mode
 * - Dynamic command count
 * - Banner image support
 * - Automatic NEWLY ADDED command detection
 * - Existing command registration
 * ============================================================
 */

function commandLine(prefix, command) {
    return `│ ⟡ ${prefix}${command}\n`;
}

function section(title, emoji, prefix, commands) {
    let block =
        `╭─〔 ${emoji} ${title} 〕\n`;

    for (const command of commands) {
        block += commandLine(prefix, command);
    }

    block +=
        `╰────────────────────────\n\n`;

    return block;
}

/*
 * ============================================================
 * MENU CATEGORIES
 * ============================================================
 */

const SECTIONS = [
    {
        title: '𝗦𝗬𝗦𝗧𝗘𝗠',
        emoji: '⚙️',
        commands: [
            'menu',
            'ping',
            'runtime',
            'botcreator',
            'owner',
            'repo',
            'prefix',
            'mode',
            'individual',
            'profile',
            'deploy'
        ]
    },

    {
        title: '𝗚𝗥𝗢𝗨𝗣 𝗣𝗢𝗪𝗘𝗥',
        emoji: '👥',
        commands: [
            'add',
            'kick',
            'promote',
            'demote',
            'tagall',
            'hidetag',
            'tagadmins',
            'mute',
            'unmute',
            'groupinfo',
            'gcstatus',
            'del',
            'poll',
            'vcf',
            'admins',
            'approve',
            'requests',
            'revoke',
            'rules',
            'link',
            'members',
            'groupstats',
            'afk',
            'setpp',
            'getpp',
            'setgroupname',
            'setgroupdesc',
            'active',
            'topmembers',
            'welcome',
            'setwelcome',
            'goodbye',
            'setgoodbye'
        ]
    },

    {
        title: '𝗦𝗘𝗖𝗨𝗥𝗜𝗧𝗬',
        emoji: '🛡️',
        commands: [
            'antilink',
            'antispam',
            'antisticker',
            'badwords',
            'agm',
            'warn',
            'warnings',
            'clearwarnings'
        ]
    },

    {
        title: '𝗔𝗜 & 𝗧𝗢𝗢𝗟𝗦',
        emoji: '🤖',
        commands: [
            'ai',
            'calc',
            'weather',
            'define',
            'quote',
            'tts'
        ]
    },

    {
        title: '𝗠𝗘𝗗𝗜𝗔',
        emoji: '🎵',
        commands: [
            'music',
            'tik',
            'lyrics',
            'sticker',
            'save',
            'viewstatus',
            'vv',
            'vv2'
        ]
    },

    {
        title: '𝗙𝗨𝗡 & 𝗚𝗔𝗠𝗘𝗦',
        emoji: '🎮',
        commands: [
            'game',
            'reaction',
            'hug',
            'kiss',
            'slap',
            'ship',
            'match',
            'roast',
            'rate',
            'compliment',
            'flirt',
            'truth',
            'dare'
        ]
    },

    {
        title: '𝗢𝗪𝗡𝗘𝗥 𝗭𝗢𝗡𝗘',
        emoji: '👑',
        commands: [
            'block',
            'unblock',
            'broadcast',
            'changename',
            'changebio',
            'changeprofile',
            'creategroup',
            'join',
            'leave',
            'update',
            'statusreactions',
            'sessions'
        ]
    }
];

/*
 * Keep track of commands already displayed above.
 * Any command added later to the bot automatically appears
 * inside NEWLY ADDED.
 */

const LISTED_COMMANDS = new Set(
    SECTIONS.flatMap(section => section.commands)
);

/*
 * ============================================================
 * MENU COMMAND
 * ============================================================
 */

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

        /*
         * ========================================================
         * HEADER
         * ========================================================
         */

        menuText +=
`╭━━━〔 👑 𝑸𝑼𝑬𝑬𝑵 𝑽𝑰𝑫𝑨-𝑽𝟑 〕━━━╮
┃
┃  🟢 𝗦𝗧𝗔𝗧𝗨𝗦  : 𝗢𝗡𝗟𝗜𝗡𝗘
┃  🔐 𝗠𝗢𝗗𝗘    : ${mode}
┃  ⚡ 𝗩𝗘𝗥𝗦𝗜𝗢𝗡 : 𝟯.𝟬
┃  📦 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗦 : ${commandCount}
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯

       ✦ 𝑪𝑶𝑴𝑴𝑨𝑵𝑫 𝑪𝑬𝑵𝑻𝑬𝑹 ✦

`;

        /*
         * ========================================================
         * MAIN COMMAND SECTIONS
         * ========================================================
         */

        for (const menuSection of SECTIONS) {
            menuText += section(
                menuSection.title,
                menuSection.emoji,
                PREFIX,
                menuSection.commands
            );
        }

        /*
         * ========================================================
         * NEWLY ADDED COMMANDS
         * ========================================================
         *
         * If you add another command file later and forget to
         * place it in a category, it will automatically appear
         * here.
         */

        if (sock.commands && sock.commands.size) {
            const unlisted = [...sock.commands.keys()]
                .filter(
                    commandName =>
                        !LISTED_COMMANDS.has(commandName)
                )
                .sort();

            if (unlisted.length) {
                menuText += section(
                    '𝗡𝗘𝗪𝗟𝗬 𝗔𝗗𝗗𝗘𝗗',
                    '🆕',
                    PREFIX,
                    unlisted
                );
            }
        }

        /*
         * ========================================================
         * FOOTER
         * ========================================================
         */

        menuText +=
`╭━━〔 👑 𝑸𝑼𝑬𝑬𝑵 𝑽𝑰𝑫𝑨 〕━━╮
┃  ⚡ 𝗣𝗢𝗪𝗘𝗥 • 𝗦𝗣𝗘𝗘𝗗 • 𝗖𝗢𝗡𝗧𝗥𝗢𝗟
┃  💬 Type ${PREFIX}menu for commands
╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

        /*
         * ========================================================
         * SEND MENU
         * ========================================================
         *
         * If banner.png exists, send the menu as an image
         * caption. Otherwise send normal text.
         */

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
                {
                    quoted: m
                }
            );
        } else {
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
    }
};
