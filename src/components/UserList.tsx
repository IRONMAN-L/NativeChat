import { useSupabase } from '@/providers/SupabaseProvider';
import { userStore } from '@/store/userStore';
import { User } from '@/types/index';
import { useUser } from '@clerk/clerk-expo';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, FlatList, Text } from 'react-native';
import UserListItem from './UserListItem';

type UserListProps = {
  onPress?: (user: User) => void;
}
export default function UserList({ onPress }: UserListProps) {
  const { supabase, isSupabaseReady } = useSupabase();
  const { user } = useUser();

  // tanstack cache
  const { data: users, error, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data: users } = await supabase.from('users').select('*').neq('id', user!.id).throwOnError();
      if (users) {
        await userStore.saveUsers(users); // store it locally
      }
      return users;
    },
    enabled: isSupabaseReady,
    initialData: (() => userStore.loadUsers()) as any,
  });

  if (isLoading) {
    return <ActivityIndicator />
  }

  if (error) {
    return <Text>{error.message}</Text>
  }
  return (
    <FlatList
      data={users}
      keyExtractor={({ id }) => id}
      renderItem={({ item }) => {
        return (
          <UserListItem user={item} onPress={onPress} />
        )
      }}
    />
  )
}