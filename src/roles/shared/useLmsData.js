import { useEffect, useRef, useState } from "react";
import { loadLmsData, persistLmsData } from "./lmsData";

export function useLmsData() {
  const [data, setData] = useState(loadLmsData);
  const current = useRef(data);
  useEffect(() => {
    const refresh = () => {
      current.current = loadLmsData();
      setData(current.current);
    };
    window.addEventListener("tmcc-lms-data", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("tmcc-lms-data", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  function update(change) {
    const next = typeof change === "function" ? change(current.current) : change;
    current.current = next;
    persistLmsData(next);
    setData(next);
  }
  return [data, update];
}
