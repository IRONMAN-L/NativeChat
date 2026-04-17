import { NativeModule, requireNativeModule } from 'expo';

import { NativeTaskModuleEvents } from './NativeTask.types';

declare class NativeTaskModule extends NativeModule<NativeTaskModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;

  // Background worker
  sendReply(url: string, token: string, payload: Record<string, string>): Promise<void>;
  markAsRead(url: string, token: string, payload: Record<string, string>): Promise<void>;

  // Nearby device Module
  startAdvertising(userName: string): void;
  startDiscovery(): void;
  connectToUser(endpointId: string, myName: string): void;
  sendMessage(endpointId: string, message: string): void;
  sendFile(endpointId: string, fileUriString: string): void;
  stopAll(): void;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<NativeTaskModule>('NativeTask');
