export function renderWithMentions(text, validUsernames) {
    if (!text) return null;
    const parts = text.split(/(@[a-zA-Z0-9_]+)/g);
    return parts.map((part, i) => {
        if (/^@[a-zA-Z0-9_]+$/.test(part)) {
            if (validUsernames && validUsernames.has(part.slice(1).toLowerCase())) {
                return <span key={i} className="mention">{part}</span>;
            }
        }
        return part;
    });
}
