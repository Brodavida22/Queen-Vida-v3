const { getPrefix } = require('../utils/prefix');

const CHANNEL_TEXT_LINK = '\n\n📢 *Join QUEEN VIDA Channel:*\nhttps://whatsapp.com/channel/0029Vb8hHHs30LKXQEb4xe38';

module.exports = {
    name: 'individual',
    description: 'Displays the individual utilities and private tools menu',
    async execute(sock, m, from) {
        const PREFIX = getPrefix();

        const individualText = 
`┏━━━ 👑 *QUEEN VIDA-V3 : INDIVIDUAL* 👑 ━━━┓\n` +
`┃ 📥 *MEDIA & SAVERS*\n` +
`┃ • *${PREFIX}save* (Reply to status or view-once media)\n` +
`┃   _Description: Downloads and saves disappearing content._\n` +
`┃ • *${PREFIX}vv*\n` +
`┃   _Description: Reveals quoted view-once media in current chat._\n` +
`┃ • *${PREFIX}vv2*\n` +
`┃   _Description: Sends quoted view-once media directly to your DM._\n` +
`┃ • *${PREFIX}viewstatus on/off*\n` +
`┃   _Description: Toggle automatic WhatsApp status viewing (Creator Only)._\n` +
`┃ • *${PREFIX}statusreactions on/off*\n` +
`┃   _Description: Toggle automatic reactions for WhatsApp status updates (Creator/Bot Only)._\n` +
`┃\n` +
`┃ 🛠️ *GROUP CREATION*\n` +
`┃ • *${PREFIX}creategroup <group name>*\n` +
`┃   _Description: Creates a brand new WhatsApp group instantly._\n` +
`┃\n` +
`┃ ✏️ *PROFILE & ACCOUNT MANAGEMENT*\n` +
`┃ • *${PREFIX}changename <new name>*\n` +
`┃   _Description: Changes your WhatsApp profile name._\n` +
`┃ • *${PREFIX}changebio <new bio>*\n` +
`┃   _Description: Updates your profile status/bio description._\n` +
`┃ • *${PREFIX}changeprofile* (Send/Reply with an image)\n` +
`┃   _Description: Updates your profile picture directly._\n` +
`┃\n` +
`┃ 🚫 *USER BLOCKING UTILITIES*\n` +
`┃ • *${PREFIX}block* (Reply to user or tag number)\n` +
`┃   _Description: Instantly blocks a target user._\n` +
`┃ • *${PREFIX}unblock* (Reply to user or tag number)\n` +
`┃   _Description: Restores a blocked user._\n` +
`┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛\n` +
`> _Use prefix '${PREFIX}' before each command_` + CHANNEL_TEXT_LINK;

        await sock.sendMessage(from, { text: individualText }, { quoted: m });
    }
};
