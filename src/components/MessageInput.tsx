import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useState } from "react";
import { Alert, Image, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

// Structured file info so the parent screen knows name + type
export type PickedFile = {
    uri: string;
    name: string;
    mimeType?: string;
};

type Props = {
    keyboardHeight: { value: number };
    setInputHeight?: (h: number) => void;
    onSend: (inputText: string, images: string[], files: PickedFile[]) => Promise<void>;
    bottomInset: number;
}

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
        case 'mp3': case 'wav': case 'aac': case 'ogg': case 'm4a': case 'flac': return 'music-note';
        default: return 'file-outline';
    }
}

function getDocColor(ext: string): string {
    switch (ext) {
        case 'pdf': return '#ef4444';
        case 'xls': case 'xlsx': return '#22c55e';
        case 'doc': case 'docx': return '#3b82f6';
        case 'ppt': case 'pptx': return '#f97316';
        case 'mp3': case 'wav': case 'aac': case 'ogg': case 'm4a': case 'flac': return '#a855f7';
        default: return '#94a3b8';
    }
}

function formatFileName(name: string, maxLen = 18): string {
    if (name.length <= maxLen) return name;
    const ext = name.split('.').pop() || '';
    const base = name.slice(0, maxLen - ext.length - 4);
    return `${base}...${ext}`;
}


