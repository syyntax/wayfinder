import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { isToday, isThisWeek, isPast, parseISO } from 'date-fns';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import toast from 'react-hot-toast';
import useBoardStore from '../store/boardStore';
import KanbanList from '../components/KanbanList';
import KanbanCard from '../components/KanbanCard';
import CardDetailModal from '../components/CardDetailModal';
import BoardSettingsModal from '../components/BoardSettingsModal';
import BoardFilters from '../components/BoardFilters';
import KeyboardShortcutsModal from '../components/KeyboardShortcutsModal';
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts';
import './BoardPage.css';

function BoardPage() {
  const { boardId } = useParams();
  const navigate = useNavigate();
  const {
    currentBoard,
    lists,
    labels,
    members,
    isLoading,
    fetchBoard,
    clearCurrentBoard,
    setCurrentBoard,
    createList,
    moveCard,
    reorderLists,
  } = useBoardStore();

  const [activeCard, setActiveCard] = useState(null);
  const [activeList, setActiveList] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [showAddList, setShowAddList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    labels: [],
    members: [],
    dueDate: null,
    priorities: []
  });
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Click-and-drag horizontal scrolling state
  const [isDraggingBoard, setIsDraggingBoard] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [scrollStartLeft, setScrollStartLeft] = useState(0);
  const boardContentRef = useRef(null);

  // Keyboard shortcuts
  const shortcuts = useMemo(() => ({
    '?': () => setShowShortcuts(true),
    'escape': () => {
      if (showShortcuts) setShowShortcuts(false);
      else if (showSettings) setShowSettings(false);
      else if (selectedCard) setSelectedCard(null);
      else if (showAddList) {
        setShowAddList(false);
        setNewListName('');
      }
    },
    'n': () => {
      // Create new card in first list
      if (lists.length > 0 && !selectedCard && !showSettings) {
        const firstList = document.querySelector('.kanban-list .add-card-button');
        if (firstList) firstList.click();
      }
    },
    'l': () => {
      if (!selectedCard && !showSettings) {
        setShowAddList(true);
      }
    },
    'f': () => {
      if (!selectedCard && !showSettings) {
        const searchInput = document.querySelector('.search-input');
        if (searchInput) searchInput.focus();
      }
    },
    's': () => {
      if (!selectedCard && !showAddList) {
        setShowSettings(true);
      }
    },
  }), [showShortcuts, showSettings, selectedCard, showAddList, lists.length]);

  useKeyboardShortcuts(shortcuts, !isLoading && !!currentBoard);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchBoard(boardId).catch((error) => {
      toast.error('Failed to load board');
      navigate('/dashboard');
    });

    return () => clearCurrentBoard();
  }, [boardId, fetchBoard, clearCurrentBoard, navigate]);

  const handleDragStart = useCallback((event) => {
    const { active } = event;
    const activeData = active.data.current;

    if (activeData?.type === 'card') {
      setActiveCard(activeData.card);
    } else if (activeData?.type === 'list') {
      setActiveList(activeData.list);
    }
  }, []);

  const handleDragOver = useCallback((event) => {
    // Handle drag over for cards moving between lists
  }, []);

  const handleDragEnd = useCallback(
    async (event) => {
      const { active, over } = event;

      if (!over) {
        setActiveCard(null);
        setActiveList(null);
        return;
      }

      const activeData = active.data.current;
      const overData = over.data.current;

      // Handle card movement
      if (activeData?.type === 'card') {
        const activeCardId = active.id;
        let targetListId;
        let position;

        if (overData?.type === 'card') {
          // Dropped on another card
          targetListId = overData.card.list_id;
          const targetList = lists.find((l) => l.id === targetListId);
          const targetCards = targetList?.cards || [];
          position = targetCards.findIndex((c) => c.id === over.id);
        } else if (overData?.type === 'list') {
          // Dropped on a list
          targetListId = over.id;
          const targetList = lists.find((l) => l.id === targetListId);
          position = (targetList?.cards || []).length;
        }

        if (targetListId && typeof position === 'number') {
          try {
            await moveCard(activeCardId, targetListId, position);
          } catch (error) {
            toast.error('Failed to move card');
          }
        }
      }

      // Handle list reordering
      if (activeData?.type === 'list' && overData?.type === 'list') {
        const oldIndex = lists.findIndex((l) => l.id === active.id);
        const newIndex = lists.findIndex((l) => l.id === over.id);

        if (oldIndex !== newIndex) {
          const newOrder = [...lists];
          const [removed] = newOrder.splice(oldIndex, 1);
          newOrder.splice(newIndex, 0, removed);

          try {
            await reorderLists(
              boardId,
              newOrder.map((l) => l.id)
            );
          } catch (error) {
            toast.error('Failed to reorder lists');
          }
        }
      }

      setActiveCard(null);
      setActiveList(null);
    },
    [lists, moveCard, reorderLists, boardId]
  );

  const handleAddList = async () => {
    if (!newListName.trim()) return;

    try {
      await createList({
        name: newListName.trim(),
        boardId,
      });
      setNewListName('');
      setShowAddList(false);
      toast.success('List created');
    } catch (error) {
      toast.error('Failed to create list');
    }
  };

  // Filter cards function
  const filterCards = useCallback((cards) => {
    if (!cards) return [];

    return cards.filter(card => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const titleMatch = card.title?.toLowerCase().includes(searchLower);
        const descMatch = card.description?.toLowerCase().includes(searchLower);
        if (!titleMatch && !descMatch) return false;
      }

      // Labels filter
      if (filters.labels && filters.labels.length > 0) {
        const cardLabelIds = (card.labels || []).map(l => l.id);
        const hasMatchingLabel = filters.labels.some(labelId => cardLabelIds.includes(labelId));
        if (!hasMatchingLabel) return false;
      }

      // Members filter
      if (filters.members && filters.members.length > 0) {
        const cardMemberIds = (card.assignees || []).map(a => a.id);
        const hasMatchingMember = filters.members.some(memberId => cardMemberIds.includes(memberId));
        if (!hasMatchingMember) return false;
      }

      // Due date filter
      if (filters.dueDate) {
        const dueDate = card.due_date ? parseISO(card.due_date) : null;

        switch (filters.dueDate) {
          case 'overdue':
            if (!dueDate || !isPast(dueDate) || isToday(dueDate)) return false;
            break;
          case 'today':
            if (!dueDate || !isToday(dueDate)) return false;
            break;
          case 'week':
            if (!dueDate || !isThisWeek(dueDate)) return false;
            break;
          case 'none':
            if (dueDate) return false;
            break;
        }
      }

      // Priority filter
      if (filters.priorities && filters.priorities.length > 0) {
        if (!filters.priorities.includes(card.priority)) return false;
      }

      return true;
    });
  }, [filters]);

  // Apply filters to lists
  const filteredLists = useMemo(() => {
    return lists.map(list => ({
      ...list,
      cards: filterCards(list.cards)
    }));
  }, [lists, filterCards]);

  // Check if any filters are active
  const hasActiveFilters = filters.search ||
    (filters.labels && filters.labels.length > 0) ||
    (filters.members && filters.members.length > 0) ||
    filters.dueDate ||
    (filters.priorities && filters.priorities.length > 0);

  // Click-and-drag horizontal scrolling handlers
  const handleBoardMouseDown = useCallback((e) => {
    // Only start drag if clicking directly on the board-content element
    // This prevents conflicts with card/list drag-and-drop
    if (e.target.classList.contains('board-content')) {
      setIsDraggingBoard(true);
      setDragStartX(e.pageX);
      setScrollStartLeft(boardContentRef.current?.scrollLeft || 0);
      // Prevent text selection while dragging
      e.preventDefault();
    }
  }, []);

  const handleBoardMouseMove = useCallback((e) => {
    if (!isDraggingBoard || !boardContentRef.current) return;
    e.preventDefault();
    const deltaX = e.pageX - dragStartX;
    // Scroll in opposite direction of drag (natural scrolling)
    boardContentRef.current.scrollLeft = scrollStartLeft - deltaX;
  }, [isDraggingBoard, dragStartX, scrollStartLeft]);

  const handleBoardMouseUp = useCallback(() => {
    setIsDraggingBoard(false);
  }, []);

  const handleBoardMouseLeave = useCallback(() => {
    setIsDraggingBoard(false);
  }, []);

  // Attach global mouse event listeners when dragging to handle edge cases
  useEffect(() => {
    if (isDraggingBoard) {
      const handleGlobalMouseUp = () => setIsDraggingBoard(false);
      const handleGlobalMouseMove = (e) => {
        if (!boardContentRef.current) return;
        e.preventDefault();
        const deltaX = e.pageX - dragStartX;
        boardContentRef.current.scrollLeft = scrollStartLeft - deltaX;
      };

      window.addEventListener('mouseup', handleGlobalMouseUp);
      window.addEventListener('mousemove', handleGlobalMouseMove);

      return () => {
        window.removeEventListener('mouseup', handleGlobalMouseUp);
        window.removeEventListener('mousemove', handleGlobalMouseMove);
      };
    }
  }, [isDraggingBoard, dragStartX, scrollStartLeft]);

  if (isLoading || !currentBoard) {
    return (
      <div className="board-loading">
        <div className="spinner"></div>
        <p>Loading mission board...</p>
      </div>
    );
  }

  const sortedLists = [...filteredLists].sort((a, b) => a.position - b.position);

  return (
    <div className={`board-page ${currentBoard.cover_image ? 'has-cover' : ''}`}>
      {/* Board Cover Image Banner */}
      {currentBoard.cover_image && (
        <div className="board-cover-banner">
          <img
            src={currentBoard.cover_image}
            alt={`${currentBoard.name} cover`}
            onError={(e) => {
              e.target.parentElement.style.display = 'none';
            }}
          />
          <div className="board-cover-banner-overlay" />
        </div>
      )}

      <div className={`board-header ${currentBoard.cover_image ? 'with-cover' : ''}`}>
        <div className="board-info">
          <button className="back-button" onClick={() => navigate('/dashboard')}>
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
          </button>
          <div className="board-title-section">
            <h1 className="board-title">{currentBoard.name}</h1>
            {currentBoard.description && (
              <p className="board-description">{currentBoard.description}</p>
            )}
          </div>
        </div>
        <div className="board-actions">
          <BoardFilters filters={filters} onFilterChange={setFilters} />
          <div className="board-members">
            {members.slice(0, 5).map((member) => (
              <div key={member.id} className="member-avatar" title={member.display_name || member.username}>
                {member.avatar_url ? (
                  <img src={member.avatar_url} alt={member.display_name} />
                ) : (
                  <span>{(member.display_name || member.username)[0].toUpperCase()}</span>
                )}
              </div>
            ))}
            {members.length > 5 && (
              <div className="member-avatar more">+{members.length - 5}</div>
            )}
          </div>
          <button
            className="board-settings-button"
            onClick={() => setShowSettings(true)}
            title="Board Settings"
          >
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div
          className={`board-content ${isDraggingBoard ? 'dragging' : ''}`}
          ref={boardContentRef}
          onMouseDown={handleBoardMouseDown}
          onMouseMove={handleBoardMouseMove}
          onMouseUp={handleBoardMouseUp}
          onMouseLeave={handleBoardMouseLeave}
        >
          <SortableContext
            items={sortedLists.map((l) => l.id)}
            strategy={horizontalListSortingStrategy}
          >
            {sortedLists.map((list) => (
              <KanbanList
                key={list.id}
                list={list}
                onCardClick={setSelectedCard}
              />
            ))}
          </SortableContext>

          {showAddList ? (
            <div className="add-list-form">
              <input
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="Enter list name..."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddList();
                  if (e.key === 'Escape') {
                    setShowAddList(false);
                    setNewListName('');
                  }
                }}
              />
              <div className="add-list-actions">
                <button className="btn btn-primary btn-sm" onClick={handleAddList}>
                  Add List
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setShowAddList(false);
                    setNewListName('');
                  }}
                >
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            <button className="add-list-button" onClick={() => setShowAddList(true)}>
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
              </svg>
              Add List
            </button>
          )}
        </div>

        <DragOverlay>
          {activeCard && (
            <div className="drag-overlay-card">
              <KanbanCard card={activeCard} isDragging />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {selectedCard && (
        <CardDetailModal
          cardId={selectedCard.id}
          onClose={() => setSelectedCard(null)}
          labels={labels}
          members={members}
        />
      )}

      {showSettings && (
        <BoardSettingsModal
          board={currentBoard}
          onClose={() => setShowSettings(false)}
          onUpdate={(updatedBoard) => {
            setCurrentBoard(updatedBoard);
            setShowSettings(false);
          }}
        />
      )}

      {showShortcuts && (
        <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} />
      )}
    </div>
  );
}

export default BoardPage;
