import * as React from 'react';

import { NativeTaskViewProps } from './NativeTask.types';

export default function NativeTaskView(props: NativeTaskViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
