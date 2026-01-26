import { FlatList, } from 'react-native'
import messages from '@/data/messages';
import MessageListItem from './MessageListItem';
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
type Props = {
    inputHeight: number;
    keyboardHeight: { value: number };
    bottomInset: number;
    listRef: any,
}
const MessageList = ({ inputHeight, keyboardHeight, bottomInset, listRef  } : Props) => {

    const myId = 'u-1';
    // list go up
    const animatedContentStyle = useAnimatedStyle(() => {
        const effectiveKeyboard = Math.max(keyboardHeight.value - bottomInset, 0);

        return {
            height: inputHeight  + effectiveKeyboard,
        }
    })

    return (
        <FlatList
            ref={listRef}
            inverted
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <MessageListItem message={item} isOwnMessage={item.user?.id === myId}/>}
            contentContainerStyle={{ paddingHorizontal: 8}}
            ListHeaderComponent={<Animated.View style={animatedContentStyle}/>}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps='handled'
        />
    )
}

export default MessageList;
