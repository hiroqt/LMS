import { createContext } from "react";
import type { AdminData, UpdateAdminData } from "./data/types";

export interface AdminSession {
  data: AdminData;
  update: UpdateAdminData;
}

export const AdminContext = createContext<AdminSession | null>(null);
