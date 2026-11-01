import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

const LoadingScreenContext = createContext({ hasFullScreen: false, registerFullScreen: () => () => {} });

export function LoadingScreenProvider({ children }) {
  const [count, setCount] = useState(0);
  const registerFullScreen = useCallback(() => {
    let registered = true;
    setCount(value => value + 1);
    return () => {
      if (registered) { registered = false; setCount(value => Math.max(0, value - 1)); }
    };
  }, []);
  const value = useMemo(() => ({ hasFullScreen: count > 0, registerFullScreen }), [count, registerFullScreen]);
  return <LoadingScreenContext.Provider value={value}>{children}</LoadingScreenContext.Provider>;
}

export const useLoadingScreen = () => useContext(LoadingScreenContext);
