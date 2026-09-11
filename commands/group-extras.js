const fs = require('fs');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

const CREATOR_NUMBERS = ["2348138558590", "2348138558590"];

async function verifyAdminOrCreator(sock, m, from) {
    if (!from.endsWith('@g.us')) return false;
    const sender = m.key.participant || m.key.remoteJid;
    const senderNumber = sender.replace(/[^0-9]/g, '');
    if (CREATOR_NUMBERS.includes(senderNumber) || m.key.fromMe) return true;

    try {
        const groupMetadata = await sock.groupMetadata(from);
        const participant = groupMetadata.participants.find(p => p.id === sender);
        return participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
    } catch (e) {
        return false;
    }
}

module.exports = [
    // 1. !tagadmins
    {
        name: 'tagadmins',
        description: 'Mentions all group administrators',
        async execute(sock, m, from, args) {
            if (!from.endsWith('@g.us')) return sock.sendMessage(from, { text: '❌ This command is for groups only!' }, { quoted: m });
            if (!await verifyAdminOrCreator(sock, m, from)) {
                return sock.sendMessage(from, { text: '❌ *Access Denied:* Only group admins and the creator can use this command!' }, { quoted: m });
            }

            try {
                const groupMetadata = await sock.groupMetadata(from);
                const admins = groupMetadata.participants.filter(p => p.admin);
                const adminJids = admins.map(a => a.id);
                const text = args.join(' ') || 'Attention required from group administrators!';

                let mentionText = `👑 *ADMIN ALERT* 👑\n\n📌 *Message:* ${text}\n\n`;
                for (let admin of admins) {
                    mentionText += `• @${admin.id.split('@')[0]}\n`;
                }

                await sock.sendMessage(from, { text: mentionText, mentions: adminJids }, { quoted: m });
            } catch (err) {
                console.error('tagadmins error:', err);
            }
        }
    },

    // 2. !hidetag
    {
        name: 'hidetag',
        description: 'Broadcasts a hidden tag message to all group members',
        async execute(sock, m, from, args) {
            if (!from.endsWith('@g.us')) return sock.sendMessage(from, { text: '❌ This command is for groups only!' }, { quoted: m });
            if (!await verifyAdminOrCreator(sock, m, from)) {
                return sock.sendMessage(from, { text: '❌ *Access Denied:* Only group admins and the creator can use this command!' }, { quoted: m });
            }

            const text = args.join(' ');
            if (!text) return sock.sendMessage(from, { text: '❌ Please provide text to broadcast!\n*Usage:* `!hidetag <your message>`' }, { quoted: m });

            try {
                const groupMetadata = await sock.groupMetadata(from);
                const participants = groupMetadata.participants.map(p => p.id);

                await sock.sendMessage(from, { text: text, mentions: participants }, { quoted: m });
            } catch (err) {
                console.error('hidetag error:', err);
            }
        }
    },

    // 3. !setpp (Group Icon)
    {
        name: 'setpp',
        description: 'Changes the group profile picture',
        async execute(sock, m, from, args) {
            if (!from.endsWith('@g.us')) return sock.sendMessage(from, { text: '❌ This command is for groups only!' }, { quoted: m });
            if (!await verifyAdminOrCreator(sock, m, from)) {
                return sock.sendMessage(from, { text: '❌ *Access Denied:* Only group admins and the creator can use this command!' }, { quoted: m });
            }

            const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const targetMessage = m.message?.imageMessage || quoted?.imageMessage;

            if (!targetMessage) {
                return sock.sendMessage(from, { text: '❌ Please send or reply to an image with `!setpp` to update the group icon.' }, { quoted: m });
            }

            try {
                const stream = await downloadContentFromMessage(targetMessage, 'image');
                let buffer = Buffer.from([]);
                for await (const chunk of stream) {
                    buffer = Buffer.concat([buffer, chunk]);
                }

                await sock.updateProfilePicture(from, buffer);
                await sock.sendMessage(from, { text: '✅ Group profile picture updated successfully!' }, { quoted: m });
            } catch (err) {
                console.error('setpp error:', err);
                await sock.sendMessage(from, { text: `❌ Failed to update group profile picture: ${err.message || 'Unknown error'}` }, { quoted: m });
            }
        }
    },

    // 4. !afk
    {
        name: 'afk',
        description: 'Sets your status to Away From Keyboard',
        async execute(sock, m, from, args) {
            if (!await verifyAdminOrCreator(sock, m, from)) {
                return sock.sendMessage(from, { text: '❌ *Access Denied:* Only admins and the creator can use this command!' }, { quoted: m });
            }

            const reason = args.join(' ') || 'Busy / AFK';
            const sender = m.key.participant || m.key.remoteJid;
            
            let afkData = fs.existsSync('afk.json') ? JSON.parse(fs.readFileSync('afk.json')) : {};
            afkData[sender] = { reason, time: Date.now() };
            fs.writeFileSync('afk.json', JSON.stringify(afkData, null, 2));

            await sock.sendMessage(from, { text: `💤 *AFK Mode Activated:* You are now marked as AFK.\n📌 *Reason:* ${reason}` }, { quoted: m });
        }
    },

    // 5. !getpp
    {
        name: 'getpp',
        description: 'Fetches profile picture of a tagged user',
        async execute(sock, m, from, args) {
            if (!await verifyAdminOrCreator(sock, m, from)) {
                return sock.sendMessage(from, { text: '❌ *Access Denied:* Only admins and the creator can use this command!' }, { quoted: m });
            }

            const mentioned = m.message.extendedTextMessage?.contextInfo?.mentionedJid;
            const target = mentioned && mentioned.length > 0 ? mentioned[0] : (m.key.participant || m.key.remoteJid);

            try {
                const ppUrl = await sock.profilePictureUrl(target, 'image');
                if (ppUrl) {
                    await sock.sendMessage(from, { image: { url: ppUrl }, caption: '🖼️ *Profile Picture Retrieved*' }, { quoted: m });
                } else {
                    await sock.sendMessage(from, { text: '❌ This user has no profile picture or it is private.' }, { quoted: m });
                }
            } catch (err) {
                await sock.sendMessage(from, { text: '❌ Could not retrieve profile picture for this user.' }, { quoted: m });
            }
        }
    }
];
