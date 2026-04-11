import { setClerkAuth, supabase } from '@/lib/supabase';
import { Database } from "@/types/database.types";
import { useSession } from "@clerk/clerk-expo";
import { SupabaseClient } from "@supabase/supabase-js";
import { createContext, PropsWithChildren, useContext, useEffect } from "react";
type SupabaseContextType = {
    supabase: SupabaseClient<Database>;
    isSupabaseReady: boolean;
}

const SupabaseContext = createContext<SupabaseContextType>({ supabase, isSupabaseReady: false })

export default function SupabaseProvider({ children }: PropsWithChildren) {
    const { session, isLoaded } = useSession();

    useEffect(() => {
        if (session) {
            // Inject the Clerk Token into our Singleton Client
            setClerkAuth(async () => {
                return await session.getToken();
            });
        }
    }, [session]);

    return (
        <SupabaseContext.Provider value={{ supabase, isSupabaseReady: isLoaded }}>
            {children}
        </SupabaseContext.Provider>
    )
}

export const useSupabase = () => {
    return useContext(SupabaseContext);
}