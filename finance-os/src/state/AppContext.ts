import { useContext, createContext } from "react";

/* =====================================================================
   8. APP CONTEXT & SHARED COMPONENTS
   ===================================================================== */
export const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);
