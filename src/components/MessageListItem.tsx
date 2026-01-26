import { View, Text, Image } from 'react-native'
import { Message } from '@/types'
type MessageListItemProps = {
    message: Message,
    isOwnMessage?:boolean
}   
export default function MessageListItem({ message, isOwnMessage } : MessageListItemProps) {
  return (
    <View className={`flex-row mb-4 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
        <View className={`max-w-[75%] gap-2 ${isOwnMessage ? 'items-end' : 'items-start'}`}>

            {/* Image */}
            {message.image && <Image source={{ uri: message.image }} className={`w-48 h-48 rounded-lg`} /> }
            <View className={`px-4 py-2 rounded-2xl ${isOwnMessage ? 'bg-[#0e9484] rounded-br-md' : 'bg-gray-200 rounded-bl-md'}`} >
                <Text className={`text-[17px] ${isOwnMessage ? 'text-white':'text-neutral-900'}`}>{message.content}</Text>
            </View>
        </View>
    </View>
  )
}