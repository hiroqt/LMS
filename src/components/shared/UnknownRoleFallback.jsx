import { BookOpen, GraduationCap, LayoutDashboard, ShieldCheck } from "../../icons";
import "./UnknownRoleFallback.css";

export default function UnknownRoleFallback({ unknownPath = "", onNavigateRole }) {
  const displayPath = unknownPath || (typeof window !== "undefined" ? window.location.pathname : "/");

  return (
    <div className="role-fallback-container">
      <div className="role-fallback-card">
        <div className="role-fallback-brand">
          <span className="role-brand-mark">
            <GraduationCap size={24} />
          </span>
          <span className="role-fallback-title">TMCC LMS<i>.</i></span>
        </div>

        <div className="role-fallback-badge">Unknown Workspace</div>

        <h1 className="role-fallback-heading">Role path not found</h1>

        <p className="role-fallback-description">
          The requested path <code className="role-fallback-code">{displayPath}</code> does not
          correspond to an available role dashboard in this prototype.
        </p>

        <p className="role-fallback-hint">
          Choose an available dashboard below or return to the prototype entry point:
        </p>

        <div className="role-fallback-actions">
          <button
            type="button"
            className="role-fallback-btn role-fallback-btn-primary"
            onClick={() => onNavigateRole?.("student")}
          >
            <LayoutDashboard size={18} />
            <span>Return to Student Workspace (Entry Point)</span>
          </button>

          <div className="role-fallback-grid">
            <button
              type="button"
              className="role-fallback-btn role-fallback-btn-secondary"
              onClick={() => onNavigateRole?.("instructor")}
            >
              <BookOpen size={18} />
              <span>Instructor Workspace</span>
            </button>

            <button
              type="button"
              className="role-fallback-btn role-fallback-btn-secondary"
              onClick={() => onNavigateRole?.("admin")}
            >
              <ShieldCheck size={18} />
              <span>Admin Workspace</span>
            </button>
          </div>
        </div>

        <div className="role-fallback-footer">
          <span>Supported direct role URLs: <code>/student</code>, <code>/instructor</code>, <code>/admin</code></span>
        </div>
      </div>
    </div>
  );
}

