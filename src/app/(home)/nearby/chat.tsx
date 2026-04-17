import { useGradualAnimation } from '@/components/GradualAnimation';
import { signal } from '@/native/signal';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import NativeTaskModule from '../../../../modules/native-task/src/NativeTaskModule';
// Types
type MessageType = 'text' | 'image' | 'video' | 'audio' | 'document';

type NearbyMessage = {
  id: string;
  text: string;
  isMe: boolean;
  createdAt: string;
  type: MessageType;
  fileUri?: string;
  fileName?: string;
  payloadId?: string;
  progress?: number;      // 0-100
  transferDone?: boolean;
};

type NearbyParams = {
  endpointId: string;
  userName: string;
};

// ── Helpers ───────
function getFileExtension(name: string): string {
  return name.split('.').pop()?.toLowerCase() || '';
}

function getDocIcon(ext: string): keyof typeof MaterialCommunityIcons.glyphMap {
  switch (ext) {
    case 'pdf': return 'file-pdf-box';
    case 'xls': case 'xlsx': return 'file-excel-box';
    case 'doc': case 'docx': return 'file-word-box';
    case 'ppt': case 'pptx': return 'file-powerpoint-box';
    case 'txt': return 'file-document-outline';
    case 'zip': case 'rar': case '7z': return 'folder-zip-outline';
    default: return 'file-outline';
  }
}

function getDocColor(ext: string): string {
  switch (ext) {
    case 'pdf': return '#ef4444';
    case 'xls': case 'xlsx': return '#22c55e';
    case 'doc': case 'docx': return '#3b82f6';
    case 'ppt': case 'pptx': return '#f97316';
    default: return '#94a3b8';
  }
}

function formatFileName(name: string, maxLen = 24): string {
  if (name.length <= maxLen) return name;
  const ext = name.split('.').pop() || '';
  const base = name.slice(0, maxLen - ext.length - 4);
  return `${base}...${ext}`;
}


