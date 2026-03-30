import { useState } from 'react';
import './BoardImportPreview.css';

/**
 * BoardImportPreview component
 * Shows a preview of import data before actually importing
 * Displays statistics, warnings, and allows user to confirm/cancel
 */
function BoardImportPreview({
  previewData,
  importMode,
  onImport,
  onCancel,
  isImporting
}) {
  const { board, stats, warnings, version, exportedAt } = previewData;

  return (
    <div className="import-preview">
      <div className="import-preview-header">
        <div className="import-preview-icon">
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="import-preview-title">
          <h3>Import Preview</h3>
          <span className="import-preview-subtitle">
            {importMode === 'new' ? 'Create new board' : 'Merge into current board'}
          </span>
        </div>
      </div>

      <div className="import-preview-board-info">
        <div className="board-info-name">{board?.name || 'Unnamed Board'}</div>
        {board?.description && (
          <div className="board-info-description">{board.description}</div>
        )}
        <div className="board-info-meta">
          <span className="meta-item">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
            </svg>
            Exported: {exportedAt ? new Date(exportedAt).toLocaleDateString() : 'Unknown'}
          </span>
          <span className="meta-item">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            Version: {version || '1.0'}
          </span>
        </div>
      </div>

      <div className="import-preview-stats">
        <h4>Content to Import</h4>
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-value">{stats?.lists || 0}</span>
            <span className="stat-label">Lists</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats?.cards || 0}</span>
            <span className="stat-label">Cards</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats?.labels || 0}</span>
            <span className="stat-label">Labels</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats?.comments || 0}</span>
            <span className="stat-label">Comments</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats?.checklists || 0}</span>
            <span className="stat-label">Checklists</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats?.attachments || 0}</span>
            <span className="stat-label">Attachments</span>
          </div>
        </div>
      </div>

      {warnings && warnings.length > 0 && (
        <div className="import-preview-warnings">
          <div className="warnings-header">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>Important Notes</span>
          </div>
          <ul className="warnings-list">
            {warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {stats?.uniqueUsers > 0 && (
        <div className="import-preview-info">
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <span>
            This board references {stats.uniqueUsers} user(s). Users not in your workspace will be reassigned to you.
          </span>
        </div>
      )}

      <div className="import-preview-actions">
        <button
          className="btn btn-ghost"
          onClick={onCancel}
          disabled={isImporting}
        >
          Cancel
        </button>
        <button
          className="btn btn-primary"
          onClick={onImport}
          disabled={isImporting}
        >
          {isImporting ? (
            <>
              <span className="btn-spinner" />
              Importing...
            </>
          ) : (
            <>
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              {importMode === 'new' ? 'Import as New Board' : 'Merge into Board'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default BoardImportPreview;
