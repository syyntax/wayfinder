import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import toast from 'react-hot-toast';
import useBoardStore from '../store/boardStore';
import KanbanCard from './KanbanCard';
import './KanbanList.css';

function KanbanList({ list, onCardClick }) {
  const { createCard, updateList, deleteList } = useBoardStore();
  const [isEditing, setIsEditing] = useState(false);
  const [listName, setListName] = useState(list.name);
  const [showAddCard, setShowAddCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [showMenu, setShowMenu] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: list.id,
    data: {
      type: 'list',
      list,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const cards = (list.cards || []).sort((a, b) => a.position - b.position);

  const handleUpdateName = async () => {
    if (listName.trim() && listName !== list.name) {
      try {
        await updateList(list.id, { name: listName.trim() });
      } catch (error) {
        toast.error('Failed to update list');
        setListName(list.name);
      }
    }
    setIsEditing(false);
  };

  const handleAddCard = async () => {
    if (!newCardTitle.trim()) return;

    try {
      await createCard({
        title: newCardTitle.trim(),
        listId: list.id,
      });
      setNewCardTitle('');
      setShowAddCard(false);
    } catch (error) {
      toast.error('Failed to create card');
    }
  };

  const handleDeleteList = async () => {
    if (window.confirm(`Archive "${list.name}" and all its cards?`)) {
      try {
        await deleteList(list.id);
        toast.success('List archived');
      } catch (error) {
        toast.error('Failed to archive list');
      }
    }
    setShowMenu(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`kanban-list ${isDragging ? 'dragging' : ''}`}
    >
      <div className="list-header" {...attributes} {...listeners}>
        {isEditing ? (
          <input
            type="text"
            value={listName}
            onChange={(e) => setListName(e.target.value)}
            onBlur={handleUpdateName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleUpdateName();
              if (e.key === 'Escape') {
                setListName(list.name);
                setIsEditing(false);
              }
            }}
            autoFocus
            className="list-name-input"
          />
        ) : (
          <h3 className="list-name" onClick={() => setIsEditing(true)}>
            {list.name}
            <span className="card-count">{cards.length}</span>
          </h3>
        )}

        <div className="list-menu-wrapper">
          <button
            className="list-menu-button"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
          >
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
            </svg>
          </button>

          {showMenu && (
            <>
              <div className="list-menu-backdrop" onClick={() => setShowMenu(false)} />
              <div className="list-menu">
                <button onClick={() => { setIsEditing(true); setShowMenu(false); }}>
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                  Rename List
                </button>
                <button className="danger" onClick={handleDeleteList}>
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Archive List
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="list-content">
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <KanbanCard
              key={card.id}
              card={card}
              onClick={() => onCardClick(card)}
            />
          ))}
        </SortableContext>

        {showAddCard ? (
          <div className="add-card-form">
            <textarea
              value={newCardTitle}
              onChange={(e) => setNewCardTitle(e.target.value)}
              placeholder="Enter a title for this card..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAddCard();
                }
                if (e.key === 'Escape') {
                  setShowAddCard(false);
                  setNewCardTitle('');
                }
              }}
            />
            <div className="add-card-actions">
              <button className="btn btn-primary btn-sm" onClick={handleAddCard}>
                Add Card
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setShowAddCard(false);
                  setNewCardTitle('');
                }}
              >
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        ) : (
          <button className="add-card-button" onClick={() => setShowAddCard(true)}>
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
            </svg>
            Add a card
          </button>
        )}
      </div>
    </div>
  );
}

export default KanbanList;
