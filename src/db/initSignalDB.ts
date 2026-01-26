import * as SQLite from 'expo-sqlite';

export const db = SQLite.openDatabaseSync('signal_store.db')

export function initSignalDatabase() {
    db.execAsync(`
        CREATE TABLE IF NOT EXISTS sessions (
            address TEXT PRIMARY KEY,
            session_data BLOB NOT NULL
        );

        CREATE TABLE IF NOT EXISTS prekeys (
            prekey_id INTEGER PRIMARY KEY,
            prekey_data BLOB NOT NULL
        );

        CREATE TABLE IF NOT EXISTS signed_prekeys (
            signed_prekey_id INTEGER PRIMARY KEY,
            signed_prekey_data BLOB NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sender_keys (
            group_id TEXT NOT NULL,
            sender_id TEXT NOT NULL,
            sender_key_data BLOB NOT NULL,
            PRIMARY KEY (group_id, sender_id)
        );

        CREATE TABLE IF NOT EXISTS identity_trust (
            address TEXT PRIMARY KEY,
            identity_key BLOB NOT NULL
        );
    `);
}