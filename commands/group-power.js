const fs = require('fs');
const https = require('https');
const { exec } = require('child_process');
const path = require('path');

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

// Helper function to split long text into safe segments (~180 chars max per Google TTS limit)
function chunkText(text, maxLength = 180) {
    const words = text.split(' ');
    const chunks = [];
    let currentChunk = '';

    for (const word of words) {
        if ((currentChunk + ' ' + word).trim().length > maxLength) {
            chunks.push(currentChunk.trim());
            currentChunk = word;
        } else {
            currentChunk += (currentChunk ? ' ' : '') + word;
        }
    }
    if (currentChunk) chunks.push(currentChunk.trim());
    return chunks;
}

// Helper to download a single Google TTS chunk as an MP3 file
function downloadTtsChunk(textChunk, outputPath) {
    return new Promise((resolve, reject) => {
        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(textChunk)}&tl=en&client=tw-ob`;
        const fileStream = fs.createWriteStream(outputPath);

        https.get(ttsUrl, (response) => {
            if (response.statusCode !== 200) {
                fileStream.close();
                return reject(new Error(`Failed to download TTS chunk, status code: ${response.statusCode}`));
            }
            response.pipe(fileStream);
            fileStream.on('finish', () => {
                fileStream.close();
                resolve(outputPath);
            });
        }).on('error', (err) => {
            fileStream.close();
            reject(err);
        });
    });
}

module.exports = [
    // 1. !tts (Admin/Creator Only - Unlimited Text Length)
    {
        name: 'tts',
        description: 'Converts long text into a seamless playable voice note',
        async execute(sock, m, from, args) {
            if (!await verifyAdminOrCreator(sock, m, from)) {
                return sock.sendMessage(from, { text: '❌ *Access Denied:* Only admins and the creator can use this command!' }, { quoted: m });
            }

            const text = args.join(' ');
            if (!text) return sock.sendMessage(from, { text: '❌ Please provide text to convert!\n*Usage:* `!tts <your text>`' }, { quoted: m });

            const batchId = Date.now();
            const textChunks = chunkText(text);
            const tempFiles = [];

            try {
                // Download audio segments sequentially
                for (let i = 0; i < textChunks.length; i++) {
                    const chunkPath = path.join(__dirname, `../temp_tts_${batchId}_${i}.mp3`);
                    await downloadTtsChunk(textChunks[i], chunkPath);
                    tempFiles.push(chunkPath);
                }

                const listFilePath = path.join(__dirname, `../temp_list_${batchId}.txt`);
                const outputOpusPath = path.join(__dirname, `../temp_tts_${batchId}.opus`);

                if (tempFiles.length === 1) {
                    // Single chunk direct conversion
                    await new Promise((resolve, reject) => {
                        exec(`ffmpeg -i "${tempFiles[0]}" -c:a libopus -b:a 64k -vbr on "${outputOpusPath}"`, (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });
                } else {
                    // Multiple chunks: create concat file list for FFmpeg
                    const listContent = tempFiles.map(file => `file '${file.replace(/\\/g, '/')}'`).join('\n');
                    fs.writeFileSync(listFilePath, listContent);

                    await new Promise((resolve, reject) => {
                        exec(`ffmpeg -f concat -safe 0 -i "${listFilePath}" -c:a libopus -b:a 64k -vbr on "${outputOpusPath}"`, (err) => {
                            if (fs.existsSync(listFilePath)) fs.unlinkSync(listFilePath);
                            if (err) reject(err);
                            else resolve();
                        });
                    });
                }

                // Send resulting voice note
                const audioBuffer = fs.readFileSync(outputOpusPath);
                await sock.sendMessage(from, { 
                    audio: audioBuffer, 
                    mimetype: 'audio/ogg; codecs=opus', 
                    ptt: true 
                }, { quoted: m });

                // Cleanup all temp files
                tempFiles.forEach(file => { if (fs.existsSync(file)) fs.unlinkSync(file); });
                if (fs.existsSync(outputOpusPath)) fs.unlinkSync(outputOpusPath);

            } catch (err) {
                console.error('TTS error:', err);
                // Cleanup on error
                tempFiles.forEach(file => { if (fs.existsSync(file)) fs.unlinkSync(file); });
                await sock.sendMessage(from, { text: '❌ Failed to process long voice note conversion.' }, { quoted: m });
            }
        }
    },

    // 2. !setgroupname (Admin/Creator Only)
    {
        name: 'setgroupname',
        description: 'Changes the group title',
        async execute(sock, m, from, args) {
            if (!from.endsWith('@g.us')) return sock.sendMessage(from, { text: '❌ This command is for groups only!' }, { quoted: m });
            if (!await verifyAdminOrCreator(sock, m, from)) {
                return sock.sendMessage(from, { text: '❌ *Access Denied:* Only admins and the creator can use this command!' }, { quoted: m });
            }

            const newName = args.join(' ');
            if (!newName) return sock.sendMessage(from, { text: '❌ Please provide a new group name!\n*Usage:* `!setgroupname <name>`' }, { quoted: m });

            try {
                await sock.groupUpdateSubject(from, newName);
                await sock.sendMessage(from, { text: `✅ Group name successfully updated to: *${newName}*` }, { quoted: m });
            } catch (err) {
                console.error('setgroupname error:', err);
                await sock.sendMessage(from, { text: '❌ Failed to update group name. Make sure the bot is an admin.' }, { quoted: m });
            }
        }
    },

    // 3. !setgroupdesc (Admin/Creator Only)
    {
        name: 'setgroupdesc',
        description: 'Changes the group description',
        async execute(sock, m, from, args) {
            if (!from.endsWith('@g.us')) return sock.sendMessage(from, { text: '❌ This command is for groups only!' }, { quoted: m });
            if (!await verifyAdminOrCreator(sock, m, from)) {
                return sock.sendMessage(from, { text: '❌ *Access Denied:* Only admins and the creator can use this command!' }, { quoted: m });
            }

            const newDesc = args.join(' ');
            if (!newDesc) return sock.sendMessage(from, { text: '❌ Please provide a new group description!\n*Usage:* `!setgroupdesc <description>`' }, { quoted: m });

            try {
                await sock.groupUpdateDescription(from, newDesc);
                await sock.sendMessage(from, { text: `✅ Group description successfully updated!` }, { quoted: m });
            } catch (err) {
                console.error('setgroupdesc error:', err);
                await sock.sendMessage(from, { text: '❌ Failed to update group description. Make sure the bot is an admin.' }, { quoted: m });
            }
        }
    },

    // 4. !active / !topmembers (Admin/Creator Only)
    {
        name: 'active',
        description: 'Displays the most active members leaderboard',
        async execute(sock, m, from) {
            if (!from.endsWith('@g.us')) return sock.sendMessage(from, { text: '❌ This command is for groups only!' }, { quoted: m });
            if (!await verifyAdminOrCreator(sock, m, from)) {
                return sock.sendMessage(from, { text: '❌ *Access Denied:* Only admins and the creator can use this command!' }, { quoted: m });
            }

            try {
                let stats = fs.existsSync('activity.json') ? JSON.parse(fs.readFileSync('activity.json')) : {};
                let chatStats = stats[from] || {};
                
                let sortedMembers = Object.entries(chatStats).sort((a, b) => b[1] - a[1]).slice(0, 10);

                if (sortedMembers.length === 0) {
                    return sock.sendMessage(from, { text: '📊 *Activity Leaderboard*\n\nNo message activity recorded yet!' }, { quoted: m });
                }

                let text = `🏆 *TOP 10 ACTIVE MEMBERS* 🏆\n\n`;
                sortedMembers.forEach(([user, count], index) => {
                    text += `${index + 1}. @${user.split('@')[0]} — *${count} msgs*\n`;
                });

                let mentions = sortedMembers.map(([user]) => user);
                await sock.sendMessage(from, { text, mentions }, { quoted: m });
            } catch (err) {
                console.error('active error:', err);
            }
        }
    },
    {
        name: 'topmembers',
        description: 'Alias for active leaderboard',
        async execute(sock, m, from, args) {
            const cmd = module.exports.find(c => c.name === 'active');
            await cmd.execute(sock, m, from, args);
        }
    },

    // 5. !define (Public to All Users)
    {
        name: 'define',
        description: 'Fetches the dictionary definition of a word',
        async execute(sock, m, from, args) {
            const word = args[0];
            if (!word) return sock.sendMessage(from, { text: '❌ Please provide a word to define!\n*Usage:* `!define <word>`' }, { quoted: m });

            const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
            
            https.get(url, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', async () => {
                    try {
                        const json = JSON.parse(data);
                        if (json.title === 'No Definitions Found') {
                            return sock.sendMessage(from, { text: `❌ No definition found for *"${word}"*.` }, { quoted: m });
                        }

                        const entry = json[0];
                        const phonetic = entry.phonetic || entry.phonetics?.[0]?.text || '';
                        const meaning = entry.meanings?.[0];
                        const partOfSpeech = meaning?.partOfSpeech || '';
                        const definition = meaning?.definitions?.[0]?.definition || 'No definition available.';
                        const example = meaning?.definitions?.[0]?.example ? `\n*Example:* "${meaning.definitions[0].example}"` : '';

                        const defText = 
`📖 *DICTIONARY SEARCH* 📖\n\n` +
`🔤 *Word:* ${entry.word} ${phonetic}\n` +
`📌 *Type:* _(${partOfSpeech})_\n` +
`💡 *Definition:* ${definition}${example}`;

                        await sock.sendMessage(from, { text: defText }, { quoted: m });
                    } catch (e) {
                        await sock.sendMessage(from, { text: `❌ Failed to fetch definition for *"${word}"*.` }, { quoted: m });
                    }
                });
            }).on('error', () => {
                sock.sendMessage(from, { text: '❌ Network error while fetching definition.' }, { quoted: m });
            });
        }
    }
];
