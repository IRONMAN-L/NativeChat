import type { StyleProp, ViewStyle } from 'react-native';

export type OnLoadEventPayload = {
  url: string;
};

export type NativeTaskModuleEvents = {
  onUserFound: (event: { endpointId: string; userName: string; }) => void;
  onConnected: (event: { endpointId: string }) => void;
  onMessageReceived: (event: { endpointId: string; message: string }) => void;
  onDisconnected: (event: { endpointId: string }) => void;
  onTransferUpdate: (event: { endpointId: string; payloadId: string; status: string; progress: string; isFile: boolean }) => void;
  onFileReceived: (event: { endpointId: string; fileUri: string; payloadId: string }) => void;
  onChange: (params: ChangeEventPayload) => void;
};

export type ChangeEventPayload = {
  value: string;
};

export type NativeTaskViewProps = {
  url: string;
  onLoad: (event: { nativeEvent: OnLoadEventPayload }) => void;
  style?: StyleProp<ViewStyle>;
};
