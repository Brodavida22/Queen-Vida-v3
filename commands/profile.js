module.exports = {
    name: 'profile',
    description: 'Show a member profile',

    async execute(sock, m, from) {
        const context = m.message?.extendedTextMessage?.contextInfo;
        const mentions = context?.mentionedJid || [];

        let target;

        if (mentions.length) {
            target = mentions[0];
        } else if (context?.participant) {
            target = context.participant;
        } else {
            target = m.key.participant || m.key.remoteJid;
        }

        try {
            const number = target.split('@')[0];

            let name = number;

            try {
                const contact = await sock.onWhatsApp(target);
                if (contact?.[0]?.name) {
                    name = contact[0].name;
                }
            } catch {}

            let ppUrl = null;

            try {
                ppUrl = await sock.profilePictureUrl(target, 'image');
            } catch {}

            const text = `╭━━━〔 👤 PROFILE 〕━━━╮
┃
┃ 👤 Name: ${name}
┃ 📱 Number: +${number}
┃ 🆔 ID: ${target}
┃
╰━━━━━━━━━━━━━━━━━━╯`;

            if (ppUrl) {
                await sock.sendMessage(from, {
                    image: { url: ppUrl },
                    caption: text,
                    mentions: [target]
                });
            } else {
                await sock.sendMessage(from, {
                    text,
                    mentions: [target]
                });
            }

        } catch (error) {
            console.error('profile error:', error);

            await sock.sendMessage(from, {
                text: '❌ Could not retrieve this profile.'
            });
        }
    }
};
