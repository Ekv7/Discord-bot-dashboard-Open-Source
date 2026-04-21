/** @param {unknown} v */
export function escapeHtml(v) {
    if (v == null) return '';
    return String(v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** @param {string} s @param {number} max */
export function trunc(s, max) {
    const t = s.trim();
    if (t.length <= max) return t;
    return `${t.slice(0, max - 1)}…`;
}

/** @param {number} t */
export function channelKind(t) {
    if (typeof t !== 'number') return 'Kanal';
    switch (t) {
        case 0:
            return 'Text';
        case 2:
            return 'Voice';
        case 4:
            return 'Kategorie';
        case 5:
            return 'Ankündigung';
        case 10:
            return 'News-Thread';
        case 11:
            return 'Thread';
        case 12:
            return 'Privater Thread';
        case 13:
            return 'Stage';
        case 15:
            return 'Forum';
        case 16:
            return 'Forum-Post';
        default:
            return `Typ ${t}`;
    }
}