export default function MessageInput({ keyboardHeight, setInputHeight, onSend, bottomInset }: Props) {
    const [message, setMessage] = useState<string | null>(null);
    const [images, setImages] = useState<string[]>([]);
    const [files, setFiles] = useState<PickedFile[]>([]);

    const handleSend = async () => {
        const pivotMessage = message;
        const pivotImages = images;
        const pivotFiles = files;
        setMessage(null);
        setImages([]);
        setFiles([]);
        await onSend(pivotMessage || '', pivotImages, pivotFiles);
    }

    // keyboard go up
    const animatedStyle = useAnimatedStyle(() => {
        const effective = Math.max(keyboardHeight.value - bottomInset, 0);

        return {
            transform: [{ translateY: -effective }]
        }
    })


    const pickImage = async () => {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permissionResult.granted) {
            Alert.alert('Permission required', 'Permission to access the media library is required');
            return;
        }

        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images', 'videos'],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 1,
            allowsMultipleSelection: images.length > 1 ? false : true,
            selectionLimit: 5
        });

        if (!result.canceled) {
            // Append images
            const newUris = result.assets.map(a => a.uri);
            setImages(prev => [...prev, ...newUris]);
        }
    }

    const pickAudio = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'audio/*',
                copyToCacheDirectory: true,
                multiple: true,
            });
            if (!result.canceled && result.assets?.length) {
                const newFiles = result.assets.map(a => ({
                    uri: a.uri,
                    name: a.name,
                    mimeType: a.mimeType || 'audio/*',
                }));
                setFiles(prev => [...prev, ...newFiles]);
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
                multiple: true,
            });
            if (!result.canceled && result.assets?.length) {
                const newFiles = result.assets.map(a => ({
                    uri: a.uri,
                    name: a.name,
                    mimeType: a.mimeType || 'application/octet-stream',
                }));
                setFiles(prev => [...prev, ...newFiles]);
            }
        } catch {
            Alert.alert('Error', 'Failed to pick document.');
        }
    };

    const openCamera = async () => {
        const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

        if (!permissionResult.granted) {
            Alert.alert('Permission required', 'Permission to open camera is required');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['videos', 'images'],
        });

        if (!result.canceled) {
            setImages(prev => [...prev, result.assets[0].uri])
        }

    }

    const removeImage = (indexToRemove: number) => {
        setImages(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    const removeFile = (indexToRemove: number) => {
        setFiles(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    const hasContent = !!(message?.trim() || images.length > 0 || files.length > 0);

    return (

        <Animated.View
            style={[
                {
                    position: "absolute",
                    left: 6,
                    right: 6,
                    bottom: bottomInset,
                    backgroundColor: "white",
                    borderRadius: 24,
                    paddingHorizontal: 8,
                    paddingVertical: 6,
                    flexDirection: "column",
                    alignItems: "stretch",
                    gap: 6,
                    elevation: 4,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.08,
                    shadowRadius: 8,
                }, animatedStyle
            ]}
            onLayout={(e) => setInputHeight?.(e.nativeEvent.layout.height)}
        >
            {images.length > 0 && (
                <View className="h-32 w-full">
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                        {images.map((uri, index) => (
                            <View key={index} className="w-24 h-24 relative">
                                <Image source={{ uri }} className='w-full h-full rounded-xl' />
                                <TouchableOpacity
                                    className="absolute -top-2 -right-2 bg-gray-200 w-6 h-6 rounded-full justify-center items-center z-10"
                                    onPress={() => removeImage(index)}
                                >
                                    <MaterialIcons name="close" size={16} color="dimgray" />
                                </TouchableOpacity>
                            </View>
                        ))}

                    </ScrollView>
                </View>
            )}
            {files.length > 0 && (
                <View className="w-full">
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                        {files.map((file, index) => {
                            const ext = getFileExtension(file.name);
                            const isAudio = file.mimeType?.startsWith('audio/');
                            return (
                                <View key={index} className="flex-row items-center bg-gray-100 rounded-xl px-3 py-2 gap-2 max-w-[200px]">
                                    <View
                                        className="w-9 h-9 rounded-lg items-center justify-center"
                                        style={{ backgroundColor: getDocColor(ext) + '20' }}
                                    >
                                        <MaterialCommunityIcons
                                            name={isAudio ? 'music-note' : getDocIcon(ext)}
                                            size={22}
                                            color={getDocColor(ext)}
                                        />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-xs font-semibold text-slate-700" numberOfLines={1}>
                                            {formatFileName(file.name)}
                                        </Text>
                                        <Text className="text-[10px] text-slate-400 font-bold uppercase">
                                            {ext.toUpperCase() || 'FILE'}
                                        </Text>
                                    </View>
                                    <TouchableOpacity onPress={() => removeFile(index)} className="ml-1">
                                        <MaterialIcons name="close" size={16} color="#94a3b8" />
                                    </TouchableOpacity>
                                </View>
                            );
                        })}
                    </ScrollView>
                </View>
            )}
            <View className="w-full flex-row items-center gap-1">
                {/* Audio picker */}
                <TouchableOpacity onPress={pickAudio} className="p-2" activeOpacity={0.6}>
                    <MaterialIcons name="mic" size={22} color="#666" />
                </TouchableOpacity>

                {/* Document picker */}
                <TouchableOpacity onPress={pickDocument} className="p-2" activeOpacity={0.6}>
                    <MaterialIcons name="description" size={21} color="#666" />
                </TouchableOpacity>

                {/* Text input — flex-1 so it fills the remaining space */}
                <TextInput
                    placeholder="Type something..."
                    value={message || ""}
                    onChangeText={setMessage}
                    placeholderTextColor={'gray'}
                    className="flex-1 bg-white px-3 py-2 text-base max-h-32"
                    multiline={true}
                />

                {/* Attach (images/videos) */}
                <TouchableOpacity onPress={pickImage} className="p-2" activeOpacity={0.6}>
                    <MaterialIcons name="attach-file" size={22} color="#666" />
                </TouchableOpacity>

                {/* Camera */}
                <TouchableOpacity onPress={openCamera} className="p-2" activeOpacity={0.6}>
                    <MaterialIcons name="camera-alt" size={22} color="#666" />
                </TouchableOpacity>

                {/* Send */}
                {hasContent && <TouchableOpacity onPress={handleSend} disabled={!hasContent} activeOpacity={0.7}>
                    <View className={`p-2.5 rounded-full ${hasContent ? 'bg-[#0e9484]' : 'bg-gray-300'}`}>
                        <MaterialIcons name={hasContent ? "send" : "mic"} size={20} color="white" />
                    </View>
                </TouchableOpacity>}
            </View>
        </Animated.View>

    )

}