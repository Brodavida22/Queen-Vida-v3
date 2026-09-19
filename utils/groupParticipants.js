function normalizeJid(value) {
    return String(value || '').trim().toLowerCase();
}

function getSenderJid(message) {
    return (
        message?.key?.participant ||
        message?.participant ||
        message?.key?.remoteJid ||
        ''
    );
}

function getParticipantJids(participant) {
    return [
        participant?.id,
        participant?.jid,
        participant?.lid,
        participant?.phoneNumber,
        participant?.phone_number
    ]
        .filter(Boolean)
        .map(normalizeJid);
}

function isPhoneJid(jid) {
    return /@(s\.whatsapp\.net|c\.us)$/.test(
        normalizeJid(jid)
    );
}

function getPhoneNumber(jid) {
    const normalized = normalizeJid(jid);

    if (!isPhoneJid(normalized)) {
        return '';
    }

    return normalized
        .replace(/@(s\.whatsapp\.net|c\.us)$/, '')
        .replace(/[^0-9]/g, '');
}

function findParticipant(metadata, senderJid) {
    const participants = Array.isArray(metadata?.participants)
        ? metadata.participants
        : [];
    const sender = normalizeJid(senderJid);

    if (!sender) {
        return null;
    }

    const exactMatch = participants.find(participant =>
        getParticipantJids(participant).includes(sender)
    );

    if (exactMatch) {
        return exactMatch;
    }

    // Older group metadata may expose only the phone JID while the
    // incoming message uses a phone JID with a different legacy suffix.
    const senderNumber = getPhoneNumber(sender);

    if (!senderNumber) {
        return null;
    }

    return (
        participants.find(participant =>
            getParticipantJids(participant).some(
                jid => getPhoneNumber(jid) === senderNumber
            )
        ) || null
    );
}

function isAdminParticipant(participant) {
    return (
        participant?.admin === 'admin' ||
        participant?.admin === 'superadmin'
    );
}

function isOwnerParticipant(participant, ownerNumbers) {
    const owners = new Set(
        (Array.isArray(ownerNumbers) ? ownerNumbers : [])
            .map(number =>
                String(number || '').replace(/[^0-9]/g, '')
            )
            .filter(Boolean)
    );

    return getParticipantJids(participant).some(jid =>
        owners.has(getPhoneNumber(jid))
    );
}

module.exports = {
    getSenderJid,
    findParticipant,
    isAdminParticipant,
    isOwnerParticipant
};