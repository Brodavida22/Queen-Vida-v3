const fs = require('fs');
const path = require('path');
const { getPrefix } = require('../utils/prefix');

const ACTIVITY_FILE = path.join(__dirname, '..', 'activity.json');

function loadActivity() {
    try {
        if (!fs.existsSync(ACTIVITY_FILE)) {
            return {};
        }

        const data = JSON.parse(
            fs.readFileSync(ACTIVITY_FILE, 'utf8')
        );

        return data && typeof data === 'object' ? data : {};
    } catch (error) {
        console.error('🔥 [ACTIVITY LOAD ERROR]:', error);
        return {};
    }
}

function saveActivity(data) {
    try {
        fs.writeFileSync(
            ACTIVITY_FILE,
            JSON.stringify(data, null, 2)
        );
    } catch (error) {
        console.error('🔥 [ACTIVITY SAVE ERROR]:', error);
    }
}

function isGroup(from) {
    return from && from.endsWith('@g.us');
}

function getSender(m) {
    return m.key.participant || m.key.remoteJid;
}

function normalizeUserRecord(record) {
    // Supports the old format:
    // userJid: 25
    if (typeof record === 'number') {
        return {
            messages: record,
            lastActive: 0
        };
    }

    if (!record || typeof record !== 'object') {
        return {
            messages: 0,
            lastActive: 0
        };
    }

    return {
        messages: Number(record.messages) || 0,
        lastActive: Number(record.lastActive) || 0
    };
}

function getGroupActivity(data, groupId) {
    if (!data[groupId] || typeof data[groupId] !== 'object') {
        return {};
    }

    const result = {};

    for (const [jid, record] of Object.entries(data[groupId])) {
        result[jid] = normalizeUserRecord(record);
    }

    return result;
}

function getDaysInactive(lastActive) {
    if (!lastActive) return Infinity;

    return Math.max(
        0,
        Math.floor(
            (Date.now() - lastActive) / 86400000
        )
    );
}

function formatLastActive(timestamp) {
    if (!timestamp) {
        return 'No activity recorded';
    }

    const diff = Date.now() - timestamp;

    if (diff < 60000) {
        return 'just now';
    }

    if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    }

    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    }

    const days = Math.floor(diff / 86400000);

    return `${days} day${days === 1 ? '' : 's'} ago`;
}

function mentionText(jid) {
    return `@${jid.split('@')[0].replace(/[^0-9]/g, '')}`;
}

function getRequestedDays(args) {
    const number = parseInt(args?.[0], 10);

    if (!Number.isFinite(number) || number <= 0) {
        return 7;
    }

    return Math.min(number, 3650);
}

async function getMetadata(sock, from) {
    return await sock.groupMetadata(from);
}

function getMemberJids(metadata) {
    return (metadata.participants || [])
        .map(member => member.id)
        .filter(Boolean);
}

function getDisplayName(metadata, jid) {
    const member = (metadata.participants || []).find(
        participant => participant.id === jid
    );

    return (
        member?.notify ||
        member?.name ||
        member?.verifiedName ||
        jid.split('@')[0]
    );
}

function buildRanking(groupActivity, members, limit = 10) {
    return members
        .map(jid => {
            const record = normalizeUserRecord(
                groupActivity[jid]
            );

            return {
                jid,
                messages: record.messages,
                lastActive: record.lastActive
            };
        })
        .sort((a, b) => {
            if (b.messages !== a.messages) {
                return b.messages - a.messages;
            }

            return b.lastActive - a.lastActive;
        })
        .slice(0, limit);
}

