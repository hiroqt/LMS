import { Bell, Clock3 } from "../../icons";

export default function NotificationMenu({ open, onToggle, items, title = "Notifications", onSelect }) {
  return <div className="popover-holder"><button className="top-icon" type="button" aria-label="Notifications" aria-expanded={open} onClick={onToggle}><Bell size={18} />{items.length > 0 && <i />}</button>{open && <div className="popover notification-menu"><strong>{title}</strong>{items.length ? items.map((item) => <button key={item.id} type="button" onClick={() => onSelect(item)}><Clock3 size={15} /><span>{item.title}<small>{item.detail}</small></span></button>) : <span className="search-empty">You’re all caught up.</span>}</div>}</div>;
}
