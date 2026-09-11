const fs = require('fs');

const BROADCAST_PASSWORD = "ubimini";

// Global active broadcast tracker to allow stopping
global.activeBroadcasts = global.activeBroadcasts || {};

module.exports = {
    name: 'broadcast',
    description: 'Broadcasts text, images, or videos to all groups with password security and stop capability',
    async execute(sock, m, from, args, isOwner) {
        if (!isOwner) {
            await sock.sendMessage(from, { text: '❌ This command is restricted to the bot owner/creator only.' }, { quoted: m });
            return;
        }

        // Handle stop command
        if (args[0]?.toLowerCase() === 'stop') {
            if (global.activeBroadcasts[from]) {
                global.activeBroadcasts[from].stop = true;
                await sock.sendMessage(from, { text: '🛑 *Broadcast termination signal received.* Stopping ongoing broadcast...' }, { quoted: m });
            } else {
                await sock.sendMessage(from, { text: '⚠️ No active broadcast is currently running in this chat.' }, { quoted: m });
            }
            return;
        }

        if (args.length === 0) {
            await sock.sendMessage(from, { 
                text: '⚠️ *Usage:* `!broadcast <password> [optional text]` (Reply to an image/video/text message)\n' +
                      '🛑 *Stop Usage:* `!broadcast stop`' 
            }, { quoted: m });
            return;
        }

        const providedPassword = args[0];
        if (providedPassword !== BROADCAST_PASSWORD) {
            await sock.sendMessage(from, { text: '❌ Incorrect broadcast password! Access denied.' }, { quoted: m });
            return;
        }

        const additionalText = args.slice(1).join(' ');
        const quotedMsg = m.message.extendedTextMessage?.contextInfo?.quotedMessage;

        if (!quotedMsg && !additionalText) {
            await sock.sendMessage(from, { text: '⚠️ Please reply to an image, video, or text message, or provide text to broadcast!' }, { quoted: m });
            return;
        }

        await sock.sendMessage(from, { text: '🔄 Fetching joined groups and preparing broadcast...' }, { quoted: m });

        try {
            const fetchedGroups = await sock.groupFetchAllParticipating();
            const groupJids = Object.keys(fetchedGroups);

            if (groupJids.length === 0) {
                await sock.sendMessage(from, { text: '❌ The bot is not currently in any groups to broadcast to.' }, { quoted: m });
                return;
            }

            // Register active broadcast session for cancellation
            global.activeBroadcasts[from] = { stop: false };

            let successCount = 0;
            let failCount = 0;
            let stoppedEarly = false;

            // Determine content type from quoted message or regular text
            const headerNotice = `📢 *--- OFFICIAL BROADCAST ---* 📢\n\n`;

            for (const jid of groupJids) {
                // Check if stop was requested
                if (global.activeBroadcasts[from]?.stop) {
                    stoppedEarly = true;
                    break;
                }

                try {
                    if (quotedMsg) {
                        // Check if quoted is image
                        if (quotedMsg.imageMessage) {
                            const captionText = quotedMsg.imageMessage.caption ? quotedMsg.imageMessage.caption : '';
                            const finalCaption = headerNotice + (captionText ? captionText + '\n' : '') + (additionalText ? '\n' + additionalText : '');
                            
                            // Download media stream if possible or forward using baileys download
                            // Simpler & robust way: send image buffer if accessible, or fallback to forward
                            await sock.sendMessage(jid, { 
                                forward: { key: m.message.extendedTextMessage.contextInfo.stanzaId, message: quotedMsg },
                                contextInfo: { forwardingScore: 999, isForwarded: true }
                            });
                        } else if (quotedMsg.videoMessage) {
                            await sock.sendMessage(jid, { 
                                forward: { key: m.message.extendedTextMessage.contextInfo.stanzaId, message: quotedMsg },
                                contextInfo: { forwardingScore: 999, isForwarded: true }
                            });
                        } else if (quotedMsg.conversation || quotedMsg.extendedTextMessage) {
                            const originalText = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text || '';
                            const combinedText = headerNotice + originalText + (additionalText ? '\n\n' + additionalText : '');
                            await sock.sendMessage(jid, { text: combinedText });
                        } else {
                            // Fallback generic forward
                            await sock.sendMessage(jid, { forward: m.message.extendedTextMessage.contextInfo });
                        }
                    } else {
                        // Text-only broadcast with additional text
                        await sock.sendMessage(jid, { text: headerNotice + additionalText });
                    }
                    successCount++;
                } catch (err) {
                    failCount++;
                }

                // Safe 3-second delay between broadcasts to prevent account ban / rate-limit
                await new Promise(resolve => setTimeout(resolve, 3000));
            }

            // Clean up session tracker
            delete global.activeBroadcasts[from];

            const statusTitle = stoppedEarly ? '🛑 *Broadcast Stopped by User!*' : '✅ *Broadcast Completed Successfully!*';

            await sock.sendMessage(from, { 
                text: `${statusTitle}\n\n` +
                      `👥 *Total Target Groups:* ${groupJids.length}\n` +
                      `✔️ *Successfully Sent:* ${successCount}\n` +
                      `❌ *Failed:* ${failCount}` 
            }, { quoted: m });

        } catch (error) {
            delete global.activeBroadcasts[from];
            console.error('Broadcast error:', error);
            await sock.sendMessage(from, { text: `❌ Failed to execute broadcast: ${error.message}` }, { quoted: m });
        }
    }
};
