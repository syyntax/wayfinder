import { create } from 'zustand';
import { boardApi, listApi, cardApi } from '../utils/api';

const useBoardStore = create((set, get) => ({
  boards: [],
  currentBoard: null,
  lists: [],
  labels: [],
  members: [],
  priorities: [],
  isLoading: false,
  error: null,

  // Fetch all boards
  fetchBoards: async (workspaceId = null) => {
    set({ isLoading: true, error: null });
    try {
      const response = await boardApi.getAll(workspaceId);
      set({ boards: response.data.boards, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  // Fetch single board with lists and cards
  fetchBoard: async (boardId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await boardApi.getOne(boardId);
      const { board, lists, labels, members, priorities } = response.data;
      set({
        currentBoard: board,
        lists,
        labels,
        members,
        priorities: priorities || [],
        isLoading: false,
      });
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  // Create board
  createBoard: async (data) => {
    const response = await boardApi.create(data);
    set((state) => ({
      boards: [response.data.board, ...state.boards],
    }));
    return response.data.board;
  },

  // Update board
  updateBoard: async (boardId, data) => {
    const response = await boardApi.update(boardId, data);
    const updatedBoard = response.data.board;

    set((state) => ({
      boards: state.boards.map((b) => (b.id === boardId ? updatedBoard : b)),
      currentBoard: state.currentBoard?.id === boardId ? updatedBoard : state.currentBoard,
    }));

    return updatedBoard;
  },

  // Delete board
  deleteBoard: async (boardId) => {
    await boardApi.delete(boardId);
    set((state) => ({
      boards: state.boards.filter((b) => b.id !== boardId),
      currentBoard: state.currentBoard?.id === boardId ? null : state.currentBoard,
    }));
  },

  // Create list
  createList: async (data) => {
    const response = await listApi.create(data);
    const newList = response.data.list;

    set((state) => ({
      lists: [...state.lists, newList],
    }));

    return newList;
  },

  // Update list
  updateList: async (listId, data) => {
    const response = await listApi.update(listId, data);
    const updatedList = response.data.list;

    set((state) => ({
      lists: state.lists.map((l) => (l.id === listId ? { ...l, ...updatedList } : l)),
    }));

    return updatedList;
  },

  // Reorder lists
  reorderLists: async (boardId, listOrder) => {
    // Optimistic update
    set((state) => ({
      lists: listOrder.map((id, index) => {
        const list = state.lists.find((l) => l.id === id);
        return { ...list, position: index };
      }),
    }));

    try {
      await listApi.reorder({ boardId, listOrder });
    } catch (error) {
      // Revert on error - refetch
      get().fetchBoard(boardId);
      throw error;
    }
  },

  // Delete list
  deleteList: async (listId) => {
    await listApi.delete(listId);
    set((state) => ({
      lists: state.lists.filter((l) => l.id !== listId),
    }));
  },

  // Create card
  createCard: async (data) => {
    const response = await cardApi.create(data);
    const newCard = response.data.card;

    set((state) => ({
      lists: state.lists.map((list) => {
        if (list.id === data.listId) {
          return {
            ...list,
            cards: [...(list.cards || []), newCard],
          };
        }
        return list;
      }),
    }));

    return newCard;
  },

  // Update card
  updateCard: async (cardId, data) => {
    const response = await cardApi.update(cardId, data);
    const updatedCard = response.data.card;

    set((state) => ({
      lists: state.lists.map((list) => ({
        ...list,
        cards: (list.cards || []).map((card) =>
          card.id === cardId ? { ...card, ...updatedCard } : card
        ),
      })),
    }));

    return updatedCard;
  },

  // Move card between lists
  moveCard: async (cardId, targetListId, position) => {
    // Optimistic update
    let sourceListId = null;
    let movedCard = null;

    set((state) => {
      const newLists = state.lists.map((list) => {
        const cardIndex = (list.cards || []).findIndex((c) => c.id === cardId);
        if (cardIndex !== -1) {
          sourceListId = list.id;
          movedCard = list.cards[cardIndex];
          return {
            ...list,
            cards: list.cards.filter((c) => c.id !== cardId),
          };
        }
        return list;
      });

      return {
        lists: newLists.map((list) => {
          if (list.id === targetListId && movedCard) {
            const cards = [...(list.cards || [])];
            cards.splice(position, 0, { ...movedCard, list_id: targetListId });
            return {
              ...list,
              cards: cards.map((c, idx) => ({ ...c, position: idx })),
            };
          }
          return list;
        }),
      };
    });

    try {
      await cardApi.move(cardId, { listId: targetListId, position });
    } catch (error) {
      // Revert on error - refetch
      const currentBoard = get().currentBoard;
      if (currentBoard) {
        get().fetchBoard(currentBoard.id);
      }
      throw error;
    }
  },

  // Update card labels
  updateCardLabels: async (cardId, labelId, action) => {
    const response = await cardApi.updateLabels(cardId, { labelId, action });

    set((state) => ({
      lists: state.lists.map((list) => ({
        ...list,
        cards: (list.cards || []).map((card) =>
          card.id === cardId ? { ...card, labels: response.data.labels } : card
        ),
      })),
    }));
  },

  // Update card assignees
  updateCardAssignees: async (cardId, userId, action) => {
    const response = await cardApi.updateAssignees(cardId, { userId, action });

    set((state) => ({
      lists: state.lists.map((list) => ({
        ...list,
        cards: (list.cards || []).map((card) =>
          card.id === cardId ? { ...card, assignees: response.data.assignees } : card
        ),
      })),
    }));
  },

  // Delete card
  deleteCard: async (cardId) => {
    await cardApi.delete(cardId);

    set((state) => ({
      lists: state.lists.map((list) => ({
        ...list,
        cards: (list.cards || []).filter((card) => card.id !== cardId),
      })),
    }));
  },

  // Clear current board
  clearCurrentBoard: () => {
    set({
      currentBoard: null,
      lists: [],
      labels: [],
      members: [],
      priorities: [],
    });
  },

  // Set current board (for updates without refetching)
  setCurrentBoard: (board) => {
    set({ currentBoard: board });
  },

  // Set labels (for updates without refetching)
  setLabels: (labels) => {
    set({ labels });
  },

  // Set priorities (for updates without refetching)
  setPriorities: (priorities) => {
    set({ priorities });
  },
}));

export default useBoardStore;