export default function NearbyChatScreen() {
  const { endpointId, userName } = useLocalSearchParams<NearbyParams>();
  const [myId, setMyId] = useState<string>("");
  const { height: keyboardHeight } = useGradualAnimation();
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom;
  const listRef = useRef<FlatList>(null);
  const [connectedUser, setConnectedUser] = useState<{ userName: string; userId: (string | null) }>({ userName, userId: null });
  const [messages, setMessages] = useState<NearbyMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isDisconnected, setIsDisconnected] = useState(false);
  const [inputHeight, setInputHeight] = useState(56);
  const [isSessionEstablish, setIsSessionEstablish] = useState<boolean>(false);
  // Tracks payloadIds we've already assigned to a message
  const knownPayloadIds = useRef<Set<string>>(new Set());

  // Listeners 
  useEffect(() => {
    const msgSub = NativeTaskModule.addListener('onMessageReceived', async (event) => {
      if (event.endpointId !== endpointId) return;

      try {
        const data = JSON.parse(event.message);
        if (data.type === 'KEY_REQUEST') {
          console.log(`${data.userName} requested keys.`);
          setConnectedUser({ userName: data.userName, userId: data.userId });
          // 1. Get our offline keys using the new function we just wrote
          const myBundle = await signal.getOfflineBundle();
          // 2. Package it into a JSON string
          const currentUserId = (await AsyncStorage.getItem("current_user_id")) ?? "";
          setMyId(currentUserId);
          const responsePayload = JSON.stringify({
            type: 'KEY_RESPONSE',
            userId: currentUserId,
            bundle: myBundle
          });
          // 3. Send it back across the Wi-Fi pipe
          NativeTaskModule.sendMessage(event.endpointId, responsePayload);
        }
        else if (data.type === 'KEY_RESPONSE') {
          console.log(`Received keys from ${data.userId}. Securing pipe...`);
          setConnectedUser(prev => { return { ...prev, userId: data.userId } });
          // 1. Feed the keys into our C++ engine to build the lock
          const success = await signal.establishOfflineSession(data.userId, data.bundle);

          if (success) {
            // IMPORTANT: Save their actual userId to state so we know who we are talking to
            setIsSessionEstablish(true);
          }
        } else if (data.type === 'ENCRYPTED_MESSAGE') {
          // 1. Send the ciphertext to the C++ engine to unlock it
          const plaintext = await signal.decrypt(data.senderId, data.ciphertext);

          if (plaintext) {
            const newMsg: NearbyMessage = {
              id: Date.now().toString() + '_recv',
              text: plaintext,
              isMe: false,
              createdAt: new Date().toISOString(),
              type: 'text',
              payloadId: data.payloadId,
            };
            setMessages(prev => [...prev, newMsg]);
          } else {
            console.log("Failed to decrypt offline message");
          }
        }
      } catch (e) {
        console.error("Error:", e);
      }
    });

    const fileSub = NativeTaskModule.addListener('onFileReceived', async (event) => {
      if (event.endpointId !== endpointId) return;
      try {
        const jsonString = await FileSystem.readAsStringAsync(event.fileUri);

        // Clean up the cache payload safely in the background
        FileSystem.deleteAsync(event.fileUri, { idempotent: true }).catch(() => { });

        const data = JSON.parse(jsonString);

        if (data.type === 'ENCRYPTED_FILE') {
          const path = await signal.decryptAttachment(data.ciphertext, data.key, data.iv, data.metadata.extension);
          if (path) {
            setMessages((prev) => {
              const existingIdx = prev.findIndex(m => m.payloadId === event.payloadId);

              if (existingIdx !== -1) {
                const updated = [...prev];
                updated[existingIdx] = {
                  ...updated[existingIdx],
                  text: data.metadata.fileType === 'image' ? '📷 Photo' : data.metadata.fileType === 'video' ? '🎬 Video' : data.metadata.fileType === 'audio' ? '🎵 Audio' : `📄 ${data.metadata.fileName}`,
                  type: data.metadata.fileType,
                  fileUri: path,
                  fileName: data.metadata.fileName,
                  transferDone: true,
                  progress: 100
                };
                return updated;
              } else {
                const newMsg: NearbyMessage = {
                  id: Date.now().toString() + '_recv',
                  text: data.metadata.fileType === 'image' ? '📷 Photo' : data.metadata.fileType === 'video' ? '🎬 Video' : data.metadata.fileType === 'audio' ? '🎵 Audio' : `📄 ${data.metadata.fileName}`,
                  isMe: false,
                  createdAt: new Date().toISOString(),
                  type: data.metadata.fileType,
                  fileUri: path,
                  fileName: data.metadata.fileName,
                  payloadId: event.payloadId,
                  transferDone: true,
                  progress: 100
                };
                return [...prev, newMsg];
              }
            });
          } else {
            console.log("Failed to decrypt offline file");
          }
        }
      } catch (e) {
        console.error("Failed to parse incoming file payload", e);
      }
    });

    const disconnectSub = NativeTaskModule.addListener('onDisconnected', (event) => {
      if (event.endpointId === endpointId) {
        setIsDisconnected(true);
      }
    });

    // Transfer progress
    const transferSub = NativeTaskModule.addListener('onTransferUpdate', (event) => {
      if (event.endpointId !== endpointId) return;

      // ← CRITICAL: ignore updates for BYTES payloads (text/key-exchange messages).
      // Without this guard, every text message creates a phantom "Receiving file..." bubble.
      if (!event.isFile) return;

      const pid = String(event.payloadId);
      const prog = Number(event.progress);
      const statusCode = Number(event.status);

      // If this payloadId isn't assigned yet...
      if (!knownPayloadIds.current.has(pid)) {
        knownPayloadIds.current.add(pid);
        setMessages((prev) => {
          const idx = prev.findIndex(
            (m) => m.isMe && m.type !== 'text' && !m.payloadId
          );
          if (idx !== -1) {
            // Assign to pending upload
            const updated = [...prev];
            updated[idx] = { ...updated[idx], payloadId: pid, progress: prog };
            return updated;
          } else {
            // It's an anonymous INCOMING payload! Create a downloading placeholder.
            const newIncoming: NearbyMessage = {
              id: 'incoming_' + pid,
              text: 'Receiving incoming file...',
              isMe: false,
              createdAt: new Date().toISOString(),
              type: 'document', // Generic until decrypted
              payloadId: pid,
              progress: prog,
              transferDone: false,
            };
            return [...prev, newIncoming];
          }
        });
      }

      // Update progress on the message with this payloadId
      setMessages((prev) =>
        prev.map((m) => {
          if (m.payloadId !== pid) return m;
          return {
            ...m,
            progress: prog,
            transferDone: statusCode === 1, // 1 = SUCCESS
          };
        })
      );
    });

    return () => {
      msgSub.remove();
      fileSub.remove();
      disconnectSub.remove();
      transferSub.remove();
      NativeTaskModule.stopAll();
    };
  }, [endpointId]);

  // ── Send Text ───
  const handleSendText = useCallback(async () => {
    const trimmed = inputText.trim();
    if (!trimmed || !endpointId) return;


    let ciphertext = trimmed;
    if (connectedUser.userId) ciphertext = await signal.encrypt(connectedUser.userId, trimmed);

    // package
    const payload = JSON.stringify({
      type: 'ENCRYPTED_MESSAGE',
      senderId: myId,
      ciphertext: ciphertext
    });
    NativeTaskModule.sendMessage(endpointId, payload);

    const newMsg: NearbyMessage = {
      id: Date.now().toString() + '_sent',
      text: trimmed,
      isMe: true,
      createdAt: new Date().toISOString(),
      type: 'text',
    };
    setMessages((prev) => [...prev, newMsg]);
    setInputText('');
    scrollToBottom();
  }, [inputText, endpointId]);

  // ── Send File (generic) ───────────────────────────────
  const sendFileMessage = useCallback(
    async (uri: string, name: string, type: MessageType) => {
      if (!endpointId) return;

      const { ciphertext: fileCipher, key, iv } = await signal.encryptAttachment(uri);
      const payload = JSON.stringify({
        type: 'ENCRYPTED_FILE',
        senderId: myId,
        ciphertext: fileCipher,
        key: key,
        iv: iv,
        metadata: {
          fileName: name,
          extension: uri.split('.').pop()?.toLowerCase(),
          fileType: type,
        }
      });
      // Save it to a temporary file because sendFile expects a URI to stream
      const tempPath = FileSystem.cacheDirectory + `payload_${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(tempPath, payload);
      NativeTaskModule.sendFile(endpointId, tempPath);

      const newMsg: NearbyMessage = {
        id: Date.now().toString() + '_file',
        text: type === 'image' ? '📷 Photo' : type === 'video' ? '🎬 Video' : type === 'audio' ? '🎵 Audio' : `📄 ${name}`,
        isMe: true,
        createdAt: new Date().toISOString(),
        type,
        fileUri: uri,
        fileName: name,
        progress: 0,
        transferDone: false,
      };
      setMessages((prev) => [...prev, newMsg]);
      scrollToBottom();
    },
    [endpointId]
  );

  // ── Pickers ─────
  const pickMedia = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission required', 'Media library access is needed.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.8,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      const isVideo = asset.type === 'video';
      sendFileMessage(asset.uri, asset.fileName || (isVideo ? 'video.mp4' : 'photo.jpg'), isVideo ? 'video' : 'image');
    }
  };

  const pickAudio = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const file = result.assets[0];
        sendFileMessage(file.uri, file.name, 'audio');
      }
    } catch {
      Alert.alert('Error', 'Failed to pick audio file.');
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/*', 'text/*'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const file = result.assets[0];
        sendFileMessage(file.uri, file.name, 'document');
      }
    } catch {
      Alert.alert('Error', 'Failed to pick document.');
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    }, 150);
  };

  // ── Animated styles ───────────────────────────────────
  const animatedFooterStyle = useAnimatedStyle(() => {
    const ek = Math.max(keyboardHeight.value - bottomInset, 0);
    return { height: inputHeight + ek + 20 };
  });

  const animatedInputStyle = useAnimatedStyle(() => {
    const ek = Math.max(keyboardHeight.value - bottomInset, 0);
    return { transform: [{ translateY: -ek }], bottom: bottomInset };
  });

  if (!isSessionEstablish) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#020617' }}>
        <View className="flex-1 items-center justify-center px-6">
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text className="text-slate-100 font-bold text-xl mt-6 mb-2 text-center">Securing Connection...</Text>
          <Text className="text-slate-500 text-center mb-8">Establishing an end-to-end encrypted session with {userName || "the remote device"}.</Text>

          <View className="space-y-4 w-full">
            {["Exchanging identity keys", "Validating PreKeys", "Securing offline pipeline"].map((text, idx) => (
              <View key={idx} className="flex-row items-center bg-slate-900 p-4 rounded-2xl border border-slate-800">
                <MaterialCommunityIcons name="shield-check" size={24} color="#0ea5e9" className="mr-3" />
                <Text className="text-slate-300 font-medium ml-3">{text}</Text>
              </View>
            ))}
          </View>
        </View>
      </SafeAreaView>
    )
  }
  const renderMessage = ({ item }: { item: NearbyMessage }) => {
    const isMe = item.isMe;

    return (
      <View className={`flex-row mb-1.5 px-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
        <View className={`max-w-[82%] min-w-[80px] rounded-[20px] overflow-hidden elevation-sm ${isMe ? 'bg-sky-500 rounded-br-[4px]' : 'bg-slate-800 rounded-bl-[4px] border border-slate-700'}`}>
          {/* ── Content by type ── */}
          {item.type === 'text' && (
            <Text className={`text-[15px] leading-[22px] px-3.5 py-2.5 ${isMe ? 'text-white' : 'text-slate-200'}`}>
              {item.text}
            </Text>
          )}

          {(item.type === 'image' || item.type === 'video') && (
            <View className="relative">
              {item.fileUri ? (
                <Image source={{ uri: item.fileUri }} className="w-[240px] h-[240px] rounded-2xl m-1" resizeMode="cover" />
              ) : (
                <View className="w-[240px] h-[240px] rounded-2xl m-1 bg-slate-800 items-center justify-center">
                  <MaterialCommunityIcons
                    name={item.type === 'video' ? 'video-outline' : 'image-outline'}
                    size={48} color="#475569"
                  />
                </View>
              )}
              {/* Video play icon */}
              {item.type === 'video' && item.transferDone !== false && (
                <View className="absolute inset-0 items-center justify-center">
                  <MaterialCommunityIcons name="play-circle" size={48} color="rgba(255,255,255,0.9)" />
                </View>
              )}
              {/* Circular progress overlay */}
              {!item.transferDone && item.progress !== undefined && (
                <View className="absolute inset-0 items-center justify-center bg-black/45">
                  <View className="w-16 h-16 rounded-full bg-black/60 border-[3px] border-sky-500 items-center justify-center">
                    <Text className="text-white font-bold text-[15px]">{item.progress}%</Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {item.type === 'audio' && (
            <View className="flex-row items-center gap-2.5 px-3 py-2.5 min-w-[220px]">
              <View className="w-10 h-10 rounded-full bg-white/15 items-center justify-center">
                <MaterialCommunityIcons name="music-note" size={24} color="#fff" />
              </View>
              <View className="flex-1">
                <Text
                  className={`text-[13px] font-semibold mb-1 ${isMe ? 'text-white' : 'text-slate-200'}`}
                  numberOfLines={1}
                >
                  {formatFileName(item.fileName || 'Audio', 28)}
                </Text>
                {/* Linear progress bar */}
                {!item.transferDone && item.progress !== undefined ? (
                  <View className="h-1 rounded-sm bg-white/10 w-full mt-1 overflow-hidden">
                    <View
                      className="h-full rounded-sm bg-sky-400"
                      style={{ width: `${item.progress}%` }}
                    />
                  </View>
                ) : (
                  <View className="flex-row items-end gap-[1.5px] h-[18px]">
                    {Array.from({ length: 20 }).map((_, i) => (
                      <View
                        key={i}
                        className="w-[3px] rounded-sm"
                        style={{
                          height: 4 + Math.random() * 14,
                          backgroundColor: isMe ? 'rgba(255,255,255,0.4)' : '#475569'
                        }}
                      />
                    ))}
                  </View>
                )}
              </View>
              {item.isMe && !item.transferDone && item.progress !== undefined && (
                <Text className="text-white/60 text-[11px] font-bold">{item.progress}%</Text>
              )}
            </View>
          )}

          {item.type === 'document' && (
            <View className="flex-row items-center gap-2.5 px-3 py-2.5 min-w-[200px]">
              <View
                className="w-11 h-11 rounded-xl items-center justify-center"
                style={{ backgroundColor: getDocColor(getFileExtension(item.fileName || '')) + '22' }}
              >
                <MaterialCommunityIcons
                  name={getDocIcon(getFileExtension(item.fileName || ''))}
                  size={28}
                  color={getDocColor(getFileExtension(item.fileName || ''))}
                />
              </View>
              <View className="flex-1">
                <Text
                  className={`text-[13px] font-semibold ${isMe ? 'text-white' : 'text-slate-200'}`}
                  numberOfLines={1}
                >
                  {formatFileName(item.fileName || 'Document', 26)}
                </Text>
                <Text className="text-[10px] text-slate-500 font-bold mt-0.5 uppercase">
                  {getFileExtension(item.fileName || '').toUpperCase() || 'FILE'}
                </Text>
                {/* Linear progress bar */}
                {!item.transferDone && item.progress !== undefined && (
                  <View className="h-1 rounded-sm bg-white/10 w-full mt-1.5 overflow-hidden">
                    <View
                      className="h-full rounded-sm bg-sky-400"
                      style={{ width: `${item.progress}%` }}
                    />
                  </View>
                )}
              </View>
              {!item.transferDone && item.progress !== undefined && (
                <Text className="text-white/60 text-[11px] font-bold">{item.progress}%</Text>
              )}
            </View>
          )}

          {/* ── Timestamp ── */}
          <View className="flex-row items-center justify-end pr-3 pb-1.5">
            <Text className={`text-[9px] font-bold ${isMe ? 'text-white/60' : 'text-slate-500'}`}>
              {new Date(item.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
            {item.isMe && item.type !== 'text' && item.transferDone && (
              <MaterialIcons name="check" size={12} color="rgba(255,255,255,0.6)" style={{ marginLeft: 4 }} />
            )}
          </View>
        </View>
      </View>
    );
  };


  return (
    <>
      <Stack.Screen
        options={{
          title: connectedUser.userName || 'Nearby Chat',
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#f8fafc',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />
      <SafeAreaView style={{ flex: 1, backgroundColor: '#020617' }} edges={['bottom']}>
        {/* Temporary Chat Banner */}
        <View className="flex-row items-center gap-2 bg-slate-800 px-4 py-2.5 border-b border-slate-700/50">
          <MaterialCommunityIcons name="information-outline" size={16} color="#38bdf8" />
          <Text className="text-slate-400 text-[12px] flex-1 leading-4">
            This is a temporary chat. Messages {"won't"} be saved after you leave.
          </Text>
        </View>

        {/* Disconnected Banner */}
        {isDisconnected && (
          <View className="flex-row items-center gap-2 bg-amber-950 px-4 py-2.5 border-b border-amber-900">
            <MaterialCommunityIcons name="lan-disconnect" size={16} color="#fbbf24" />
            <Text className="text-amber-400 text-[12px] font-semibold flex-1">
              {userName || 'The other person'} has disconnected.
            </Text>
          </View>
        )}

        {/* Message List */}
        <FlatList
          ref={listRef}
          data={[...messages].reverse()}
          inverted
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={{ paddingHorizontal: 8, paddingTop: 8 }}
          ListHeaderComponent={<Animated.View style={animatedFooterStyle} />}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View
              className="items-center justify-center py-14"
            >
              <Text className="text-slate-600 text-[13px]">
                Say hi to {connectedUser.userName || 'your nearby contact'}!
              </Text>
              <Text className="text-slate-500 font-bold text-lg mt-1">No messages yet</Text>
              <View className="mt-4">
                <MaterialCommunityIcons
                  name="message-text-outline"
                  size={64}
                  color="#334155"
                />
              </View>
            </View>
          }
        />

        {/* ── Input Bar ── hidden when disconnected */}
        {!isDisconnected && (
          <Animated.View
            className="absolute left-1.5 right-1.5 bg-slate-800 rounded-[28px] px-1.5 py-1.5 flex-row items-center gap-0.5 border border-slate-700"
            style={animatedInputStyle}
            onLayout={(e) => setInputHeight(e.nativeEvent.layout.height)}
          >
            {/* Mic / Audio picker */}
            <TouchableOpacity onPress={pickAudio} className="p-2 rounded-full" activeOpacity={0.6}>
              <MaterialIcons name="mic" size={22} color="#94a3b8" />
            </TouchableOpacity>

            {/* Document picker */}
            <TouchableOpacity onPress={pickDocument} className="p-2 rounded-full" activeOpacity={0.6}>
              <MaterialIcons name="description" size={21} color="#94a3b8" />
            </TouchableOpacity>

            {/* Text input */}
            <TextInput
              className="flex-1 text-slate-50 text-[15px] max-h-[120px] py-1.5 px-1"
              placeholder="Type a message..."
              placeholderTextColor="#64748b"
              value={inputText}
              onChangeText={setInputText}
              multiline
            />

            {/* Attach (images/videos) */}
            <TouchableOpacity onPress={pickMedia} className="p-2 rounded-full" activeOpacity={0.6}>
              <MaterialIcons name="attach-file" size={22} color="#94a3b8" />
            </TouchableOpacity>

            {/* Send */}
            <TouchableOpacity
              onPress={handleSendText}
              disabled={!inputText.trim()}
              className={`bg-sky-500 p-2.5 rounded-full ${!inputText.trim() ? 'opacity-40' : ''}`}
              activeOpacity={0.7}
            >
              <MaterialIcons name="send" size={20} color="#fff" />
            </TouchableOpacity>
          </Animated.View>
        )}
      </SafeAreaView>
    </>
  );
}
