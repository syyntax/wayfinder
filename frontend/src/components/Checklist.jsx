import { useState } from 'react';
import toast from 'react-hot-toast';
import { checklistApi } from '../utils/api';
import './Checklist.css';

function Checklist({ checklist, onUpdate, onDelete }) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(checklist.title);
  const [newItemContent, setNewItemContent] = useState('');
  const [showAddItem, setShowAddItem] = useState(false);
  const [items, setItems] = useState(checklist.items || []);

  const completedCount = items.filter((i) => i.is_completed).length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleUpdateTitle = async () => {
    if (title.trim() && title !== checklist.title) {
      try {
        await checklistApi.update(checklist.id, { title: title.trim() });
        onUpdate({ ...checklist, title: title.trim() });
      } catch (error) {
        toast.error('Failed to update checklist');
        setTitle(checklist.title);
      }
    }
    setIsEditing(false);
  };

  const handleAddItem = async () => {
    if (!newItemContent.trim()) return;

    try {
      const response = await checklistApi.addItem({
        checklistId: checklist.id,
        content: newItemContent.trim(),
      });
      setItems([...items, response.data.item]);
      setNewItemContent('');
      setShowAddItem(false);
    } catch (error) {
      toast.error('Failed to add item');
    }
  };

  const handleToggleItem = async (itemId) => {
    try {
      const response = await checklistApi.toggleItem(itemId);
      setItems(items.map((item) => (item.id === itemId ? response.data.item : item)));
    } catch (error) {
      toast.error('Failed to update item');
    }
  };

  const handleDeleteItem = async (itemId) => {
    try {
      await checklistApi.deleteItem(itemId);
      setItems(items.filter((item) => item.id !== itemId));
    } catch (error) {
      toast.error('Failed to delete item');
    }
  };

  const handleDeleteChecklist = async () => {
    if (window.confirm('Delete this checklist?')) {
      try {
        await checklistApi.delete(checklist.id);
        onDelete(checklist.id);
      } catch (error) {
        toast.error('Failed to delete checklist');
      }
    }
  };

  return (
    <div className="checklist">
      <div className="checklist-header">
        <div className="checklist-icon">
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
        {isEditing ? (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleUpdateTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleUpdateTitle();
              if (e.key === 'Escape') {
                setTitle(checklist.title);
                setIsEditing(false);
              }
            }}
            autoFocus
            className="checklist-title-input"
          />
        ) : (
          <h4 className="checklist-title" onClick={() => setIsEditing(true)}>
            {checklist.title}
          </h4>
        )}
        <button className="checklist-delete" onClick={handleDeleteChecklist} title="Delete checklist">
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {totalCount > 0 && (
        <div className="checklist-progress">
          <span className="progress-text">{progress}%</span>
          <div className="progress-bar">
            <div
              className={`progress-fill ${progress === 100 ? 'complete' : ''}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="checklist-items">
        {items.map((item) => (
          <div key={item.id} className={`checklist-item ${item.is_completed ? 'completed' : ''}`}>
            <button
              className="item-checkbox"
              onClick={() => handleToggleItem(item.id)}
              aria-label={item.is_completed ? 'Mark incomplete' : 'Mark complete'}
            >
              {item.is_completed ? (
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              ) : null}
            </button>
            <span className="item-content">{item.content}</span>
            <button
              className="item-delete"
              onClick={() => handleDeleteItem(item.id)}
              aria-label="Delete item"
            >
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {showAddItem ? (
        <div className="add-item-form">
          <input
            type="text"
            value={newItemContent}
            onChange={(e) => setNewItemContent(e.target.value)}
            placeholder="Add an item..."
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddItem();
              if (e.key === 'Escape') {
                setShowAddItem(false);
                setNewItemContent('');
              }
            }}
          />
          <div className="add-item-actions">
            <button className="btn btn-primary btn-sm" onClick={handleAddItem}>
              Add
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setShowAddItem(false);
                setNewItemContent('');
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button className="add-item-button" onClick={() => setShowAddItem(true)}>
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
          </svg>
          Add an item
        </button>
      )}
    </div>
  );
}

export default Checklist;
