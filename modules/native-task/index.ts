// Reexport the native module. On web, it will be resolved to NativeTaskModule.web.ts
// and on native platforms to NativeTaskModule.ts
export { default } from './src/NativeTaskModule';
export { default as NativeTaskView } from './src/NativeTaskView';
export * from  './src/NativeTask.types';
