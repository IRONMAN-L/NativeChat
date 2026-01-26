import { Database } from "@/types/database.types";
import { useSession } from "@clerk/clerk-expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createContext, PropsWithChildren, useContext, useEffect, useState } from "react";
type SupabaseContextType = {
    supabase: SupabaseClient<Database>;
    isSupabaseReady: boolean;
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY


const SupabaseContext = createContext<SupabaseContextType>({ supabase: createClient(supabaseUrl!, supabaseAnonKey!), isSupabaseReady: false })

export default function SupabaseProvider({ children }: PropsWithChildren) {
    const { session } = useSession();
    const [supabase, setSupabase] = useState<SupabaseClient<Database>>(createClient(supabaseUrl!, supabaseAnonKey!));
    const [isSupabaseReady, setIsSupabaseReady] = useState(false);
    useEffect(() => {
        if (!session) return;
        const newClient = createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
            auth: {
                storage: AsyncStorage,
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: false,
            },
            async accessToken() {
                return session?.getToken() ?? null;
            }
        });
        setSupabase(newClient);
        setIsSupabaseReady(true);
    }, [session]);


    return (
        <SupabaseContext.Provider value={{ supabase, isSupabaseReady }}>
            {children}
        </SupabaseContext.Provider>
    )
}

export const useSupabase = () => {
    return useContext(SupabaseContext);
}