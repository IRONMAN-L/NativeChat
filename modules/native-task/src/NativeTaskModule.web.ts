import { registerWebModule, NativeModule } from 'expo';

import { ChangeEventPayload } from './NativeTask.types';

type NativeTaskModuleEvents = {
  onChange: (params: ChangeEventPayload) => void;
}

class NativeTaskModule extends NativeModule<NativeTaskModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
};

export default registerWebModule(NativeTaskModule, 'NativeTaskModule');
