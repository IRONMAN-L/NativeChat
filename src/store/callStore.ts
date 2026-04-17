import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ───────────────────────────────────────────────────────────
export type CallRecord = {
    id: string;              // Unique call ID (also used as ZegoCloud room ID)
    channelId: string;       // The chat channel this call belongs to
    callerId: string;        // Who initiated the call
    callerName: string;
    callerAvatar: string | null;
    receiverId: string;      // Who received the call
    receiverName: string;
    receiverAvatar: string | null;
    startedAt: string;       // ISO timestamp when call was initiated
    endedAt: string | null;  // ISO timestamp when call ended
    duration: number;        // Duration in seconds (0 if missed/rejected)
    status: 'missed' | 'answered' | 'outgoing' | 'rejected';
    isOutgoing: boolean;     // true = I made the call, false = I received it
};

// ─── Storage ─────────────────────────────────────────────────────────
const CALL_HISTORY_KEY = 'call_history';
const MAX_HISTORY = 100; // Only keep last 100 calls

export const callStore = {
    /**
     * Load all call records, sorted by newest first.
     */
    async loadCalls(): Promise<CallRecord[]> {
        const json = await AsyncStorage.getItem(CALL_HISTORY_KEY);
        const records: CallRecord[] = json ? JSON.parse(json) : [];
        return records.sort(
            (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
        );
    },

    /**
     * Add a new call record. Prevents duplicates by ID.
     */
    async addCall(record: CallRecord): Promise<CallRecord[]> {
        const current = await this.loadCalls();

        // Avoid duplicates
        if (current.find(c => c.id === record.id)) return current;

        const updated = [record, ...current].slice(0, MAX_HISTORY);
        await AsyncStorage.setItem(CALL_HISTORY_KEY, JSON.stringify(updated));
        return updated;
    },

    /**
     * Update an existing call record (e.g., when call ends, update duration + status).
     */
    async updateCall(callId: string, updates: Partial<CallRecord>): Promise<CallRecord[]> {
        const current = await this.loadCalls();
        const updated = current.map(c =>
            c.id === callId ? { ...c, ...updates } : c
        );
        await AsyncStorage.setItem(CALL_HISTORY_KEY, JSON.stringify(updated));
        return updated;
    },

    /**
     * Clear all call history.
     */
    async clearHistory(): Promise<void> {
        await AsyncStorage.removeItem(CALL_HISTORY_KEY);
    },
};
