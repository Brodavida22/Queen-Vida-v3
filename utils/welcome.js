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
            '🔥 [WELCOME SETTINGS ERROR]:',
            error.message
        );

        return {};
    }
}

function formatWelcomeMessage(
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

async function handleWelcome(sock, update) {
    try {
        if (!update || update.action !== 'add') {
            return;
        }

        const groupJid = update.id;

        if (!groupJid || !groupJid.endsWith('@g.us')) {
            return;
        }

        const settings = loadSettings();
        const groupSettings = settings[groupJid];

        if (!groupSettings || groupSettings.welcome !== true) {
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

        const welcomeMessage =
            groupSettings.welcomeMessage ||
            '🎉 Welcome @user to *{group}*! ❤️\n\nWe are happy to have you here. Enjoy your stay!';

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
            formatWelcomeMessage(
                welcomeMessage,
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
            '🔥 [WELCOME ERROR]:',
            error
        );
    }
}

module.exports = {
    handleWelcome
};
