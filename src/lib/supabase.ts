import { Database } from "@/types/database.types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import 'react-native-url-polyfill/auto'; // Required for Supabase (since supabase relies on url parse)

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// A variable to hold the current token fetching logic
let getToken: (() => Promise<string | null>) | null = null;

// Allow other files (like the Provider or Background Task) to set the logic
export const setClerkAuth = (tokenFetcher: () => Promise<string | null>) => {
    getToken = tokenFetcher;
};

// 1. Create a "Singleton" client
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
    global: {
        // This allows us to inject the Clerk token into every request
        fetch: async (url, options = {}) => {
            const clerkToken = getToken ? await getToken() : null;

            const headers = new Headers(options?.headers);
            if (clerkToken) {
                headers.set("Authorization", `Bearer ${clerkToken}`);
            }

            return fetch(url, {
                ...options,
                headers,
            });
        },
    }
});