const CHANNEL_TEXT_LINK = '\n\n📢 *Join QUEEN VIDA Channel:*\nhttps://whatsapp.com/channel/0029Vb8hHHs30LKXQEb4xe38';

module.exports = {
    name: 'ping',
    description: 'Check real-time latency with message editing',
    async execute(sock, m, from) {
        const start = Date.now();

        const loadingText = `┏━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┓\n` +
                            `┃ Status: *PINGING* ✅\n` +
                            `┣━━━━━━━━━━━━━━━━━━━━━━━\n` +
                            `┃ 🏓 *Status:* Measuring latency...\n` +
                            `┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛\n` +
                            `> _Please wait_`;

        const sentMsg = await sock.sendMessage(from, { text: loadingText }, { quoted: m });

        const latency = Date.now() - start;

        const successText = `┏━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┓\n` +
                            `┃ Status: *PONG* ✅\n` +
                            `┣━━━━━━━━━━━━━━━━━━━━━━━\n` +
                            `┃ 🏓 *Latency:* *${latency}ms*\n` +
                            `┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛\n` +
                            `> _Success_` + CHANNEL_TEXT_LINK;

        await sock.sendMessage(from, {
            text: successText,
            edit: sentMsg.key
        });
    }
};
