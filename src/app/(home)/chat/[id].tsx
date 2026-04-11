import { useGradualAnimation } from '@/components/GradualAnimation';
import MessageInput from '@/components/MessageInput';
import MessageList from '@/components/MessageList';
import { useChats } from '@/hooks/useChats';
import { signal } from '@/native/signal';
import { useSupabase } from '@/providers/SupabaseProvider';
import { channelListStore } from '@/store/channelListStore';
import { chatStore, LocalMessage } from '@/store/chatStore';
import { useUser } from '@clerk/clerk-expo';
import { useQuery } from '@tanstack/react-query';
import { decode } from 'base64-arraybuffer';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
type ChatScreenParams = {
  id: string;
  name?: string;
  message?: string;
  senderId?: string,
  created_at?: string,
  messageId?: string,
}
export default function ChatScreen() {
  const { id: channelId, name, message: noteMessage, senderId: noteSenderId, created_at: noteCreatedAt, messageId: noteMessageId } = useLocalSearchParams<ChatScreenParams>();
  const { height } = useGradualAnimation();
  const [inputHeight, setInputHeight] = useState(56);

  const listRef = useRef<FlatList>(null); // for scrolling to bottom
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom;
  const { supabase, isSupabaseReady } = useSupabase();
  const { user: myself } = useUser();
  const { addMessageListener, addStatusListener, loadLocalData: refreshGlobalChats } = useChats();
  const [messages, setMessages] = useState<LocalMessage[]>();


  // Channels
  const { data: channel, error, isPending } = useQuery({
    queryKey: ['channels', channelId],
    queryFn: async () => {
      const { data } = await supabase.from('channels').select('*, users(*)').eq('id', channelId).throwOnError().single();
      return data;
    },
    enabled: isSupabaseReady,
  });

  const recipientUser = channel?.users?.find(user => user.id !== myself?.id);
  const recipientUserId = recipientUser?.id;

  const processIncomingMessage = useCallback(async (msg: any) => {
    try {
      const senderId = msg.user_id;
      const ciphertext = msg.message_recipients[0].ciphertext;

      // 🔐 DECRYPT
      const decryptedPayload = await signal.decrypt(senderId, ciphertext);

      if (!decryptedPayload) return null;

      let finalText = decryptedPayload;
      let securePayload = undefined;

      // check if the text is secret payload (JSON)
      if (decryptedPayload.startsWith('{') && decryptedPayload.includes('"type":"image"')) {
        finalText = "📷 Photo";
        securePayload = decryptedPayload;
      }

      // local logic
      const newMsg: LocalMessage = {
        id: msg.id,
        text: finalText,
        senderId: senderId,
        senderName: recipientUser?.first_name ?? "",
        imageUri: null,
        createdAt: msg.created_at,
        isMe: false, // It's incoming
        status: 'read',
        securePayload: securePayload
      };

      // Save to disk
      // updated chatstore
      setMessages(await chatStore.addMessage(channelId, newMsg))

      // update channel preview
      await channelListStore.updateChannelPreview(supabase, channelId, { content: newMsg.text, createdAt: newMsg.createdAt, isRead: true })

      // update supabase message status
      await supabase
        .from('message_recipients')
        .update({ status: 'read' })
        .eq('recipient_user_id', myself?.id!)
        .eq('message_id', msg.id)
        .throwOnError();

      // tell the sender immediately that we read it
      const channel = supabase.channel(`user_updates:${senderId}`);
      await channel.httpSend('status_update', { message_id: msg.id, status: 'read', channel_id: channelId });
      supabase.removeChannel(channel);

      return newMsg;
    } catch (e) {
      console.error("Failed to process message", e);
      return null;
    }
  }, [channelId, myself?.id, recipientUser, supabase]);

  const loadInitialData = useCallback(async () => {
    if (!myself?.id) return;
    // A. Show local data instantly ⚡
    let local = await chatStore.loadMessages(channelId);

    // Any incoming messages currently in local store still marked as delivered need to be read
    const unreadLocal = local.filter(m => !m.isMe && m.status !== 'read');
    if (unreadLocal.length > 0) {
      let prom = [];
      for (const m of unreadLocal) {
        prom.push(chatStore.updateMessageStatus(channelId, m.id, 'read'));
      }
      await Promise.all(prom);
      setMessages(await chatStore.loadMessages(channelId));

      for (const msg of unreadLocal) {
        await supabase.from('message_recipients')
          .update({ status: 'read' })
          .eq('message_id', msg.id)
          .eq('recipient_user_id', myself.id);
      }
    }


    // B. Fetch Missed Messages from Cloud ☁️
    const lastTimeStamp = local.length > 0 ? local[local.length - 1].createdAt : '1970-01-01';
    const { data } = await supabase
      .from('messages')
      .select(`
        id, created_at, user_id,
        message_recipients!inner(ciphertext)
        `)
      .eq('channel_id', channelId)
      .eq('message_recipients.recipient_user_id', myself?.id!) // Only my copies
      .gt('created_at', lastTimeStamp); // Only new ones

    if (data && data.length > 0) {
      // Decrypt and Save
      for (const msg of data) {
        await processIncomingMessage(msg);
      }
      // Reload from store to update UI
      setMessages(await chatStore.loadMessages(channelId));
    }
  }, [channelId, myself?.id, supabase, processIncomingMessage]);

  useEffect(() => {
    loadInitialData();
    async function backgroundUpdation() {
      if (noteMessage && noteMessageId && noteCreatedAt && noteSenderId && name) {
        const msg: LocalMessage = {
          id: noteMessageId,
          text: noteMessage,
          imageUri: null,
          createdAt: noteCreatedAt,
          senderName: name,
          senderId: noteSenderId,
          isMe: true,
          status: 'sent' as const
        }
        setMessages(await chatStore.addMessage(channelId, msg));

        await channelListStore.updateChannelPreview(supabase, channelId, { content: noteMessage!, createdAt: noteCreatedAt, isRead: true });
        refreshGlobalChats(); // Update Index page
      }
    }

    backgroundUpdation();


  }, [loadInitialData]);

  // 2. Listen for new messages via the global listener in useChats
  useFocusEffect(
    useCallback(() => {
      if (!myself?.id || !channelId) return;

      const removeListener = addMessageListener(`chat:${channelId}`, async (_senderId, newMessage) => {
        // The message was already saved to chatStore by handleNewMessage, now update locally to read
        const updatedMessages = await chatStore.updateMessageStatus(channelId, newMessage.id, 'read');
        setMessages(updatedMessages);

        // Mark as read since user is viewing this chat
        await supabase.from('message_recipients')
          .update({ status: 'read' })
          .eq('message_id', newMessage.id)
          .eq('recipient_user_id', myself.id);
      });

      return () => {
        removeListener();
      };
    }, [channelId, myself?.id, supabase, addMessageListener])
  );

  // 3. Listen for status updates (delivered/read) on messages I SENT → update ticks
  useFocusEffect(
    useCallback(() => {
      if (!channelId) return;

      const removeListener = addStatusListener(`status:${channelId}`, async (messageId, status) => {
        // Update the message status locally (e.g. sent→delivered→read)
        const updated = await chatStore.updateMessageStatus(channelId, messageId, status as LocalMessage['status']);
        setMessages(updated);
        console.log(`Tick updated: ${messageId} → ${status}`);
      });

      return () => {
        removeListener();
      };
    }, [channelId, addStatusListener])
  );

  // 4. Reload messages from local store when app returns to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'active') {
        const local = await chatStore.loadMessages(channelId);
        setMessages(local);
      }
    });
    return () => subscription.remove();
  }, [channelId]);
  const handleSendMessage = async (text: string, images: string[]) => {

    // scroll to end

    listRef.current?.scrollToOffset({ offset: 0, animated: true });

    const prom = []
    if (images.length > 0) {
      // Send them sequentially (or Promise.all if you prefer)

      for (const uri of images) {
        prom.push(sendSingleMessage(uri, 'image')); // Call the single image sender helper
      }

    }

    if (text.trim()) {
      prom.push(sendSingleMessage(text, 'text'));
    }
    await Promise.all(prom);

  };

  const sendSingleMessage = async (content: string, type: 'text' | 'image') => {
    if (!recipientUserId) return;

    // show it user first before uploading to server
    const tempId = Date.now().toString();
    const optimisticMsg: LocalMessage = {
      id: tempId,
      text: type === 'image' ? "📷 Photo" : content,
      imageUri: type === 'image' ? content : null, // SHOW THIS INSTANTLY
      senderId: myself?.id!,
      senderName: recipientUser?.first_name ?? "",
      createdAt: new Date().toISOString(),
      isMe: true,
      status: 'sending' // Shows clock icon 🕒
    };

    const updated = await chatStore.addMessage(channelId, optimisticMsg);
    setMessages(updated);

    // backend logic
    try {
      let finalCipherText = "";
      // Text vs image
      if (type === 'image') {
        // encrypt file first
        const { ciphertext: imgCipher, key, iv } = await signal.encryptImage(content);

        // Upload Blob to supabase bucket
        const fileName = `${myself?.id}/${Date.now()}.enc`; // filename of the image
        const { data: uploadData, error: bucketError } = await supabase.storage
          .from('chat-media').upload(fileName, decode(imgCipher), { contentType: 'application/octet-stream' });

        if (bucketError) throw bucketError;

        // Create payload
        const jsonPayload = JSON.stringify({
          type: 'image',
          path: uploadData.path,
          key,
          iv
        })

        // encrypt payload
        finalCipherText = await signal.encrypt(recipientUserId, jsonPayload);
      } else { // it is a text
        finalCipherText = await signal.encrypt(recipientUserId, content);
      }

      // send encrypted blob to supabase
      const { data: msgData, error: msgError } = await supabase.from('messages')
        .insert({ channel_id: channelId, user_id: myself?.id })
        .select().single()

      if (msgError) throw msgError;

      const { error: msgRecipientError } = await supabase.from('message_recipients').insert({
        message_id: msgData.id,
        recipient_user_id: recipientUserId,
        recipient_device_id: 1,
        ciphertext: finalCipherText,
        status: 'sent',
        sender_id: myself?.id,
        channel_id: channelId
      })

      if (msgRecipientError) throw msgRecipientError;

      const finalMsg: LocalMessage = {
        ...optimisticMsg,
        id: msgData.id,
        createdAt: msgData.created_at,
        status: 'sent'
      }

      // update chat item 
      setMessages(await chatStore.updateMessage(channelId, tempId, finalMsg));

      // update channel preview
      await channelListStore.updateChannelPreview(supabase, channelId, { content: finalMsg.text, createdAt: finalMsg.createdAt, isRead: true })
      refreshGlobalChats();
    } catch (err) {
      console.error("Send failed:", err);
    }
  }
  if (isPending) {
    return <ActivityIndicator />;
  }
  // console.log(JSON.stringify(channel, null, 2));
  if (error || !channel) {
    return (
      <View className='flex-1 justify-center'>
        <Text className='text-red-600 text-xl'>Channel not found</Text>
      </View>
    )
  }
  return (
    <>
      <Stack.Screen options={{ title: name }} />
      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
        <MessageList inputHeight={inputHeight}
          listRef={listRef}
          keyboardHeight={height}
          bottomInset={bottomInset}
          channelId={channelId}
          messages={messages || []} // for no messages yet array is empty
        />
        <MessageInput
          setInputHeight={setInputHeight}
          keyboardHeight={height}
          bottomInset={bottomInset}
          onSend={handleSendMessage}
        />
      </SafeAreaView>
    </>
  )
}


