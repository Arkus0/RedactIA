import Dexie, { type Table } from 'dexie';
import { HistoryItem } from '../types';

class RedactaDB extends Dexie {
  history!: Table<HistoryItem>;

  constructor() {
    super('RedactaIA_DB');
    (this as any).version(1).stores({
      history: 'id, timestamp' // Primary key and indexed props
    });
  }
}

export const db = new RedactaDB();

export const saveHistory = async (item: HistoryItem) => {
  try {
    await db.history.add(item);
  } catch (error) {
    console.error("Error saving history:", error);
  }
};

export const getHistory = async (): Promise<HistoryItem[]> {
  try {
    return await db.history.orderBy('timestamp').reverse().toArray();
  } catch (error) {
    console.error("Error fetching history:", error);
    return [];
  }
};

export const deleteHistoryItem = async (id: string) => {
  try {
    await db.history.delete(id);
  } catch (error) {
    console.error("Error deleting history item:", error);
  }
};

export const clearHistory = async () => {
  try {
    await db.history.clear();
  } catch (error) {
    console.error("Error clearing history:", error);
  }
};