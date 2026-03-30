import './KeyboardShortcutsModal.css';

const shortcuts = [
  {
    category: 'Navigation',
    items: [
      { keys: ['G', 'D'], description: 'Go to Dashboard' },
      { keys: ['G', 'B'], description: 'Go back' },
      { keys: ['?'], description: 'Show keyboard shortcuts' },
      { keys: ['Esc'], description: 'Close modal / Cancel action' },
    ]
  },
  {
    category: 'Board Actions',
    items: [
      { keys: ['N'], description: 'Create new card in first list' },
      { keys: ['L'], description: 'Add new list' },
      { keys: ['F'], description: 'Focus search / Open filter' },
      { keys: ['S'], description: 'Open board settings' },
    ]
  },
  {
    category: 'Card Actions',
    items: [
      { keys: ['E'], description: 'Edit card title (when card selected)' },
      { keys: ['C'], description: 'Add comment (when card modal open)' },
      { keys: ['D'], description: 'Set due date (when card modal open)' },
      { keys: ['M'], description: 'Assign member (when card modal open)' },
      { keys: ['Enter'], description: 'Open selected card' },
      { keys: ['Delete'], description: 'Archive card (when card modal open)' },
    ]
  },
  {
    category: 'Modifiers',
    items: [
      { keys: ['Ctrl/Cmd', '+', 'Enter'], description: 'Save and close' },
      { keys: ['Ctrl/Cmd', '+', 'S'], description: 'Save changes' },
    ]
  }
];

function KeyboardShortcutsModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal keyboard-shortcuts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <svg viewBox="0 0 20 20" fill="currentColor" className="header-icon">
              <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z" clipRule="evenodd" />
            </svg>
            Keyboard Shortcuts
          </h2>
          <button className="modal-close" onClick={onClose}>
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="shortcuts-content">
          {shortcuts.map((section) => (
            <div key={section.category} className="shortcuts-section">
              <h3 className="section-title">{section.category}</h3>
              <div className="shortcuts-list">
                {section.items.map((shortcut, index) => (
                  <div key={index} className="shortcut-item">
                    <div className="shortcut-keys">
                      {shortcut.keys.map((key, keyIndex) => (
                        <span key={keyIndex}>
                          {key === '+' ? (
                            <span className="key-separator">+</span>
                          ) : (
                            <kbd className="key">{key}</kbd>
                          )}
                        </span>
                      ))}
                    </div>
                    <span className="shortcut-description">{shortcut.description}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="shortcuts-footer">
          <p>Press <kbd>?</kbd> anytime to show this help</p>
        </div>
      </div>
    </div>
  );
}

export default KeyboardShortcutsModal;
