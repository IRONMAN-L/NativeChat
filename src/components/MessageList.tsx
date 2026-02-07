import { FlatList, } from 'react-native';
// import messages from '@/data/messages'
import { LocalMessage } from '@/store/chatStore';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import MessageListItem from './MessageListItem';
type Props = {
    inputHeight: number;
    keyboardHeight: { value: number };
    bottomInset: number;
    listRef: any,
    channelId: string,
    messages: LocalMessage[],
}
const MessageList = ({ inputHeight, keyboardHeight, bottomInset, listRef, channelId, messages }: Props) => {

    // message list go up
    const animatedFooterStyle = useAnimatedStyle(() => {
        const effectiveKeyboard = Math.max(keyboardHeight.value - bottomInset, 0);

        return {
            height: inputHeight + effectiveKeyboard + 20,
        }
    })


    return (
        <FlatList
            ref={listRef}
            data={[...messages].reverse()}
            inverted
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <MessageListItem message={item} channelId={channelId} />}
            contentContainerStyle={{ paddingHorizontal: 8 }}
            ListHeaderComponent={<Animated.View style={animatedFooterStyle} />}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps='handled'
        />
    )
}

export default MessageList;