async function activityCommand(sock, m, from, args) {
    if (!isGroup(from)) {
        return sock.sendMessage(
            from,
            {
                text: '❌ This command can only be used inside a group.'
            },
            { quoted: m }
        );
    }

    try {
        const data = loadActivity();
        const groupActivity = getGroupActivity(data, from);
        const metadata = await getMetadata(sock, from);

        const sender = getSender(m);

        const record = normalizeUserRecord(
            groupActivity[sender]
        );

        const rankList = buildRanking(
            groupActivity,
            getMemberJids(metadata),
            metadata.participants?.length || 10
        );

        const rank =
            rankList.findIndex(user => user.jid === sender) + 1;

        const totalMessages = rankList.reduce(
            (sum, user) => sum + user.messages,
            0
        );

        const prefix = getPrefix();

        const text =
            `╭━━━〔 📊 *YOUR ACTIVITY* 〕━━━╮\n` +
            `┃ 👤 *Member:* ${mentionText(sender)}\n` +
            `┃ 💬 *Messages:* ${record.messages}\n` +
            `┃ 🕐 *Last Active:* ${formatLastActive(record.lastActive)}\n` +
            `┃ 🏆 *Group Rank:* ${rank > 0 ? `#${rank}` : 'Not ranked'}\n` +
            `┃ 👥 *Tracked Messages:* ${totalMessages}\n` +
            `╰━━━━━━━━━━━━━━━━━━━━╯\n\n` +
            `💡 Use *${prefix}activityrank* to see the group leaderboard.`;

        await sock.sendMessage(
            from,
            {
                text,
                mentions: [sender]
            },
            { quoted: m }
        );
    } catch (error) {
        console.error('🔥 [ACTIVITY COMMAND ERROR]:', error);

        await sock.sendMessage(
            from,
            {
                text: '❌ Failed to load activity information.'
            },
            { quoted: m }
        );
    }
}

async function activityRankCommand(sock, m, from) {
    if (!isGroup(from)) {
        return sock.sendMessage(
            from,
            {
                text: '❌ This command can only be used inside a group.'
            },
            { quoted: m }
        );
    }

    try {
        const data = loadActivity();
        const groupActivity = getGroupActivity(data, from);

        const metadata = await getMetadata(sock, from);
        const members = getMemberJids(metadata);

        const ranking = buildRanking(
            groupActivity,
            members,
            10
        );

        if (!ranking.length) {
            return sock.sendMessage(
                from,
                {
                    text: '❌ No activity has been recorded yet.'
                },
                { quoted: m }
            );
        }

        let text =
            `╭━━━〔 🏆 *ACTIVITY RANKING* 〕━━━╮\n`;

        const mentions = [];

        ranking.forEach((user, index) => {
            const medal =
                index === 0
                    ? '🥇'
                    : index === 1
                    ? '🥈'
                    : index === 2
                    ? '🥉'
                    : '▫️';

            text +=
                `┃ ${medal} *${index + 1}.* ` +
                `${mentionText(user.jid)} — ` +
                `💬 ${user.messages}\n`;

            mentions.push(user.jid);
        });

        text +=
            `╰━━━━━━━━━━━━━━━━━━━━╯\n\n` +
            `📌 Ranking is based on messages seen by Queen Vida.`;

        await sock.sendMessage(
            from,
            {
                text,
                mentions
            },
            { quoted: m }
        );
    } catch (error) {
        console.error('🔥 [ACTIVITY RANK ERROR]:', error);

        await sock.sendMessage(
            from,
            {
                text: '❌ Failed to generate activity ranking.'
            },
            { quoted: m }
        );
    }
}

async function inactiveCommand(sock, m, from, args) {
    if (!isGroup(from)) {
        return sock.sendMessage(
            from,
            {
                text: '❌ This command can only be used inside a group.'
            },
            { quoted: m }
        );
    }

    const days = getRequestedDays(args);

    try {
        const data = loadActivity();
        const groupActivity = getGroupActivity(data, from);

        const metadata = await getMetadata(sock, from);
        const members = getMemberJids(metadata);

        const inactive = members
            .filter(jid => {
                if (jid === sock.user?.id) return false;

                const record = normalizeUserRecord(
                    groupActivity[jid]
                );

                return getDaysInactive(record.lastActive) >= days;
            })
            .sort((a, b) => {
                const aLast =
                    normalizeUserRecord(groupActivity[a]).lastActive;

                const bLast =
                    normalizeUserRecord(groupActivity[b]).lastActive;

                return aLast - bLast;
            });

        if (!inactive.length) {
            return sock.sendMessage(
                from,
                {
                    text:
                        `✅ No members have been inactive for *${days}+ days*.\n\n` +
                        `🔥 The group is active!`
                },
                { quoted: m }
            );
        }

        let text =
            `╭━━━〔 💤 *INACTIVE MEMBERS* 〕━━━╮\n` +
            `┃ ⏳ *Threshold:* ${days}+ days\n` +
            `┃ 👥 *Found:* ${inactive.length}\n` +
            `╰━━━━━━━━━━━━━━━━━━━━╯\n\n`;

        const mentions = [];

        inactive.slice(0, 30).forEach((jid, index) => {
            const record = normalizeUserRecord(
                groupActivity[jid]
            );

            const inactiveDays =
                record.lastActive
                    ? getDaysInactive(record.lastActive)
                    : 'unknown';

            text +=
                `${index + 1}. ${mentionText(jid)} — ` +
                `${inactiveDays === 'unknown'
                    ? 'never seen'
                    : `${inactiveDays}d inactive`}\n`;

            mentions.push(jid);
        });

        if (inactive.length > 30) {
            text += `\n...and ${inactive.length - 30} more.`;
        }

        await sock.sendMessage(
            from,
            {
                text,
                mentions
            },
            { quoted: m }
        );
    } catch (error) {
        console.error('🔥 [INACTIVE ERROR]:', error);

        await sock.sendMessage(
            from,
            {
                text: '❌ Failed to check inactive members.'
            },
            { quoted: m }
        );
    }
}

