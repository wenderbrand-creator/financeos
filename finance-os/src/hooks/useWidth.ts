import React, { useState, useEffect, useRef } from "react";

export function useWidth(): [React.MutableRefObject<any>, number] {
  const ref = useRef(null); const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(ref.current); return () => ro.disconnect();
  }, []);
  return [ref, w];
}
