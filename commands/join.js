const CREATOR_NUMBERS = ["2348138558590", "2348138558590"];

module.exports = {
    name: 'join',
    description: 'Forces or requests the bot to join a group via invite link (Creators only)',
    async execute(sock, m, from, args) {
        const sender = m.key.participant || m.key.remoteJid;
        const senderNumber = sender.replace(/[^0-9]/g, '');

        if (!CREATOR_NUMBERS.includes(senderNumber) && !m.key.fromMe) {
            return sock.sendMessage(from, { text: '❌ *Access Denied:* Only creators can use the join command!' }, { quoted: m });
        }

        let inviteLink = args[0];

        // Check if link was provided via reply instead
        if (!inviteLink) {
            const quoted = m.message?.extendedTextMessage?.contextInfo;
            if (quoted && quoted.quotedMessage) {
                const quotedText = quoted.quotedMessage.conversation || quoted.quotedMessage.extendedTextMessage?.text || '';
                const match = quotedText.match(/https:\/\/chat\.whatsapp\.com\/([0-9A-Za-z]{20,24})/);
                if (match) {
                    inviteLink = match[0];
                }
            }
        }

        if (!inviteLink) {
            return sock.sendMessage(from, { text: '❌ Please provide a valid WhatsApp group invite link!\n*Usage:* `!join https://chat.whatsapp.com/CodeHere`' }, { quoted: m });
        }

        // Extract invite code from full link
        const codeMatch = inviteLink.match(/chat\.whatsapp\.com\/([0-9A-Za-z]{20,24})/);
        if (!codeMatch || !codeMatch[1]) {
            return sock.sendMessage(from, { text: '❌ Invalid group invite link format!' }, { quoted: m });
        }

        const inviteCode = codeMatch[1];

        try {
            await sock.sendMessage(from, { text: '⏳ Attempting to join the group...' }, { quoted: m });
            const res = await sock.groupAcceptInvite(inviteCode);
            await sock.sendMessage(from, { text: `✅ *Successfully joined the group!* (ID: ${res})` }, { quoted: m });
        } catch (err) {
            console.error('Join group error:', err);
            await sock.sendMessage(from, { text: `❌ Failed to join group: ${err.message || 'Link may be invalid or expired.'}` }, { quoted: m });
        }
    }
};
