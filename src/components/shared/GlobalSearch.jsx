import { Search, X } from "../../icons";

export default function GlobalSearch({ value, onChange, open, onOpen, items, onSelect, label = "Search workspace", placeholder = "Search...", className = "search-wrap" }) {
  return <div className={className}><Search size={16} /><input value={value} aria-label={label} placeholder={placeholder} onFocus={onOpen} onChange={(event) => { onChange(event.target.value); onOpen(); }} />{value && <button type="button" aria-label="Clear search" onClick={() => onChange("")}><X size={14} /></button>}{open && value && <div className="search-results">{items.length ? items.map((item) => <button type="button" key={`${item.kind}-${item.id}`} onClick={() => onSelect(item)}><small>{item.kind}</small><strong>{item.title}</strong></button>) : <span className="search-empty">No matches found</span>}</div>}</div>;
}
