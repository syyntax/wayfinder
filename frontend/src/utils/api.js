const API_BASE = '/api';

class ApiError extends Error {
  constructor(message, status, errors = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('wayfinder_token');

  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  };

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(
        data.message || 'Request failed',
        response.status,
        data.errors
      );
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('Network error', 0);
  }
}

// Auth API
export const authApi = {
  register: (data) => request('/auth/register', { method: 'POST', body: data }),
  login: (data) => request('/auth/login', { method: 'POST', body: data }),
  getProfile: () => request('/auth/profile'),
  updateProfile: (data) => request('/auth/profile', { method: 'PATCH', body: data }),
  changePassword: (data) => request('/auth/change-password', { method: 'POST', body: data }),
};

// User API (avatar management)
export const userApi = {
  // Upload avatar image
  uploadAvatar: async (file) => {
    const token = localStorage.getItem('wayfinder_token');
    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const response = await fetch(`${API_BASE}/users/avatar`, {
        method: 'POST',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new ApiError(
          data.message || 'Avatar upload failed',
          response.status,
          data.errors
        );
      }

      return data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Network error during avatar upload', 0);
    }
  },

  // Delete avatar
  deleteAvatar: () => request('/users/avatar', { method: 'DELETE' }),
};

// Workspace API
export const workspaceApi = {
  getAll: () => request('/workspaces'),
  getOne: (id) => request(`/workspaces/${id}`),
  create: (data) => request('/workspaces', { method: 'POST', body: data }),
  update: (id, data) => request(`/workspaces/${id}`, { method: 'PATCH', body: data }),
  invite: (id, data) => request(`/workspaces/${id}/invite`, { method: 'POST', body: data }),
  removeMember: (id, userId) => request(`/workspaces/${id}/members/${userId}`, { method: 'DELETE' }),
  searchUsers: (query) => request(`/workspaces/users/search?q=${encodeURIComponent(query)}`),
};

