module.exports = {
    name: 'flirt',
    description: 'Send a random flirty line',

    async execute(sock, m, from) {
        const mentions = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

        if (!mentions.length) {
            return sock.sendMessage(from, {
                text: '😏 Tag someone to flirt with!'
            });
        }

        const target = mentions[0];

        const lines = [
            'Are you WiFi? Because I am feeling a connection. 😏❤️',
            'I was going to say something smooth, but you made me forget it. 😂',
            'You must be tired because you have been running through my mind all day. 😏',
            'Are you a magician? Because whenever I see you, everyone else disappears. ❤️',
            'If being attractive was a crime, you would be wanted everywhere. 😂',
            'I think my heart just skipped a notification. 😭❤️',
            'Stop being so attractive. Some of us are trying to behave. 😏'
        ];

        await sock.sendMessage(from, {
            text: `😏 *FLIRT ALERT* 😏

@${target.split('@')[0]}

${lines[Math.floor(Math.random() * lines.length)]}`,
            mentions: [target]
        });
    }
};
