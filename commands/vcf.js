const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'vcf',
    description: 'Export group participants as batch VCard (.vcf) contact files with professional name resolution (Admin/Creator Only)',
    async execute(sock, m, from, args, isOwner) {
        if (!from.endsWith('@g.us')) {
            return sock.sendMessage(from, { text: '❌ This command is only for WhatsApp groups.' }, { quoted: m });
        }

        const sender = m.key.participant || m.key.remoteJid;
        let isAdmin = isOwner;
        
        if (!isOwner) {
            try {
                const groupMetadata = await sock.groupMetadata(from);
                const participant = groupMetadata.participants.find(p => p.id === sender || p.jid === sender);
                if (participant && (participant.admin === 'admin' || participant.admin === 'superadmin')) {
                    isAdmin = true;
                }
            } catch (e) {}
        }

        if (!isAdmin) {
            return sock.sendMessage(from, { text: '❌ Access Denied! Only group admins and the creator can export contacts.' }, { quoted: m });
        }

        try {
            await sock.sendMessage(from, { text: '⏳ Analyzing participants and resolving professional WhatsApp names...' }, { quoted: m });

            const groupMetadata = await sock.groupMetadata(from);
            const participants = groupMetadata.participants;
            const groupName = groupMetadata.subject;

            let validContacts = [];

            for (const member of participants) {
                let cleanNumber = '';
                let rawJidForStore = '';

                // 1. Professional resolution: check alternative property keys used in modern WhatsApp multi-device & LID systems
                const possibleJids = [
                    member.id,
                    member.jid,
                    member.pn,
                    member.lid,
                    member.phoneNumber
                ];

                for (const jidStr of possibleJids) {
                    if (jidStr && typeof jidStr === 'string' && jidStr.includes('@s.whatsapp.net')) {
                        rawJidForStore = jidStr;
                        const digits = jidStr.split('@')[0].replace(/[^0-9]/g, '');
                        if (digits.length >= 7) {
                            cleanNumber = digits;
                            break;
                        }
                    }
                }

                // 2. Check session store LID mapping if available
                if (!cleanNumber && sock.signalRepository?.lidMapping?.getPNForLID) {
                    try {
                        const resolvedPn = await sock.signalRepository.lidMapping.getPNForLID(member.id);
                        if (resolvedPn) {
                            rawJidForStore = resolvedPn;
                            const digits = resolvedPn.replace(/[^0-9]/g, '');
                            if (digits.length >= 7) cleanNumber = digits;
                        }
                    } catch (err) {}
                }

                // 3. Deep scan fallback for numeric phone strings
                if (!cleanNumber) {
                    for (const key in member) {
                        const val = member[key];
                        if (val && typeof val === 'string') {
                            const digits = val.replace(/[^0-9]/g, '');
                            if (digits.length >= 10 && digits.length <= 15) {
                                cleanNumber = digits;
                                rawJidForStore = `${cleanNumber}@s.whatsapp.net`;
                                break;
                            }
                        }
                    }
                }

                if (!cleanNumber && member.id) {
                    const digits = member.id.replace(/[^0-9]/g, '');
                    if (digits.length >= 10 && digits.length <= 15) {
                        cleanNumber = digits;
                        rawJidForStore = `${cleanNumber}@s.whatsapp.net`;
                    }
                }

                if (!cleanNumber || cleanNumber.length < 7) continue;

                // Prevent duplicate numbers
                const formattedNumber = `+${cleanNumber}`;
                if (validContacts.some(c => c.number === formattedNumber)) continue;

                // 4. Professional Name Resolution: Query store cache, pushName, or custom resolution
                let resolvedName = '';
                
                // Try sock.getName() helper if available in the Baileys instance
                if (typeof sock.getName === 'function' && rawJidForStore) {
                    try {
                        const storeName = await sock.getName(rawJidForStore);
                        if (storeName && !storeName.includes('@') && storeName !== cleanNumber) {
                            resolvedName = storeName;
                        }
                    } catch (e) {}
                }

                // Fallback checks on participant metadata fields
                if (!resolvedName) {
                    resolvedName = member.notify || member.name || member.verifiedName;
                }

                // Final safety fallback: use the clean phone number label instead of any raw ID string
                if (!resolvedName || resolvedName.includes('@') || resolvedName === cleanNumber) {
                    resolvedName = `User ${cleanNumber}`;
                }

                const displayName = `${resolvedName} by Queen Vida`;

                validContacts.push({
                    name: displayName,
                    number: formattedNumber
                });
            }

            if (validContacts.length === 0) {
                return sock.sendMessage(from, { text: '❌ No valid phone numbers could be resolved from this group.' }, { quoted: m });
            }

            // Chunk into batches of 100
            const batchSize = 100;
            const batches = [];
            for (let i = 0; i < validContacts.length; i += batchSize) {
                batches.push(validContacts.slice(i, i + batchSize));
            }

            await sock.sendMessage(from, { text: `📦 Total contacts resolved: *${validContacts.length}*. Sending in *${batches.length}* batch(es) of up to 100...` }, { quoted: m });

            const batchNamesMap = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth"];

            for (let index = 0; index < batches.length; index++) {
                const batch = batches[index];
                let vcfData = '';

                for (const contact of batch) {
                    vcfData += `BEGIN:VCARD\n`;
                    vcfData += `VERSION:3.0\n`;
                    vcfData += `FN:${contact.name}\n`;
                    vcfData += `TEL;type=CELL;type=VOICE:${contact.number}\n`;
                    vcfData += `END:VCARD\n\n`;
                }

                const batchLabel = batchNamesMap[index] || `Batch ${index + 1}`;
                const fileName = `Group_Contacts_Batch_${index + 1}.vcf`;
                const filePath = path.join(__dirname, '..', fileName);
                fs.writeFileSync(filePath, vcfData);

                const captionText = 
`               *${batchLabel} batch* \n` +
`✅ *VCF Export Success*\n\n` +
`📂 Group: ${groupName}\n` +
`👤 Contacts Processed: ${batch.length}\n\n` +
`> _ everyone download and import the vcf so we can view each other status automatically_`;

                await sock.sendMessage(from, {
                    document: fs.readFileSync(filePath),
                    mimetype: 'text/vcard',
                    fileName: fileName,
                    caption: captionText
                }, { quoted: m });

                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }

                if (index < batches.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }
            }

        } catch (err) {
            console.error('Error generating batch VCF files:', err);
            await sock.sendMessage(from, { text: '❌ Failed to generate batch VCF files.' }, { quoted: m });
        }
    }
};
