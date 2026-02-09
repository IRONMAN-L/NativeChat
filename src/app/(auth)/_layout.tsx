import { useKeyboardLayoutStore } from '@/store/useKeyboardLayoutStore';
import { Stack } from "expo-router";
import { useEffect } from "react";
import { AppState } from "react-native";
export default function AuthLayout() {
    const bumpLayoutKey = useKeyboardLayoutStore((state) => state.bumpLayoutKey);

    useEffect(() => {
        const subscribe = AppState.addEventListener('change', (state) => {
            if (state === 'active') {
                bumpLayoutKey();
            }
        })
        return () => subscribe.remove();
    }, [bumpLayoutKey]);
    return (
        <Stack>
            <Stack.Screen name="sign-in"
                options={{
                    title: "Sign In",
                }}
            />
            <Stack.Screen name="sign-up"
                options={{
                    title: "Sign Up",
                }}
            />
        </Stack>
    )
}