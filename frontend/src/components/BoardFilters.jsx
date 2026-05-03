import { useState, useRef, useEffect } from 'react';
import useBoardStore from '../store/boardStore';
import './BoardFilters.css';

function BoardFilters({ filters, onFilterChange }) {
  const { labels, members, priorities } = useBoardStore();
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState(filters.search || '');
  const filterRef = useRef(null);

  // Close filters when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setShowFilters(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    onFilterChange({ ...filters, search: value });
  };

  const handleLabelToggle = (labelId) => {
    const currentLabels = filters.labels || [];
    const newLabels = currentLabels.includes(labelId)
      ? currentLabels.filter(id => id !== labelId)
      : [...currentLabels, labelId];
    onFilterChange({ ...filters, labels: newLabels });
  };

  const handleMemberToggle = (memberId) => {
    const currentMembers = filters.members || [];
    const newMembers = currentMembers.includes(memberId)
      ? currentMembers.filter(id => id !== memberId)
      : [...currentMembers, memberId];
    onFilterChange({ ...filters, members: newMembers });
  };

  const handleDueDateFilter = (dueFilter) => {
    onFilterChange({
      ...filters,
      dueDate: filters.dueDate === dueFilter ? null : dueFilter
    });
  };

  const handlePriorityFilter = (priority) => {
    const currentPriorities = filters.priorities || [];
    const newPriorities = currentPriorities.includes(priority)
      ? currentPriorities.filter(p => p !== priority)
      : [...currentPriorities, priority];
    onFilterChange({ ...filters, priorities: newPriorities });
  };

  const clearFilters = () => {
    setSearchQuery('');
    onFilterChange({
      search: '',
      labels: [],
      members: [],
      dueDate: null,
      priorities: []
    });
  };

  const hasActiveFilters =
    (filters.labels && filters.labels.length > 0) ||
    (filters.members && filters.members.length > 0) ||
    filters.dueDate ||
    (filters.priorities && filters.priorities.length > 0);

  const activeFilterCount =
    (filters.labels?.length || 0) +
    (filters.members?.length || 0) +
    (filters.dueDate ? 1 : 0) +
    (filters.priorities?.length || 0);

  return (
    <div className="board-filters" ref={filterRef}>
      <div className="search-bar">
        <svg viewBox="0 0 20 20" fill="currentColor" className="search-icon">
          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Search cards..."
          className="search-input"
        />
        {searchQuery && (
          <button
            className="search-clear"
            onClick={() => {
              setSearchQuery('');
              onFilterChange({ ...filters, search: '' });
            }}
          >
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>

      <button
        className={`filter-toggle ${showFilters ? 'active' : ''} ${hasActiveFilters ? 'has-filters' : ''}`}
        onClick={() => setShowFilters(!showFilters)}
      >
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
        </svg>
        Filters
        {activeFilterCount > 0 && (
          <span className="filter-count">{activeFilterCount}</span>
        )}
      </button>

      {showFilters && (
        <div className="filters-dropdown">
          <div className="filters-header">
            <h3>Filter Cards</h3>
            {hasActiveFilters && (
              <button className="clear-filters-btn" onClick={clearFilters}>
                Clear all
              </button>
            )}
          </div>

          {/* Labels Filter */}
          <div className="filter-section">
            <h4 className="filter-section-title">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              Labels
            </h4>
            <div className="filter-options labels-filter">
              {labels.map(label => (
                <button
                  key={label.id}
                  className={`filter-label ${filters.labels?.includes(label.id) ? 'selected' : ''}`}
                  onClick={() => handleLabelToggle(label.id)}
                >
                  <span
                    className="label-color"
                    style={{ background: label.color }}
                  />
                  <span className="label-name">{label.name}</span>
                  {filters.labels?.includes(label.id) && (
                    <svg viewBox="0 0 20 20" fill="currentColor" className="check-icon">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
              {labels.length === 0 && (
                <p className="filter-empty">No labels available</p>
              )}
            </div>
          </div>

          {/* Members Filter */}
          <div className="filter-section">
            <h4 className="filter-section-title">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
              </svg>
              Members
            </h4>
            <div className="filter-options members-filter">
              {members.map(member => (
                <button
                  key={member.id}
                  className={`filter-member ${filters.members?.includes(member.id) ? 'selected' : ''}`}
                  onClick={() => handleMemberToggle(member.id)}
                >
                  <div className="member-avatar-small">
                    {member.avatar_url ? (
                      <img src={member.avatar_url} alt={member.display_name || member.username} />
                    ) : (
                      <span>{(member.display_name || member.username)[0].toUpperCase()}</span>
                    )}
                  </div>
                  <span className="member-name">{member.display_name || member.username}</span>
                  {filters.members?.includes(member.id) && (
                    <svg viewBox="0 0 20 20" fill="currentColor" className="check-icon">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
              {members.length === 0 && (
                <p className="filter-empty">No members available</p>
              )}
            </div>
          </div>

          {/* Due Date Filter */}
          <div className="filter-section">
            <h4 className="filter-section-title">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
              Due Date
            </h4>
            <div className="filter-options due-filter">
              <button
                className={`filter-due ${filters.dueDate === 'overdue' ? 'selected' : ''}`}
                onClick={() => handleDueDateFilter('overdue')}
              >
                <span className="due-indicator overdue" />
                Overdue
              </button>
              <button
                className={`filter-due ${filters.dueDate === 'today' ? 'selected' : ''}`}
                onClick={() => handleDueDateFilter('today')}
              >
                <span className="due-indicator today" />
                Due Today
              </button>
              <button
                className={`filter-due ${filters.dueDate === 'week' ? 'selected' : ''}`}
                onClick={() => handleDueDateFilter('week')}
              >
                <span className="due-indicator week" />
                Due This Week
              </button>
              <button
                className={`filter-due ${filters.dueDate === 'none' ? 'selected' : ''}`}
                onClick={() => handleDueDateFilter('none')}
              >
                <span className="due-indicator none" />
                No Due Date
              </button>
            </div>
          </div>

          {/* Priority Filter */}
          <div className="filter-section">
            <h4 className="filter-section-title">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd" />
              </svg>
              Priority
            </h4>
            <div className="filter-options priority-filter">
              {(priorities || [])
                .filter(p => p.value !== 'none')
                .map(p => (
                  <button
                    key={p.value}
                    className={`filter-priority ${filters.priorities?.includes(p.value) ? 'selected' : ''}`}
                    onClick={() => handlePriorityFilter(p.value)}
                  >
                    <span className="priority-indicator" style={{ background: p.color }} />
                    {p.label}
                  </button>
                ))
              }
              {(!priorities || priorities.filter(p => p.value !== 'none').length === 0) && (
                <p className="filter-empty">No priorities available</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BoardFilters;
