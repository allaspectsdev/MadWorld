// Stub for Zustand's optional React peer dependency.
// We use vanilla Zustand (no React) so this is never called at runtime.
export default {};
export const useState = () => [];
export const useEffect = () => {};
export const useCallback = (fn: any) => fn;
export const useRef = () => ({ current: null });
export const useSyncExternalStore = () => undefined;