async function topActiveCommand(sock, m, from) {
    if (!isGroup(from)) {
        return sock.sendMessage(
            from,
            {
                text: '❌ This command can only be used inside a group.'
            },
            { quoted: m }
        );
    }

    try {
        const data = loadActivity();
        const groupActivity = getGroupActivity(data, from);

        const metadata = await getMetadata(sock, from);
        const members = getMemberJids(metadata);

        const ranking = buildRanking(
            groupActivity,
            members,
            10
        );

        let text =
            `╭━━━〔 🔥 *TOP ACTIVE MEMBERS* 〕━━━╮\n`;

        const mentions = [];

        ranking.forEach((user, index) => {
            text +=
                `┃ 🔥 *${index + 1}.* ` +
                `${mentionText(user.jid)} — ` +
                `${user.messages} messages\n`;

            mentions.push(user.jid);
        });

        text +=
            `╰━━━━━━━━━━━━━━━━━━━━╯`;

        await sock.sendMessage(
            from,
            {
                text,
                mentions
            },
            { quoted: m }
        );
    } catch (error) {
        console.error('🔥 [TOP ACTIVE ERROR]:', error);

        await sock.sendMessage(
            from,
            {
                text: '❌ Failed to load active members.'
            },
            { quoted: m }
        );
    }
}

async function topInactiveCommand(sock, m, from, args) {
    if (!isGroup(from)) {
        return sock.sendMessage(
            from,
            {
                text: '❌ This command can only be used inside a group.'
            },
            { quoted: m }
        );
    }

    const days = getRequestedDays(args);

    try {
        const data = loadActivity();
        const groupActivity = getGroupActivity(data, from);

        const metadata = await getMetadata(sock, from);
        const members = getMemberJids(metadata);

        const ranking = members
            .map(jid => {
                const record = normalizeUserRecord(
                    groupActivity[jid]
                );

                return {
                    jid,
                    ...record,
                    inactiveDays: getDaysInactive(
                        record.lastActive
                    )
                };
            })
            .filter(user => {
                if (user.jid === sock.user?.id) return false;

                return user.inactiveDays >= days;
            })
            .sort((a, b) => {
                if (b.inactiveDays === Infinity) return 1;
                if (a.inactiveDays === Infinity) return -1;

                return b.inactiveDays - a.inactiveDays;
            })
            .slice(0, 10);

        if (!ranking.length) {
            return sock.sendMessage(
                from,
                {
                    text:
                        `✅ No inactive members found at the *${days}+ day* threshold.`
                },
                { quoted: m }
            );
        }

        let text =
            `╭━━━〔 💤 *TOP INACTIVE* 〕━━━╮\n` +
            `┃ ⏳ Threshold: ${days}+ days\n` +
            `╰━━━━━━━━━━━━━━━━━━━━╯\n`;

        const mentions = [];

        ranking.forEach((user, index) => {
            text +=
                `\n${index + 1}. ${mentionText(user.jid)} — ` +
                `${
                    user.inactiveDays === Infinity
                        ? 'never seen'
                        : `${user.inactiveDays} days`
                }`;

            mentions.push(user.jid);
        });

        await sock.sendMessage(
            from,
            {
                text,
                mentions
            },
            { quoted: m }
        );
    } catch (error) {
        console.error('🔥 [TOP INACTIVE ERROR]:', error);

        await sock.sendMessage(
            from,
            {
                text: '❌ Failed to load inactive ranking.'
            },
            { quoted: m }
        );
    }
}

