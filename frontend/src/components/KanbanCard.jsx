import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format, isPast, isToday, isTomorrow } from 'date-fns';
import useBoardStore from '../store/boardStore';
import './KanbanCard.css';

function KanbanCard({ card, onClick, isDragging: isDraggingProp }) {
  const { priorities } = useBoardStore();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: {
      type: 'card',
      card,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging || isDraggingProp ? 0.7 : 1,
  };

  const formatDueDate = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'MMM d');
  };

  const getDueDateClass = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isPast(date) && !isToday(date)) return 'overdue';
    if (isToday(date)) return 'due-today';
    if (isTomorrow(date)) return 'due-soon';
    return '';
  };

  // Resolve a priority value to its configured color from the current board's
  // priority list. Returns null when there is no configuration or it's 'none'.
  const getPriorityColor = (value) => {
    if (!value || value === 'none') return null;
    const p = (priorities || []).find(p => p.value === value);
    if (!p) return null;
    if (!p.color || p.color === 'transparent') return null;
    return p.color;
  };

  const priorityColor = getPriorityColor(card.priority);
  const hasChecklist = card.checklist_total > 0;
  const checklistProgress = hasChecklist
    ? Math.round((card.checklist_completed / card.checklist_total) * 100)
    : 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`kanban-card ${isDragging || isDraggingProp ? 'dragging' : ''} ${card.cover_image ? 'has-cover' : ''}`}
      onClick={onClick}
    >
      {/* Cover Image */}
      {card.cover_image && (
        <div className="card-cover-thumbnail">
          <img
            src={card.cover_image}
            alt=""
            onError={(e) => {
              e.target.parentElement.style.display = 'none';
            }}
          />
          <div className="card-cover-thumbnail-overlay" />
        </div>
      )}

      {/* Labels */}
      {card.labels && card.labels.length > 0 && (
        <div className="card-labels">
          {card.labels.map((label) => (
            <span
              key={label.id}
              className="card-label"
              style={{ backgroundColor: label.color }}
              title={label.name}
            />
          ))}
        </div>
      )}

      {/* Title */}
      <h4 className="card-title">{card.title}</h4>

      {/* Meta Info */}
      <div className="card-meta">
        {/* Due Date */}
        {card.due_date && (
          <span className={`meta-badge due-date ${getDueDateClass(card.due_date)}`}>
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            {formatDueDate(card.due_date)}
          </span>
        )}

        {/* Checklist Progress */}
        {hasChecklist && (
          <span className={`meta-badge checklist ${checklistProgress === 100 ? 'complete' : ''}`}>
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            {card.checklist_completed}/{card.checklist_total}
          </span>
        )}

        {/* Comments */}
        {card.comment_count > 0 && (
          <span className="meta-badge">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
            </svg>
            {card.comment_count}
          </span>
        )}

        {/* Description indicator */}
        {card.description && (
          <span className="meta-badge">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm3 1h6v4H7V5zm6 6H7v2h6v-2z" clipRule="evenodd" />
            </svg>
          </span>
        )}
      </div>

      {/* Assignees */}
      {card.assignees && card.assignees.length > 0 && (
        <div className="card-assignees">
          {card.assignees.slice(0, 3).map((assignee) => (
            <div
              key={assignee.id}
              className="assignee-avatar"
              title={assignee.display_name || assignee.username}
            >
              {assignee.avatar_url ? (
                <img src={assignee.avatar_url} alt={assignee.display_name} />
              ) : (
                <span>{(assignee.display_name || assignee.username)[0].toUpperCase()}</span>
              )}
            </div>
          ))}
          {card.assignees.length > 3 && (
            <div className="assignee-avatar more">+{card.assignees.length - 3}</div>
          )}
        </div>
      )}

      {/* Priority indicator bar (color comes from the board's priority config) */}
      {priorityColor && (
        <div
          className="priority-bar"
          style={{
            background: priorityColor,
            boxShadow: `0 0 8px ${priorityColor}60`,
          }}
        />
      )}
    </div>
  );
}

export default KanbanCard;
