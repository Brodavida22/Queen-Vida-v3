const fs = require('fs');

const CREATOR_NUMBERS = ["2348138558590", "2348138558590"];

module.exports = {
    name: 'badwords',
    description: 'Manages profanity filter and blacklisted words in the group (Admins/Creators only)',
    async execute(sock, m, from, args) {
        if (!from.endsWith('@g.us')) {
            return sock.sendMessage(from, { text: '❌ This command can only be used inside groups!' }, { quoted: m });
        }

        const sender = m.key.participant || m.key.remoteJid;
        const senderNumber = sender.replace(/[^0-9]/g, '');
        const isOwner = CREATOR_NUMBERS.includes(senderNumber) || m.key.fromMe;

        // Check group admin status (Creators bypass this entirely)
        let isAdmin = false;
        if (!isOwner) {
            try {
                const groupMetadata = await sock.groupMetadata(from);
                const participants = groupMetadata.participants || [];
                const participantObj = participants.find(p => p.id.replace(/[^0-9]/g, '') === senderNumber);
                isAdmin = participantObj && (participantObj.admin === 'admin' || participantObj.admin === 'superadmin');
            } catch (e) {
                console.error('Error fetching group metadata for admin check:', e);
            }
        }

        // Access Control: Only Admins or Creators can modify/manage badwords settings
        if (!isOwner && !isAdmin) {
            return sock.sendMessage(from, { text: '❌ *Access Denied:* Only group admins and creators can manage the bad words filter.' }, { quoted: m });
        }

        const subCommand = args[0]?.toLowerCase();
        let settings = fs.existsSync('settings.json') ? JSON.parse(fs.readFileSync('settings.json')) : {};
        if (!settings.badwords) settings.badwords = {};
        if (!settings.badwords[from]) settings.badwords[from] = { status: 'off', list: [] };

        const groupBadWords = settings.badwords[from];

        if (subCommand === 'on') {
            groupBadWords.status = 'on';
            fs.writeFileSync('settings.json', JSON.stringify(settings, null, 2));
            return sock.sendMessage(from, { text: '✅ Bad words profanity filter has been turned *ON* 🟢' }, { quoted: m });
        } 
        
        if (subCommand === 'off') {
            groupBadWords.status = 'off';
            fs.writeFileSync('settings.json', JSON.stringify(settings, null, 2));
            return sock.sendMessage(from, { text: '❌ Bad words profanity filter has been turned *OFF* 🔴' }, { quoted: m });
        } 
        
        if (subCommand === 'list') {
            if (groupBadWords.list.length === 0) {
                return sock.sendMessage(from, { text: '📋 There are no blacklisted bad words configured for this group yet.' }, { quoted: m });
            }
            const wordListFormatted = groupBadWords.list.map((word, index) => `${index + 1}. ${word}`).join('\n');
            return sock.sendMessage(from, { text: `📋 *Group Blacklisted Words:*\n\n${wordListFormatted}` }, { quoted: m });
        } 
        
        if (subCommand === 'add') {
            const wordToAdd = args.slice(1).join(' ').toLowerCase();
            if (!wordToAdd) {
                return sock.sendMessage(from, { text: '❌ Please specify a word to add! Usage: *!badwords add <word>*' }, { quoted: m });
            }
            if (groupBadWords.list.includes(wordToAdd)) {
                return sock.sendMessage(from, { text: `⚠️ *"${wordToAdd}"* is already in the blacklist!` }, { quoted: m });
            }

            groupBadWords.list.push(wordToAdd);
            fs.writeFileSync('settings.json', JSON.stringify(settings, null, 2));
            return sock.sendMessage(from, { text: `✅ Successfully added *"${wordToAdd}"* to the bad words blacklist.` }, { quoted: m });
        } 
        
        if (subCommand === 'remove') {
            const wordToRemove = args.slice(1).join(' ').toLowerCase();
            if (!wordToRemove) {
                return sock.sendMessage(from, { text: '❌ Please specify a word to remove! Usage: *!badwords remove <word>*' }, { quoted: m });
            }
            const index = groupBadWords.list.indexOf(wordToRemove);
            if (index === -1) {
                return sock.sendMessage(from, { text: `⚠️ *"${wordToRemove}"* was not found in the blacklist!` }, { quoted: m });
            }

            groupBadWords.list.splice(index, 1);
            fs.writeFileSync('settings.json', JSON.stringify(settings, null, 2));
            return sock.sendMessage(from, { text: `✅ Successfully removed *"${wordToRemove}"* from the bad words blacklist.` }, { quoted: m });
        }

        // Help Instructions if arguments are invalid
        const helpText = 
`❌ *Invalid Badwords Usage!*\n\n` +
`• *!badwords on* - Enable filter\n` +
`• *!badwords off* - Disable filter\n` +
`• *!badwords add <word>* - Blacklist a word\n` +
`• *!badwords remove <word>* - Remove word\n` +
`• *!badwords list* - View blacklisted words`;

        await sock.sendMessage(from, { text: helpText }, { quoted: m });
    }
};
