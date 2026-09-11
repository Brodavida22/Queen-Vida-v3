const fs = require('fs');
const path = require('path');

const REPO_URL = ""; // Set this once you publish your own GitHub repository
const CREATOR_NAME = "QUEEN VIDA";

module.exports = {
    name: 'repo',
    description: 'Displays the official GitHub repository link for QUEEN VIDA-V3',
    async execute(sock, m, from) {
        const repoText = REPO_URL
?
`┏━━━ 👑 *QUEEN VIDA-V3 REPO* 👑 ━━━┓\n` +
`┃ 🤖 *Bot Name:* QUEEN VIDA-V3\n` +
`┃ 👤 *Creator:* ${CREATOR_NAME}\n` +
`┣━━━━━━━━━━━━━━━━━━━━━━━\n` +
`┃ 📂 *GitHub Repository Link:*\n` +
`┃ ${REPO_URL}\n` +
`┣━━━━━━━━━━━━━━━━━━━━━━━\n` +
`┃ _Feel free to star ⭐ and fork 🍴 the repo if you like this project!_\n` +
`┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`
:
`┏━━━ 👑 *QUEEN VIDA-V3 REPO* 👑 ━━━┓\n` +
`┃ 🤖 *Bot Name:* QUEEN VIDA-V3\n` +
`┃ 👤 *Creator:* ${CREATOR_NAME}\n` +
`┣━━━━━━━━━━━━━━━━━━━━━━━\n` +
`┃ 📂 No public repository has been\n` +
`┃ published yet. Check back soon!\n` +
`┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;

        await sock.sendMessage(from, { text: repoText }, { quoted: m });
    }
};