async function lastActiveCommand(sock, m, from) {
    if (!isGroup(from)) {
        return sock.sendMessage(
            from,
            {
                text: '❌ This command can only be used inside a group.'
            },
            { quoted: m }
        );
    }

    try {
        const data = loadActivity();
        const groupActivity = getGroupActivity(data, from);

        const metadata = await getMetadata(sock, from);
        const members = getMemberJids(metadata);

        const users = members
            .map(jid => {
                const record = normalizeUserRecord(
                    groupActivity[jid]
                );

                return {
                    jid,
                    ...record
                };
            })
            .filter(user => user.lastActive > 0)
            .sort((a, b) => b.lastActive - a.lastActive)
            .slice(0, 15);

        if (!users.length) {
            return sock.sendMessage(
                from,
                {
                    text: '❌ No last-active information has been recorded yet.'
                },
                { quoted: m }
            );
        }

        let text =
            `╭━━━〔 🕐 *LAST ACTIVE* 〕━━━╮\n`;

        const mentions = [];

        users.forEach((user, index) => {
            text +=
                `┃ ${index + 1}. ${mentionText(user.jid)} — ` +
                `${formatLastActive(user.lastActive)}\n`;

            mentions.push(user.jid);
        });

        text += `╰━━━━━━━━━━━━━━━━━━━━╯`;

        await sock.sendMessage(
            from,
            {
                text,
                mentions
            },
            { quoted: m }
        );
    } catch (error) {
        console.error('🔥 [LAST ACTIVE ERROR]:', error);

        await sock.sendMessage(
            from,
            {
                text: '❌ Failed to load last-active information.'
            },
            { quoted: m }
        );
    }
}

async function tagInactiveCommand(sock, m, from, args) {
    if (!isGroup(from)) {
        return sock.sendMessage(
            from,
            {
                text: '❌ This command can only be used inside a group.'
            },
            { quoted: m }
        );
    }

    const days = getRequestedDays(args);

    try {
        const data = loadActivity();
        const groupActivity = getGroupActivity(data, from);

        const metadata = await getMetadata(sock, from);
        const members = getMemberJids(metadata);

        const inactive = members.filter(jid => {
            if (jid === sock.user?.id) return false;

            const record = normalizeUserRecord(
                groupActivity[jid]
            );

            return getDaysInactive(record.lastActive) >= days;
        });

        if (!inactive.length) {
            return sock.sendMessage(
                from,
                {
                    text:
                        `🔥 Nobody is currently inactive for *${days}+ days*.`
                },
                { quoted: m }
            );
        }

        const selected = inactive.slice(0, 40);

        const mentions = selected;

        let text =
            `🚨 *INACTIVE MEMBER CHECK*\n\n` +
            `⏳ No activity detected for *${days}+ days*.\n\n` +
            selected
                .map(jid => `👉 ${mentionText(jid)}`)
                .join('\n') +
            `\n\n👀 Come back to the group!`;

        if (inactive.length > selected.length) {
            text +=
                `\n\n+ ${inactive.length - selected.length} more inactive members.`;
        }

        await sock.sendMessage(
            from,
            {
                text,
                mentions
            },
            { quoted: m }
        );
    } catch (error) {
        console.error('🔥 [TAG INACTIVE ERROR]:', error);

        await sock.sendMessage(
            from,
            {
                text: '❌ Failed to tag inactive members.'
            },
            { quoted: m }
        );
    }
}

