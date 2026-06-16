import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { publicApi } from "@/lib/api";

interface MaintenanceCtx {
  maintenance: boolean;
  refresh: () => void;
  setMaintenance: (v: boolean) => void;
}

const Ctx = createContext<MaintenanceCtx>({ maintenance: false, refresh: () => {}, setMaintenance: () => {} });

export function MaintenanceProvider({ children }: { children: ReactNode }) {
  const [maintenance, setMaintenance] = useState(false);

  const refresh = useCallback(() => {
    publicApi.maintenance().then(r => {
      if (r.ok) setMaintenance(!!r.data.maintenance_mode);
    });
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return <Ctx.Provider value={{ maintenance, refresh, setMaintenance }}>{children}</Ctx.Provider>;
}

export const useMaintenance = () => useContext(Ctx);

export const MAINTENANCE_TEXT = "Стартап на этапе доработки. Сейчас можно знакомиться с функциями — покупки, продажи и оплаты временно отключены.";
