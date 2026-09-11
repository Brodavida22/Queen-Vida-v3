const fs = require('fs');
const path = require('path');

const settingsPath = path.join(__dirname, '..', 'welcome.json');

function loadSettings() {
    try {
        if (!fs.existsSync(settingsPath)) {
            return {};
        }

        return JSON.parse(
            fs.readFileSync(settingsPath, 'utf8')
        );
    } catch (error) {
        console.error(
            '🔥 [GOODBYE SETTINGS ERROR]:',
            error.message
        );

        return {};
    }
}

function formatGoodbyeMessage(
    message,
    user,
    group,
    count
) {
    return message
        .replace(/\{user\}/gi, user)
        .replace(/@user/gi, user)
        .replace(/\{group\}/gi, group)
        .replace(/\{count\}/gi, String(count));
}

async function handleGoodbye(sock, update) {
    try {
        if (!update || update.action !== 'remove') {
            return;
        }

        const groupJid = update.id;

        if (!groupJid || !groupJid.endsWith('@g.us')) {
            return;
        }

        const settings = loadSettings();
        const groupSettings = settings[groupJid];

        if (!groupSettings || groupSettings.goodbye !== true) {
            return;
        }

        const participants = update.participants || [];

        if (!participants.length) {
            return;
        }

        const metadata =
            await sock.groupMetadata(groupJid);

        const groupName =
            metadata.subject || 'this group';

        const memberCount =
            metadata.participants?.length || 0;

        const goodbyeMessage =
            groupSettings.goodbyeMessage ||
            '👋 Goodbye @user.\n\nThanks for being part of *{group}*. We wish you all the best! ❤️';

        const mentions = [];

        const users = participants.map(participant => {
            const jid =
                typeof participant === 'string'
                    ? participant
                    : participant?.id;

            if (!jid) {
                return null;
            }

            mentions.push(jid);

            const number =
                jid.split('@')[0];

            return `@${number}`;
        }).filter(Boolean);

        if (!users.length) {
            return;
        }

        const userText =
            users.join(', ');

        const text =
            formatGoodbyeMessage(
                goodbyeMessage,
                userText,
                groupName,
                memberCount
            );

        await sock.sendMessage(
            groupJid,
            {
                text,
                mentions
            }
        );

    } catch (error) {

        console.error(
            '🔥 [GOODBYE ERROR]:',
            error
        );
    }
}

module.exports = {
    handleGoodbye
};