async function inactiveInfoCommand(sock, m, from) {
    if (!isGroup(from)) {
        return sock.sendMessage(
            from,
            {
                text: '❌ This command can only be used inside a group.'
            },
            { quoted: m }
        );
    }

    try {
        const context =
            m.message?.extendedTextMessage?.contextInfo || {};

        const mentioned = context.mentionedJid || [];

        const target =
            mentioned[0] ||
            context.participant ||
            getSender(m);

        const data = loadActivity();
        const groupActivity = getGroupActivity(data, from);

        const record = normalizeUserRecord(
            groupActivity[target]
        );

        const metadata = await getMetadata(sock, from);

        const displayName =
            getDisplayName(metadata, target);

        const daysInactive =
            getDaysInactive(record.lastActive);

        const text =
            `╭━━━〔 🔎 *INACTIVE INFO* 〕━━━╮\n` +
            `┃ 👤 *Member:* ${displayName}\n` +
            `┃ 💬 *Messages:* ${record.messages}\n` +
            `┃ 🕐 *Last Active:* ${formatLastActive(record.lastActive)}\n` +
            `┃ 💤 *Inactive:* ${
                daysInactive === Infinity
                    ? 'No activity recorded'
                    : `${daysInactive} day(s)`
            }\n` +
            `╰━━━━━━━━━━━━━━━━━━━━╯\n\n` +
            `📌 Activity is based on messages seen by Queen Vida.`;

        await sock.sendMessage(
            from,
            {
                text,
                mentions: [target]
            },
            { quoted: m }
        );
    } catch (error) {
        console.error('🔥 [INACTIVE INFO ERROR]:', error);

        await sock.sendMessage(
            from,
            {
                text: '❌ Failed to get member activity information.'
            },
            { quoted: m }
        );
    }
}

async function tagActiveCommand(sock, m, from, args) {
    if (!isGroup(from)) {
        return sock.sendMessage(
            from,
            {
                text: '❌ This command can only be used inside a group.'
            },
            { quoted: m }
        );
    }

    const days = getRequestedDays(args);

    try {
        const data = loadActivity();
        const groupActivity = getGroupActivity(data, from);

        const metadata = await getMetadata(sock, from);
        const members = getMemberJids(metadata);

        const active = members
            .filter(jid => {
                if (jid === sock.user?.id) return false;

                const record = normalizeUserRecord(
                    groupActivity[jid]
                );

                if (!record.lastActive) return false;

                return getDaysInactive(record.lastActive) <= days;
            })
            .sort((a, b) => {
                const aLast =
                    normalizeUserRecord(groupActivity[a]).lastActive;

                const bLast =
                    normalizeUserRecord(groupActivity[b]).lastActive;

                return bLast - aLast;
            });

        if (!active.length) {
            return sock.sendMessage(
                from,
                {
                    text:
                        `❌ No members have been seen active within the last *${days} days*.`
                },
                { quoted: m }
            );
        }

        const selected = active.slice(0, 40);

        const text =
            `🔥 *ACTIVE MEMBERS*\n\n` +
            `⏱️ Active within the last *${days} days*:\n\n` +
            selected
                .map(jid => `👉 ${mentionText(jid)}`)
                .join('\n') +
            `\n\n🔥 Keep the Vibes Alive!`;

        await sock.sendMessage(
            from,
            {
                text,
                mentions: selected
            },
            { quoted: m }
        );
    } catch (error) {
        console.error('🔥 [TAG ACTIVE ERROR]:', error);

        await sock.sendMessage(
            from,
            {
                text: '❌ Failed to tag active members.'
            },
            { quoted: m }
        );
    }
}

const commands = [
    {
        name: 'inactive',
        description: 'Show members inactive for a number of days',
        execute: inactiveCommand
    },

    {
        name: 'activity',
        description: 'Show your group activity',
        execute: activityCommand
    },

    {
        name: 'activityrank',
        description: 'Show the activity leaderboard',
        execute: activityRankCommand
    },

    {
        name: 'topactive',
        description: 'Show the most active members',
        execute: topActiveCommand
    },

    {
        name: 'topinactive',
        description: 'Show the most inactive members',
        execute: topInactiveCommand
    },

    {
        name: 'lastactive',
        description: 'Show when members were last active',
        execute: lastActiveCommand
    },

    {
        name: 'taginactive',
        description: 'Tag inactive members',
        execute: tagInactiveCommand
    },

    {
        name: 'inactiveinfo',
        description: 'Show activity information about a member',
        execute: inactiveInfoCommand
    },

    {
        name: 'tagactive',
        description: 'Tag recently active members',
        execute: tagActiveCommand
    }
];

module.exports = commands;
