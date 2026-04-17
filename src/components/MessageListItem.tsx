import { signal } from '@/native/signal';
import { useSupabase } from '@/providers/SupabaseProvider';
import { chatStore, LocalMessage, MessageType } from '@/store/chatStore';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import { useState } from 'react';
import { ActivityIndicator, Image, Text, TouchableOpacity, View } from 'react-native';

// ── Helpers (same as offline chat) ───────
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


export default function MessageListItem({ message, channelId }: { message: LocalMessage, channelId: string }) {
  const isMe = message.isMe;
  const { supabase } = useSupabase();
  const [isDownloading, setIsDownloading] = useState(false);
  const [localUri, setLocalUri] = useState<string | null>(message.imageUri || message.fileUri || null);

  // Determine the effective message type
  const msgType: MessageType = message.messageType || (message.securePayload ? 'image' : 'text');

  // Handle download & decrypt for any file type
  const handleDownload = async () => {
    if (!message.securePayload) return;
    setIsDownloading(true);

    try {
      const payload = JSON.parse(message.securePayload);

      // 1. Download Encrypted Blob
      const { data: blob, error } = await supabase.storage
        .from('chat-media')
        .download(payload.path);

      if (error) throw error;

      // 2. Convert to Base64
      const fr = new FileReader();
      fr.readAsDataURL(blob);

      fr.onload = async () => {
        const base64Encrypted = (fr.result as string).split(',')[1];

        // 3. Decrypt & Save to Cache
        const extension = payload.extension || getFileExtension(payload.fileName || 'file.bin');
        const finalUri = await signal.decryptAttachment(
          base64Encrypted,
          payload.key,
          payload.iv,
          extension
        );

        // 4. Update UI & Store
        if (finalUri) {
          setLocalUri(finalUri);

          // Update persistent store so we don't download again next time
          await chatStore.updateMessage(channelId, message.id, {
            ...message,
            imageUri: payload.type === 'image' ? finalUri : message.imageUri,
            fileUri: payload.type !== 'image' ? finalUri : message.fileUri,
          });

          // Save images to gallery
          if (payload.type === 'image') {
            saveToGallery(finalUri, extension);
          }
        }
        setIsDownloading(false);
      };
    } catch (e) {
      console.error("Download failed:", e);
      setIsDownloading(false);
    }
  };

  // Helper to save images
  const saveToGallery = async (localUri: string, originalExtension: string) => {
    try {
      if (originalExtension === 'jpg' || originalExtension === 'png') {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status === 'granted') {
          const asset = await MediaLibrary.createAssetAsync(localUri);
          const album = await MediaLibrary.getAlbumAsync('Nativechat');

          if (album == null) {
            await MediaLibrary.createAlbumAsync('Nativechat', asset, false);
          } else {
            await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
          }
          console.log("🖼️ File saved to Gallery album");
        }
      }
    } catch (e) {
      console.log("Gallery save failed (optional feature)", e);
    }
  }

  const renderStatusIcon = () => {
    if (!message.isMe) return null;

    if (message.status === 'sending') {
      return <MaterialIcons name="access-time" size={13} color="#E0E0E0" />;
    }
    if (message.status === 'sent') {
      return <MaterialIcons name="check" size={13} color="#E0E0E0" />;
    }
    if (message.status === 'delivered') {
      return <MaterialIcons name="done-all" size={13} color="#E0E0E0" />;
    }
    if (message.status === 'read') {
      return <MaterialIcons name="done-all" size={13} color="#4FD1C5" />; // Bright teal/cyan for read
    }
    return null;
  };

  // ── Secure file placeholder (not yet downloaded) ──
  const renderSecurePlaceholder = () => {
    const typeLabel = msgType === 'image' ? 'Photo'
      : msgType === 'audio' ? 'Audio'
        : msgType === 'video' ? 'Video'
          : 'File';
    const iconName = msgType === 'audio' ? 'music-note'
      : msgType === 'video' ? 'videocam'
        : msgType === 'document' ? 'description'
          : 'lock-outline';

    return (
      <TouchableOpacity onPress={handleDownload} disabled={isDownloading} activeOpacity={0.8}>
        <View className="w-[240px] h-[140px] bg-slate-50 justify-center items-center m-1 rounded-xl border border-slate-100">
          {isDownloading ? (
            <View className="items-center">
              <ActivityIndicator size="large" color="#0e9484" />
              <Text className="text-slate-400 text-[10px] mt-2 font-bold uppercase tracking-widest">Decrypting...</Text>
            </View>
          ) : (
            <View className="items-center">
              <View className="bg-emerald-500/10 p-4 rounded-full mb-3">
                <MaterialIcons name={iconName as any} size={32} color="#10b981" />
              </View>
              <Text className="text-slate-800 text-sm font-bold">Secure {typeLabel}</Text>
              <Text className="text-slate-400 text-[10px] mt-1">Tap to decrypt & view</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // ── Render content by type ──
  const renderContent = () => {
    // IMAGE
    if (msgType === 'image') {
      if (localUri) {
        return (
          <View className="p-1.5">
            <Image
              source={{ uri: localUri }}
              style={{ width: 240, height: 240, borderRadius: 12 }}
              resizeMode="cover"
            />
          </View>
        );
      }
      if (message.securePayload) {
        return renderSecurePlaceholder();
      }
    }

    // VIDEO
    if (msgType === 'video') {
      if (localUri) {
        return (
          <View className="relative p-1.5">
            <View className="w-[240px] h-[180px] bg-slate-900 rounded-xl items-center justify-center">
              <MaterialCommunityIcons name="video-outline" size={48} color="#475569" />
              <Text className="text-slate-400 text-xs mt-2">{formatFileName(message.fileName || 'Video', 28)}</Text>
            </View>
            <View className="absolute inset-0 items-center justify-center">
              <MaterialCommunityIcons name="play-circle" size={48} color="rgba(255,255,255,0.9)" />
            </View>
          </View>
        );
      }
      if (message.securePayload) {
        return renderSecurePlaceholder();
      }
    }

    // AUDIO
    if (msgType === 'audio') {
      if (localUri || isMe) {
        return (
          <View className="flex-row items-center gap-2.5 px-3 py-2.5 min-w-[220px]">
            <View
              className="w-10 h-10 rounded-full items-center justify-center"
              style={{ backgroundColor: isMe ? 'rgba(255,255,255,0.15)' : '#f1f5f9' }}
            >
              <MaterialCommunityIcons name="music-note" size={24} color={isMe ? '#fff' : '#a855f7'} />
            </View>
            <View className="flex-1">
              <Text
                className={`text-[13px] font-semibold mb-1 ${isMe ? 'text-white' : 'text-slate-700'}`}
                numberOfLines={1}
              >
                {formatFileName(message.fileName || 'Audio', 28)}
              </Text>
              <View className="flex-row items-end gap-[1.5px] h-[18px]">
                {Array.from({ length: 20 }).map((_, i) => (
                  <View
                    key={i}
                    className="w-[3px] rounded-sm"
                    style={{
                      height: 4 + Math.random() * 14,
                      backgroundColor: isMe ? 'rgba(255,255,255,0.4)' : '#cbd5e1'
                    }}
                  />
                ))}
              </View>
            </View>
          </View>
        );
      }
      if (message.securePayload) {
        return renderSecurePlaceholder();
      }
    }

    // DOCUMENT
    if (msgType === 'document') {
      const ext = getFileExtension(message.fileName || '');
      if (localUri || isMe) {
        return (
          <View className="flex-row items-center gap-2.5 px-3 py-2.5 min-w-[200px]">
            <View
              className="w-11 h-11 rounded-xl items-center justify-center"
              style={{ backgroundColor: getDocColor(ext) + '22' }}
            >
              <MaterialCommunityIcons
                name={getDocIcon(ext)}
                size={28}
                color={getDocColor(ext)}
              />
            </View>
            <View className="flex-1">
              <Text
                className={`text-[13px] font-semibold ${isMe ? 'text-white' : 'text-slate-700'}`}
                numberOfLines={1}
              >
                {formatFileName(message.fileName || 'Document', 26)}
              </Text>
              <Text className={`text-[10px] font-bold mt-0.5 uppercase ${isMe ? 'text-teal-100' : 'text-slate-400'}`}>
                {ext.toUpperCase() || 'FILE'}
              </Text>
            </View>
          </View>
        );
      }
      if (message.securePayload) {
        return renderSecurePlaceholder();
      }
    }

    // TEXT (default)
    return (
      <View className="px-3.5 py-2.5">
        <Text className={`text-[15px] leading-[22px] ${isMe ? 'text-white' : 'text-slate-800'}`}>
          {message.text}
        </Text>
      </View>
    );
  };

  // Check if content is media/file (for overlay timestamp styling)
  const isMediaContent = (msgType === 'image' || msgType === 'video') && (localUri || message.securePayload);

  return (
    <View className={`flex-row mb-2 ${isMe ? 'justify-end' : 'justify-start'} px-3`}>
      <View
        className={`rounded-2xl shadow-sm overflow-hidden ${isMe
          ? 'bg-[#0e9484]'
          : 'bg-white border border-gray-100'
          }`}
        style={{
          maxWidth: '82%',
          minWidth: isMe ? 80 : 60,
          elevation: 1,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 1,
          borderBottomRightRadius: isMe ? 4 : 20,
          borderBottomLeftRadius: isMe ? 20 : 4,
        }}
      >
        {renderContent()}

        <View className={`flex-row items-center justify-end gap-1.5 pb-1.5 pr-3 ${isMediaContent ? 'absolute bottom-2 right-2 bg-black/30 px-2 py-0.5 rounded-full' : ''}`}>
          <Text className={`text-[9px] font-bold ${isMe ? (isMediaContent ? 'text-white' : 'text-teal-50') : 'text-slate-400'}`}>
            {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          {renderStatusIcon()}
        </View>

      </View>
    </View>
  )
}