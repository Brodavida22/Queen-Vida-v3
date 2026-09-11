const { exec } = require('child_process');

// Set this once you publish your own GitHub repository
const ORIGINAL_REPO_URL = '';

module.exports = {
    name: 'update',
    description: 'Pull the latest changes directly from the official repository and restart the bot',
    async execute(sock, m, from, args, isOwner) {
        // Allow execution if it's the owner OR if the message is from the bot itself (fromMe)
        if (!isOwner && !m.key.fromMe) {
            await sock.sendMessage(from, { text: '❌ Access Denied! Only the bot owner or the bot itself can use the !update command.' }, { quoted: m });
            return;
        }

        if (!ORIGINAL_REPO_URL) {
            await sock.sendMessage(from, { text: '❌ No repository has been configured yet. Set ORIGINAL_REPO_URL in commands/update.js once you publish your own GitHub repo.' }, { quoted: m });
            return;
        }

        await sock.sendMessage(from, { text: '🔄 Fetching latest updates from the official repository...' }, { quoted: m });

        // Force pull from your official repository main branch
        const updateCmd = `git pull ${ORIGINAL_REPO_URL} main`;

        exec(updateCmd, async (error, stdout, stderr) => {
            if (error) {
                console.error(`🔥 [UPDATE ERROR]: ${error.message}`);
                await sock.sendMessage(from, { text: `❌ Update failed (You might have local conflicts):\n\`\`\`${error.message}\`\`\`` }, { quoted: m });
                return;
            }

            if (stderr) {
                console.warn(`⚠️ [UPDATE STDERR]: ${stderr}`);
            }

            console.log(`📥 [GIT PULL OUTPUT]:\n${stdout}`);

            exec('git log -n 3 --pretty=format:"- %s (%an)"', async (logErr, logStdout) => {
                let updateDetails = stdout.trim();
                if (!logErr && logStdout) {
                    updateDetails += `\n\n📜 *Recent Changes:*\n${logStdout}`;
                }

                await sock.sendMessage(from, { 
                    text: `✅ Update successful!\n\`\`\`${updateDetails}\`\`\`\n\n🔄 Restarting bot application...\n\n⚠️ *Notice:* Cloud session cleared. Go back to your hosting dashboard console right now to grab your new pairing code!` 
                }, { quoted: m });

                setTimeout(() => {
                    process.exit(0);
                }, 2000);
            });
        });
    }
};
