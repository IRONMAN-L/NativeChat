import { useGradualAnimation } from '@/components/GradualAnimation';
import MessageInput from '@/components/MessageInput';
import MessageList from '@/components/MessageList';
import { signal } from '@/native/signal';
import { useSupabase } from '@/providers/SupabaseProvider';
import { handleNewMessage } from '@/services/messageHandler';
import { channelListStore } from '@/store/channelListStore';
import { chatStore, LocalMessage } from '@/store/chatStore';
import { useUser } from '@clerk/clerk-expo';
import { useQuery } from '@tanstack/react-query';
import { decode } from 'base64-arraybuffer';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
type ChatScreenParams = {
  id: string;
  name?: string;
}
export default function ChatScreen() {
  const { id: channelId, name } = useLocalSearchParams<ChatScreenParams>();
  const { height } = useGradualAnimation();
  const [inputHeight, setInputHeight] = useState(56);

  const listRef = useRef<FlatList>(null); // for scrolling to bottom
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom;
  const { supabase, isSupabaseReady } = useSupabase();
  const { user: myself } = useUser();
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
      return newMsg;
    } catch (e) {
      console.error("Failed to process message", e);
      return null;
    }
  }, [channelId, myself?.id, recipientUser, supabase]);

  const loadInitialData = useCallback(async () => {
    if (!myself?.id) return;
    // A. Show local data instantly ⚡
    const local = await chatStore.loadMessages(channelId);
    setMessages(local);

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
  }, [loadInitialData]);

  // 2. Realtime Listener ⚡
  useEffect(() => {
    if (!myself?.id || !channelId) return;

    // Setup Subscription
    let subscription: any;
    let retryTimeout: ReturnType<typeof setTimeout>;

    const setupSubscription = () => {
      console.log(`🔌 Subscribing to channel: chat:${channelId}`);

      subscription = supabase
        .channel(`chat:${channelId}`) // Unique name for this connection
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'message_recipients',
            filter: `recipient_user_id=eq.${myself?.id}` // 🔒 ONLY listen for messages sent TO ME
          },
          async (payload) => {
            console.log("⚡ REALTIME EVENT RECEIVED:", payload);

            await handleNewMessage(payload, supabase, name!);

            setMessages(await chatStore.loadMessages(channelId));
            // mark as read in supabase
            await supabase.from('message_recipients')
              .update({ status: 'read' })
              .eq('id', payload.new.id);

          }
        )
        .subscribe((status) => {
          // Debugging: Tells you if the connection is actually working
          if (status === 'SUBSCRIBED') {
            console.log(" Phone is plugged in! Waiting for calls...");
          } else if (status === 'CHANNEL_ERROR') {
            console.warn(" Connection dropped/rejected. Retrying in 3s...");
            // remove the broken channel
            supabase.removeChannel(subscription);
            // retry after 3 seconds
            retryTimeout = setTimeout(() => {
              setupSubscription();
            }, 3000);
          }
        });
    }

    // Start listener
    setupSubscription();

    // Cleanup: Unplug when user leaves the screen
    return () => {
      console.log("🔌 Unsubscribing...");
      if (retryTimeout) clearTimeout(retryTimeout)
      if (subscription) supabase.removeChannel(subscription);
    };

  }, [channelId, myself?.id, name, supabase]);





  const handleSendMessage = async (text: string, images: string[]) => {

    // scroll to end

    listRef.current?.scrollToOffset({ offset: 0, animated: true });


    if (images.length > 0) {
      // Send them sequentially (or Promise.all if you prefer)
      for (const uri of images) {
        await sendSingleMessage(uri, 'image'); // Call the single image sender helper
      }
    }

    if (text.trim()) {
      await sendSingleMessage(text, 'text');
    }

  };

  const sendSingleMessage = async (content: string, type: 'text' | 'image') => {
    if (!recipientUserId) return;

    // show it user first before uploading to server
    const tempId = Date.now().toString();
    const optimisticMsg: LocalMessage = {
      id: tempId,
      text: type === 'image' ? "📷 Photo" : content,
      imageUri: type === 'image' ? content : null, // <--- SHOW THIS INSTANTLY
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
        status: 'sent'
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


