import { signal } from '@/native/signal';
import { useSupabase } from '@/providers/SupabaseProvider';
import { chatStore, LocalMessage } from '@/store/chatStore';
import { MaterialIcons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import { useState } from 'react';
import { ActivityIndicator, Image, Text, TouchableOpacity, View } from 'react-native';
export default function MessageListItem({ message, channelId }: { message: LocalMessage, channelId: string }) {
  const isMe = message.isMe;
  const { supabase } = useSupabase();
  const [isDownloading, setIsDownloading] = useState(false);
  const [localUri, setLocalUri] = useState<string | null>(message.imageUri);


  // Handle download
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
        const finalUri = await signal.decryptImage(
          base64Encrypted,
          payload.key,
          payload.iv
        );

        // 4. Update UI & Store
        if (finalUri) {
          setLocalUri(finalUri); // Show locally instant

          // Update persistent store so we don't download again next time
          await chatStore.updateMessage(channelId, message.id, {
            ...message,
            imageUri: finalUri
          });
          saveToGallery(finalUri)
        }
        setIsDownloading(false);
      };
    } catch (e) {
      console.error("Download failed:", e);
      setIsDownloading(false);
    }
  };

  // Helper to save images
  const saveToGallery = async (localUri: string) => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync()
      if (status === 'granted') {
        await MediaLibrary.createAssetAsync(localUri);
        console.log("🖼️ Saved to Gallery!");
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



  return (
    <View className={`flex-row mb-3 ${isMe ? 'justify-end' : 'justify-start'} px-2`}>
      <View
        className={`rounded-2xl px-3 py-2 shadow-sm ${isMe
          ? 'bg-[#0e9484] rounded-br-none'
          : 'bg-white rounded-bl-none'
          }`}
        style={{
          maxWidth: '80%',
          minWidth: 70, // Ensure enough space for short words + time if needed
          elevation: 2,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.18,
          shadowRadius: 1.0,
        }}
      >
        {localUri ? (
          <View className="p-1">
            <Image
              source={{ uri: localUri }}
              style={{ width: 200, height: 200, borderRadius: 10 }}
              resizeMode="cover"
            />
            {/* Sender Loading Indicator (Clock) is handled by renderStatusIcon below */}
          </View>
        ) : (
          message.securePayload ? (
            <TouchableOpacity onPress={handleDownload} disabled={isDownloading}>
              <View className="w-[200px] h-[200px] bg-slate-100 justify-center items-center rounded-lg border border-slate-200">
                {isDownloading ? (
                  <ActivityIndicator size="large" color="#0e9484" />
                ) : (
                  <View className="items-center gap-2">
                    <View className="bg-slate-200 p-3 rounded-full">
                      <MaterialIcons name="file-download" size={32} color="gray" />
                    </View>
                    <Text className="text-gray-500 text-xs font-bold">Tap to View Photo</Text>
                    <Text className="text-gray-400 text-[10px]">Encrypted • 2.4 MB</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ) : (
            // Normal Text Message
            <Text className={`text-[15.5px] leading-6 px-3 py-2 ${isMe ? 'text-white' : 'text-slate-800'}`}>
              {message.text}
            </Text>
          )
        )}

        <View className="flex-row items-center justify-end gap-1 mt-0.5 opacity-90 self-end">
          <Text className={`text-[10px] ${isMe ? 'text-teal-50' : 'text-slate-400'}`}>
            {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          {renderStatusIcon()}
        </View>

      </View>
    </View>
  )
}