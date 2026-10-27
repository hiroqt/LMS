import { ChevronRight } from "../../icons";

export default function Breadcrumbs({ current, onHome, className = "" }) {
  return <div className={className}><button type="button" onClick={onHome}>Workspace</button><ChevronRight size={14} /><strong>{current}</strong></div>;
}
