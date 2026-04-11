import { requireNativeView } from 'expo';
import * as React from 'react';

import { NativeTaskViewProps } from './NativeTask.types';

const NativeView: React.ComponentType<NativeTaskViewProps> =
  requireNativeView('NativeTask');

export default function NativeTaskView(props: NativeTaskViewProps) {
  return <NativeView {...props} />;
}