// Board API
export const boardApi = {
  getAll: (workspaceId) => request(`/boards${workspaceId ? `?workspaceId=${workspaceId}` : ''}`),
  getOne: (id) => request(`/boards/${id}`),
  create: (data) => request('/boards', { method: 'POST', body: data }),
  update: (id, data) => request(`/boards/${id}`, { method: 'PATCH', body: data }),
  delete: (id) => request(`/boards/${id}`, { method: 'DELETE' }),

  // Export board to JSON file
  exportBoard: async (boardId, options = {}) => {
    const token = localStorage.getItem('wayfinder_token');
    const params = new URLSearchParams();

    if (options.includeComments !== undefined) {
      params.append('includeComments', options.includeComments.toString());
    }
    if (options.includeChecklists !== undefined) {
      params.append('includeChecklists', options.includeChecklists.toString());
    }
    if (options.includeAttachments !== undefined) {
      params.append('includeAttachments', options.includeAttachments.toString());
    }

    const queryString = params.toString();
    const url = `${API_BASE}/boards/${boardId}/export${queryString ? `?${queryString}` : ''}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new ApiError(
          errorData.message || 'Export failed',
          response.status,
          errorData.errors
        );
      }

      // Get the filename from Content-Disposition header if available
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'board-export.json';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) {
          filename = match[1];
        }
      }

      // Get JSON data
      const data = await response.json();

      return { data, filename };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Network error during export', 0);
    }
  },

  // Import board from JSON - create new board
  importBoard: async (workspaceId, importData) => {
    return request('/boards/import', {
      method: 'POST',
      body: {
        ...importData,
        workspaceId
      }
    });
  },

  // Import board from JSON - merge into existing board
  mergeBoard: async (boardId, importData) => {
    return request(`/boards/${boardId}/import?mode=merge`, {
      method: 'POST',
      body: importData
    });
  },

  // Preview import without actually importing
  previewImport: (importData) => request('/boards/import/preview', {
    method: 'POST',
    body: importData
  }),
};

// List API
export const listApi = {
  create: (data) => request('/lists', { method: 'POST', body: data }),
  update: (id, data) => request(`/lists/${id}`, { method: 'PATCH', body: data }),
  reorder: (data) => request('/lists/reorder', { method: 'POST', body: data }),
  delete: (id) => request(`/lists/${id}`, { method: 'DELETE' }),
};

// Card API
export const cardApi = {
  getOne: (id) => request(`/cards/${id}`),
  create: (data) => request('/cards', { method: 'POST', body: data }),
  update: (id, data) => request(`/cards/${id}`, { method: 'PATCH', body: data }),
  move: (id, data) => request(`/cards/${id}/move`, { method: 'POST', body: data }),
  updateLabels: (id, data) => request(`/cards/${id}/labels`, { method: 'POST', body: data }),
  updateAssignees: (id, data) => request(`/cards/${id}/assignees`, { method: 'POST', body: data }),
  delete: (id) => request(`/cards/${id}`, { method: 'DELETE' }),
};

// Comment API
export const commentApi = {
  getForCard: (cardId) => request(`/comments/card/${cardId}`),
  create: (data) => request('/comments', { method: 'POST', body: data }),
  update: (id, data) => request(`/comments/${id}`, { method: 'PATCH', body: data }),
  delete: (id) => request(`/comments/${id}`, { method: 'DELETE' }),
};

// Checklist API
export const checklistApi = {
  getForCard: (cardId) => request(`/checklists/card/${cardId}`),
  create: (data) => request('/checklists', { method: 'POST', body: data }),
  update: (id, data) => request(`/checklists/${id}`, { method: 'PATCH', body: data }),
  delete: (id) => request(`/checklists/${id}`, { method: 'DELETE' }),
  addItem: (data) => request('/checklists/items', { method: 'POST', body: data }),
  toggleItem: (id) => request(`/checklists/items/${id}/toggle`, { method: 'POST' }),
  updateItem: (id, data) => request(`/checklists/items/${id}`, { method: 'PATCH', body: data }),
  deleteItem: (id) => request(`/checklists/items/${id}`, { method: 'DELETE' }),
};

// Label API
export const labelApi = {
  getForBoard: (boardId) => request(`/labels/board/${boardId}`),
  create: (data) => request('/labels', { method: 'POST', body: data }),
  update: (id, data) => request(`/labels/${id}`, { method: 'PATCH', body: data }),
  delete: (id) => request(`/labels/${id}`, { method: 'DELETE' }),
};

// Attachment API
export const attachmentApi = {
  // Get all attachments for a card
  getForCard: (cardId) => request(`/cards/${cardId}/attachments`),

  // Upload attachments to a card (uses FormData)
  upload: async (cardId, files) => {
    const token = localStorage.getItem('wayfinder_token');
    const formData = new FormData();

    // Handle both FileList and Array of Files
    const fileArray = Array.from(files);
    fileArray.forEach((file) => {
      formData.append('files', file);
    });

    try {
      const response = await fetch(`${API_BASE}/cards/${cardId}/attachments`, {
        method: 'POST',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new ApiError(
          data.message || 'Upload failed',
          response.status,
          data.errors
        );
      }

      return data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Network error during upload', 0);
    }
  },

  // Delete an attachment
  delete: (attachmentId) => request(`/attachments/${attachmentId}`, { method: 'DELETE' }),
};

// Cover Image Upload API
export const coverApi = {
  // Upload cover image for a card
  uploadCardCover: async (cardId, file) => {
    const token = localStorage.getItem('wayfinder_token');
    const formData = new FormData();
    formData.append('cover', file);

    try {
      const response = await fetch(`${API_BASE}/cards/${cardId}/cover`, {
        method: 'POST',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new ApiError(
          data.message || 'Cover upload failed',
          response.status,
          data.errors
        );
      }

      return data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Network error during cover upload', 0);
    }
  },

  // Upload cover image for a board
  uploadBoardCover: async (boardId, file) => {
    const token = localStorage.getItem('wayfinder_token');
    const formData = new FormData();
    formData.append('cover', file);

    try {
      const response = await fetch(`${API_BASE}/boards/${boardId}/cover`, {
        method: 'POST',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new ApiError(
          data.message || 'Cover upload failed',
          response.status,
          data.errors
        );
      }

      return data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Network error during cover upload', 0);
    }
  },
};

// Mail Settings API (Super Admin only)
export const mailApi = {
  // Get mail settings (password masked)
  getSettings: () => request('/mail/settings'),

  // Update mail settings
  updateSettings: (data) => request('/mail/settings', { method: 'PUT', body: data }),

  // Send test email
  sendTestEmail: (testEmail) => request('/mail/test', { method: 'POST', body: { test_email: testEmail } }),

  // Verify SMTP connection
  verifyConnection: () => request('/mail/verify', { method: 'POST' }),
};

// Password Reset API (Public - no authentication required)
export const passwordResetApi = {
  // Request a password reset email
  requestReset: (email) => request('/auth/forgot-password', {
    method: 'POST',
    body: { email }
  }),

  // Verify a reset token is valid
  verifyToken: (token) => request(`/auth/reset-password/${token}`, {
    method: 'GET'
  }),

  // Reset password using a valid token
  resetPassword: (token, password) => request(`/auth/reset-password/${token}`, {
    method: 'POST',
    body: { password }
  }),
};

// User Management API (Super Admin only)
export const userManagementApi = {
  // Get all users with optional pagination, search, and approval status filtering
  getAllUsers: (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.search) queryParams.append('search', params.search);
    if (params.approval_status) queryParams.append('approval_status', params.approval_status);
    const queryString = queryParams.toString();
    return request(`/admin/users${queryString ? `?${queryString}` : ''}`);
  },

  // Get a single user by ID
  getUserById: (userId) => request(`/admin/users/${userId}`),

  // Create a new user
  createUser: (userData) => request('/admin/users', {
    method: 'POST',
    body: userData
  }),

  // Delete a user
  deleteUser: (userId) => request(`/admin/users/${userId}`, {
    method: 'DELETE'
  }),

  // Get pending users awaiting approval
  getPendingUsers: () => request('/admin/users/pending'),

  // Approve a pending user
  approveUser: (userId) => request(`/admin/users/${userId}/approve`, {
    method: 'POST'
  }),

  // Reject a pending user
  rejectUser: (userId) => request(`/admin/users/${userId}/reject`, {
    method: 'POST'
  }),
};

// App Settings API (Super Admin only for admin routes, public for public settings)
export const appSettingsApi = {
  // Get app settings (Super Admin only)
  getSettings: () => request('/admin/settings'),

  // Update app settings (Super Admin only)
  updateSettings: (data) => request('/admin/settings', {
    method: 'PATCH',
    body: data
  }),

  // Get public settings (no auth required)
  getPublicSettings: () => request('/settings/public'),
};

export { ApiError };
