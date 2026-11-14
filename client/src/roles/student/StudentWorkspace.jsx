import App from "../../App";

export default function StudentWorkspace({ onNavigateRole, currentRole = "student" }) {
  return <App onNavigateRole={onNavigateRole} currentRole={currentRole} />;
}
