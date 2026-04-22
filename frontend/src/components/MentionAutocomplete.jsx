import { useState, useRef, useCallback } from 'react';
import './MentionAutocomplete.css';

function MentionAutocomplete({ value, onChange, members = [], textareaRef: externalRef, onKeyDown: passedOnKeyDown, ...textareaProps }) {
  const [suggestions, setSuggestions] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState(-1);
  const internalRef = useRef(null);
  const ref = externalRef || internalRef;

  const getMentionQuery = (text, cursorPos) => {
    const before = text.slice(0, cursorPos);
    const match = before.match(/@([a-zA-Z0-9_]*)$/);
    if (!match) return null;
    return { query: match[1], start: cursorPos - match[0].length };
  };

  const handleChange = useCallback((e) => {
    onChange(e);
    const { value: newValue, selectionStart } = e.target;
    const mention = getMentionQuery(newValue, selectionStart);
    if (mention) {
      const filtered = members
        .filter(m => m.username.toLowerCase().startsWith(mention.query.toLowerCase()))
        .slice(0, 6);
      setSuggestions(filtered);
      setSelectedIndex(0);
      setMentionStart(mention.start);
    } else {
      setSuggestions([]);
      setMentionStart(-1);
    }
  }, [members, onChange]);

  const selectSuggestion = useCallback((member) => {
    const textarea = ref.current;
    const cursorPos = textarea.selectionStart;
    const before = value.slice(0, mentionStart);
    const after = value.slice(cursorPos);
    const newValue = before + '@' + member.username + ' ' + after;
    onChange({ target: { value: newValue } });
    setSuggestions([]);
    setMentionStart(-1);
    setTimeout(() => {
      textarea.focus();
      const pos = mentionStart + member.username.length + 2;
      textarea.setSelectionRange(pos, pos);
    }, 0);
  }, [value, mentionStart, onChange, ref]);

  const handleKeyDown = useCallback((e) => {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, suggestions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        selectSuggestion(suggestions[selectedIndex]);
      } else if (e.key === 'Escape') {
        setSuggestions([]);
      } else {
        passedOnKeyDown?.(e);
      }
    } else {
      passedOnKeyDown?.(e);
    }
  }, [suggestions, selectedIndex, selectSuggestion, passedOnKeyDown]);

  return (
    <div className="mention-autocomplete-wrapper">
      <textarea
        ref={ref}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        {...textareaProps}
      />
      {suggestions.length > 0 && (
        <div className="mention-suggestions">
          {suggestions.map((member, i) => (
            <button
              key={member.id}
              className={`mention-suggestion-item${i === selectedIndex ? ' selected' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); selectSuggestion(member); }}
            >
              <span className="mention-suggestion-avatar">
                {member.avatar_url
                  ? <img src={member.avatar_url} alt={member.display_name || member.username} />
                  : (member.display_name || member.username)[0].toUpperCase()}
              </span>
              <span className="mention-suggestion-info">
                <span className="mention-suggestion-username">@{member.username}</span>
                {member.display_name && member.display_name !== member.username && (
                  <span className="mention-suggestion-display">{member.display_name}</span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default MentionAutocomplete;
