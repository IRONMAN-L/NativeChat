import { ActivityIndicator, FlatList, Alert, Text } from 'react-native';
import UserListItem from './UserListItem';
import { useSupabase } from '@/providers/SupabaseProvider';
import { useUser } from '@clerk/clerk-expo';
import { User } from '@/types/index';
import { useQuery } from '@tanstack/react-query';

type UserListProps = {
  onPress?: (user: User) => void;
}
export default function UserList({ onPress }: UserListProps) {
  const { supabase, isReady} = useSupabase();
  const { user } = useUser();

  // tanstack cache
  const { data: users, error, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data: users } = await supabase.from('users').select('*').neq('id', user!.id).throwOnError();
      
      return users;
    },
    enabled:isReady,
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