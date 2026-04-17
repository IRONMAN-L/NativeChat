import { useGradualAnimation } from '@/components/GradualAnimation';
import MessageInput, { PickedFile } from '@/components/MessageInput';
import MessageList from '@/components/MessageList';
import { useChats } from '@/hooks/useChats';
import { signal } from '@/native/signal';
import { useCall } from '@/providers/CallProvider';
import { useSupabase } from '@/providers/SupabaseProvider';
import { channelListStore } from '@/store/channelListStore';
import { chatStore, LocalMessage, MessageType } from '@/store/chatStore';
import { userStore } from '@/store/userStore';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { decode } from 'base64-arraybuffer';
import { Image } from 'expo-image';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
type ChatScreenParams = {
  id: string;
  name?: string;
  message?: string;
  senderId?: string,
  created_at?: string,
  messageId?: string,
}

// ── Helpers ───
function inferMessageType(mimeType?: string): MessageType {
  if (!mimeType) return 'document';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('image/')) return 'image';
  return 'document';
}

function getExtension(name: string): string {
  return name.split('.').pop()?.toLowerCase() || '';
}

export default function ChatScreen() {
  const { id: channelId, name, message: noteMessage, senderId: noteSenderId, created_at: noteCreatedAt, messageId: noteMessageId } = useLocalSearchParams<ChatScreenParams>();
  const { height } = useGradualAnimation();
  const [inputHeight, setInputHeight] = useState(56);
  const router = useRouter();

  const listRef = useRef<FlatList>(null); // for scrolling to bottom
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom;
  const { supabase, isSupabaseReady } = useSupabase();
  const { user: myself } = useUser();
  const { addMessageListener, addStatusListener, loadLocalData: refreshGlobalChats, chats } = useChats();
  const { startCall } = useCall();
  const [messages, setMessages] = useState<LocalMessage[]>();


  // Channels
  const localChannel = chats.find(c => c.id === channelId);
  const { data: channel, error, isPending } = useQuery({
    queryKey: ['channels', channelId],
    queryFn: async () => {
      const { data } = await supabase.from('channels').select('*, users(*)').eq('id', channelId).throwOnError().single();
      if (data?.users) {
        // Cache user details locally when fetched from server
        for (const u of data.users) {
          await userStore.saveUser(u);
        }
      }
      return data;
    },
    enabled: isSupabaseReady,
    initialData: localChannel as any // Fallback to local channel preventing 2s isPending
  });

  const recipientUser = channel?.users?.find((user: any) => user.id !== myself?.id);
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
      let messageType: MessageType = 'text';
      let fileName: string | undefined;

      // check if the text is a secure payload (JSON)
      if (decryptedPayload.startsWith('{')) {
        try {
          const parsed = JSON.parse(decryptedPayload);
          if (parsed.type === 'image') {
            finalText = "📷 Photo";
            securePayload = decryptedPayload;
            messageType = 'image';
          } else if (parsed.type === 'audio') {
            finalText = "🎵 Audio";
            securePayload = decryptedPayload;
            messageType = 'audio';
            fileName = parsed.fileName;
          } else if (parsed.type === 'video') {
            finalText = "🎬 Video";
            securePayload = decryptedPayload;
            messageType = 'video';
            fileName = parsed.fileName;
          } else if (parsed.type === 'document') {
            finalText = `📄 ${parsed.fileName || 'Document'}`;
            securePayload = decryptedPayload;
            messageType = 'document';
            fileName = parsed.fileName;
          }
        } catch {
          // Not JSON, treat as plain text
          console.log("It's a plain text");
        }
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
        securePayload: securePayload,
        messageType: messageType,
        fileName: fileName,
      };

      // Save to disk
      // updated chatstore
      setMessages(await chatStore.addMessage(channelId, newMsg))

      // update channel preview
      await channelListStore.updateChannelPreview(supabase, channelId, { content: newMsg.text, createdAt: newMsg.createdAt, isRead: true, isMe: false })

      // update supabase message status
      await supabase
        .from('message_recipients')
        .update({ status: 'read', channel_id: channelId, sender_id: senderId })
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
    let local = await chatStore.loadMessages(channelId);
    setMessages(local); // Fix white screen by showing available local messages immediately

    // Mark channel preview as read so unread badge clears
    await channelListStore.updateChannelPreview(supabase, channelId, { isRead: true } as any);
    refreshGlobalChats(); // Notify index.tsx of the change

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
          .update({ status: 'read', channel_id: channelId, sender_id: msg.senderId })
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

        await channelListStore.updateChannelPreview(supabase, channelId, { content: noteMessage!, createdAt: noteCreatedAt, isRead: true, isMe: true });
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
          .update({ status: 'read', channel_id: channelId, sender_id: newMessage.senderId })
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

  const handleSendMessage = async (text: string, images: string[], files: PickedFile[]) => {

    // scroll to end
    listRef.current?.scrollToOffset({ offset: 0, animated: true });

    const prom = []

    // Send images
    if (images.length > 0) {
      for (const uri of images) {
        prom.push(sendSingleMessage(uri, 'image'));
      }
    }

    // Send files (audio / documents)
    if (files.length > 0) {
      for (const file of files) {
        const type = inferMessageType(file.mimeType);
        prom.push(sendSingleMessage(file.uri, type, file.name));
      }
    }

    if (text.trim()) {
      prom.push(sendSingleMessage(text, 'text'));
    }
    await Promise.all(prom);

  };

  const sendSingleMessage = async (content: string, type: MessageType, fileName?: string) => {
    if (!recipientUserId) return;

    const isFile = type !== 'text';
    const displayText = type === 'image' ? "📷 Photo"
      : type === 'video' ? "🎬 Video"
        : type === 'audio' ? "🎵 Audio"
          : type === 'document' ? `📄 ${fileName || 'Document'}`
            : content;

    // show it to user first before uploading to server
    const tempId = Date.now().toString() + '_' + Math.random().toString(36).slice(2, 6);
    const optimisticMsg: LocalMessage = {
      id: tempId,
      text: displayText,
      imageUri: type === 'image' ? content : null,
      senderId: myself?.id!,
      senderName: recipientUser?.first_name ?? "",
      createdAt: new Date().toISOString(),
      isMe: true,
      status: 'sending', // Shows clock icon 🕒
      messageType: type,
      fileName: fileName,
      fileUri: isFile ? content : undefined,
    };

    const updated = await chatStore.addMessage(channelId, optimisticMsg);
    setMessages(updated);

    // backend logic
    try {
      let finalCipherText = "";

      if (isFile) {
        // encrypt file first
        const { ciphertext: fileCipher, key, iv } = await signal.encryptAttachment(content);

        // Upload Blob to supabase bucket
        const ext = getExtension(fileName || content);
        const bucketFileName = `${myself?.id}/${Date.now()}.enc`;
        const { data: uploadData, error: bucketError } = await supabase.storage
          .from('chat-media').upload(bucketFileName, decode(fileCipher), { contentType: 'application/octet-stream' });

        if (bucketError) throw bucketError;

        // Create payload with file metadata
        const jsonPayload = JSON.stringify({
          type: type,
          path: uploadData.path,
          key,
          iv,
          fileName: fileName || `file.${ext}`,
          extension: ext,
        });

        // encrypt payload
        finalCipherText = await signal.encrypt(recipientUserId, jsonPayload);
      } else {
        // it is a text
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
      await channelListStore.updateChannelPreview(supabase, channelId, { content: finalMsg.text, createdAt: finalMsg.createdAt, isRead: true, isMe: true })
      refreshGlobalChats();
    } catch (err) {
      console.error("Send failed:", err);
    }
  }
  // Try to use fresher cached user details for the header
  const targetUser = recipientUser ? recipientUser : null;
  const [liveTargetUser, setLiveTargetUser] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      async function syncUser() {
        if (recipientUserId) {
          const u = await userStore.getUser(recipientUserId);
          if (u) setLiveTargetUser(u);
        }
      }
      syncUser();
    }, [recipientUserId])
  );

  const finalTargetUser = liveTargetUser || targetUser;
  const headerTitle = finalTargetUser?.full_name || finalTargetUser?.first_name || name;

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
      <Stack.Screen options={{
        headerTitle: "",
        headerLeft: () => (
          <View className="flex-row items-center gap-2">
            <TouchableOpacity onPress={() => router.back()} className="mr-2">
              <Ionicons name="arrow-back" size={24} color="black" />
            </TouchableOpacity>
            <View className="flex-row items-center gap-3">
              {finalTargetUser?.avatar_url ? (
                <Image source={finalTargetUser.avatar_url} style={{ width: 38, height: 38, borderRadius: 19 }} transition={200} />
              ) : (
                <View className="w-[38px] h-[38px] rounded-full bg-slate-200 items-center justify-center">
                  <MaterialIcons name="person" size={24} color="#94a3b8" />
                </View>
              )}
              <Text className="text-lg font-bold text-slate-800">{headerTitle}</Text>
            </View>
          </View>
        ),
        headerRight: () => (
          <TouchableOpacity
            onPress={() => {
              if (recipientUserId && headerTitle) {
                startCall(
                  channelId,
                  recipientUserId,
                  headerTitle,
                  finalTargetUser?.avatar_url || null
                );
              }
            }}
            style={{
              padding: 8,
              marginRight: 4,
              backgroundColor: 'rgba(14, 152, 100, 0.1)',
              borderRadius: 20,
            }}
            activeOpacity={0.6}
          >
            <Ionicons name="call" size={22} color="#0e9864" />
          </TouchableOpacity>
        ),
      }} />
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


