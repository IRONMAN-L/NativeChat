import { User } from "@/types";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Storage keys
const USERS_KEY = 'users_cache';
const SYNC_KEY = 'users_last_sync';

export const userStore = {
    async loadUsers(): Promise<User[]> {
        const users = await AsyncStorage.getItem(USERS_KEY);
        return users ? JSON.parse(users) : [];
    },

    async saveUsers(users: User[]) {
        await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
        await AsyncStorage.setItem(SYNC_KEY, new Date().toISOString());
    },

    async getUser(id: string): Promise<User | undefined> {
        const users = await this.loadUsers();
        return users.find(u => u.id === id);
    },

    async saveUser(user: User) {
        const users = await this.loadUsers();
        const existingIndex = users.findIndex(u => u.id === user.id);

        // update or append
        if (existingIndex >= 0) {
            users[existingIndex] = user;
        } else {
            users.push(user);
        }
        await this.saveUsers(users);
    },

    async getLastSync(): Promise<string> {
        const sync = await AsyncStorage.getItem(SYNC_KEY);
        return sync || '1970-01-01T00:00:00.000Z';
    },
    async saveMyDetails(user: User) {
        await AsyncStorage.setItem('my_details', JSON.stringify(user));
    },
    async getMyDetails(): Promise<User | null> {
        const user = await AsyncStorage.getItem('my_details');
        return user ? JSON.parse(user) : null;
    }
}
