export default function Avatar({ name, tone = 0, small = false }) {
  return <span className={`avatar tone-${tone % 6} ${small ? "avatar-small" : ""}`} aria-hidden="true">{name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>;
}
