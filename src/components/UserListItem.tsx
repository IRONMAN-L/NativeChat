import { signal } from '@/native/signal';
import { useSupabase } from "@/providers/SupabaseProvider";
import { User } from "@/types";
import { Image, Pressable, Text, View } from 'react-native';
type UserListItemProps = {
    user: User;
    onPress?: (user: User) => void;
}


export default function UserListItem({ user, onPress }: UserListItemProps) {
    const { supabase } = useSupabase();
    const establishHandShake = async (id: string) => {
        if (!id) return;
        await signal.establishSession(id, supabase);
    }
    return (
        <Pressable
            onPress={async () => {
                await establishHandShake(user.id);
                onPress?.(user)
            }}
        >
            <View className="bg-white flex-row items-center gap-4 p-4 border-b border-gray-100">
                {user.avatar_url ? (
                    <Image
                        source={{ uri: user.avatar_url }}
                        className="w-12 h-12 rounded-full"
                    />
                ) : (
                    <View className="bg-gray-200 w-12 h-12 rounded-full items-center justify-center">
                        <Text className="text-white font-semibold text-2xl" >{user.first_name?.charAt(0).toUpperCase()}</Text>
                    </View>
                )}

                <Text className="text-neutral-900 font-medium">
                    {user.first_name} {user.last_name}
                </Text>
            </View>
        </Pressable>
    )

}