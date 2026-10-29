import React, { useMemo, useState } from "react";
import { Search } from "../../icons";
import { paginateRecords } from "./pagination";
import "./adminResources.css";

const TABS = ["Materials", "External Links", "Curriculum Modules"];

const RESOURCE_KINDS = [
  "Study guide",
  "Reference sheet",
  "Practice set",
  "Lecture Slides",
  "Lab Manual",
  "Reading",
];

const LINK_CATEGORIES = [
  "Documentation",
  "Research Database",
  "Interactive Tool",
  "Online Course",
  "Academic Journal",
];

function generateId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function getTimestamp() {
  return new Date().toISOString();
}

export default function AdminLearningResources({ data, update }) {
  const [tab, setTab] = useState("Materials");
  const [query, setQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modals & Drawers
  const [activeItem, setActiveItem] = useState(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [moduleModalOpen, setModuleModalOpen] = useState(false);
  const [notice, setNotice] = useState("");

  // Forms state
  const [uploadForm, setUploadForm] = useState({
    title: "",
    subjectId: data.subjects?.[0]?.id || "",
    moduleId: "",
    kind: "Study guide",
    description: "",
    fileType: "pdf",
    fileName: "",
    fileSize: "",
  });
  const [isUploading, setIsUploading] = useState(false);

  const [linkForm, setLinkForm] = useState({
    title: "",
    url: "https://",
    subjectId: data.subjects?.[0]?.id || "",
    category: "Documentation",
    provider: "",
    description: "",
  });

  const [moduleForm, setModuleForm] = useState({
    title: "",
    subjectId: data.subjects?.[0]?.id || "",
    order: 1,
    description: "",
  });

  // Pagination state
  const [pageNumber, setPageNumber] = useState(1);
  const pageSize = 8;

  const subjects = useMemo(() => data.subjects || [], [data.subjects]);
  const modules = useMemo(() => data.modules || [], [data.modules]);
  const materials = useMemo(() => data.materials || [], [data.materials]);
  const externalLinks = useMemo(() => data.externalLinks || [], [data.externalLinks]);

  function updateFilter(setter, value) {
    setter(value);
    setPageNumber(1);
  }

  // Filtered Materials
  const filteredMaterials = useMemo(() => {
    const q = query.trim().toLowerCase();
    return materials.filter((item) => {
      const matchesSearch =
        !q ||
        item.title?.toLowerCase().includes(q) ||
        item.fileName?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q);
      const matchesSubject =
        subjectFilter === "all" || item.subjectId === subjectFilter;
      const matchesKind = kindFilter === "all" || item.kind === kindFilter;
      const matchesStatus =
        statusFilter === "all" || (item.status || "active") === statusFilter;
      return matchesSearch && matchesSubject && matchesKind && matchesStatus;
    });
  }, [materials, query, subjectFilter, kindFilter, statusFilter]);

  // Filtered Links
  const filteredLinks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return externalLinks.filter((item) => {
      const matchesSearch =
        !q ||
        item.title?.toLowerCase().includes(q) ||
        item.provider?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q);
      const matchesSubject =
        subjectFilter === "all" || item.subjectId === subjectFilter;
      return matchesSearch && matchesSubject;
    });
  }, [externalLinks, query, subjectFilter]);

  // Filtered Modules
  const filteredModules = useMemo(() => {
    return modules.filter(
      (m) =>
        subjectFilter === "all" ||
        m.subjectId === subjectFilter ||
        (!m.subjectId &&
          data.classrooms?.find((c) => c.id === m.classroomId)?.subjectId ===
            subjectFilter)
    );
  }, [modules, subjectFilter, data.classrooms]);

  // Active records by tab
  const activeRecords =
    tab === "Materials"
      ? filteredMaterials
      : tab === "External Links"
        ? filteredLinks
        : filteredModules;

  const pagination = useMemo(
    () => paginateRecords(activeRecords, pageNumber, pageSize),
    [activeRecords, pageNumber]
  );

  function showNotice(msg) {
    setNotice(msg);
    setTimeout(() => setNotice(""), 3500);
  }

  // Client-Side Simulated File Download
  function handleDownload(resource) {
    const filename =
      resource.fileName ||
      `${resource.title?.toLowerCase().replace(/[^a-z0-9]+/g, "_") || "resource"}.${resource.fileType || "pdf"}`;
    const fileContent = `=====================================================
TMCC LEARNING RESOURCE REPOSITORY · INSTITUTIONAL COPY
=====================================================

Title: ${resource.title}
Resource Type: ${resource.kind || "Study Material"}
Format: ${resource.fileType?.toUpperCase() || "PDF"}
File Size: ${resource.fileSize || "1.8 MB"}
Uploaded By: ${resource.uploadedBy || "Taylor Morgan (Administrator)"}
Uploaded At: ${resource.uploadedAt || getTimestamp()}
Status: ${resource.status || "active"}

DESCRIPTION & SYLLABUS NOTES:
${resource.description || "Official course material approved for TMCC academic offerings."}

=====================================================
Retrieved from TMCC LMS Learning Resource Repository.
All educational rights reserved.
=====================================================`;

    const blob = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    update((current) => ({
      ...current,
      materials: (current.materials || []).map((m) =>
        m.id === resource.id ? { ...m, downloads: (m.downloads || 0) + 1 } : m
      ),
    }));

    showNotice(`Downloaded "${filename}"`);
  }

  function handleFileSelection(e) {
    const file = e.target.files?.[0];
    if (file) {
      const ext = file.name.split(".").pop().toLowerCase() || "pdf";
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      setUploadForm((prev) => ({
        ...prev,
        fileName: file.name,
        fileType: ext,
        fileSize: `${sizeMb > 0 ? sizeMb : "0.5"} MB`,
        title: prev.title || file.name.replace(/\.[^/.]+$/, ""),
      }));
    }
  }

  function handleUploadSubmit(e) {
    e.preventDefault();
    if (!uploadForm.title.trim()) return;

    setIsUploading(true);
    setTimeout(() => {
      const newMaterial = {
        id: generateId("mat"),
        subjectId: uploadForm.subjectId,
        moduleId:
          uploadForm.moduleId ||
          modules.find((m) => m.subjectId === uploadForm.subjectId)?.id ||
          modules[0]?.id,
        title: uploadForm.title.trim(),
        kind: uploadForm.kind,
        description:
          uploadForm.description.trim() ||
          "Accredited learning resource uploaded to institutional repository.",
        fileType: uploadForm.fileType || "pdf",
        fileName:
          uploadForm.fileName ||
          `${uploadForm.title.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.${uploadForm.fileType || "pdf"}`,
        fileSize: uploadForm.fileSize || "2.1 MB",
        uploadedBy: "Taylor Morgan",
        uploadedAt: getTimestamp(),
        downloads: 0,
        scope: "Institutional",
        status: "active",
      };

      update(
        (current) => ({
          ...current,
          materials: [newMaterial, ...(current.materials || [])],
        }),
        {
          actorId: "admin-1",
          actorName: "Taylor Morgan",
          actorRole: "admin",
          category: "activity",
          action: "uploaded",
          target: newMaterial.title,
          targetId: newMaterial.id,
          summary: `Uploaded learning material "${newMaterial.title}".`,
        }
      );

      setIsUploading(false);
      setUploadModalOpen(false);
      setUploadForm({
        title: "",
        subjectId: subjects[0]?.id || "",
        moduleId: "",
        kind: "Study guide",
        description: "",
        fileType: "pdf",
        fileName: "",
        fileSize: "",
      });
      showNotice(`Uploaded "${newMaterial.title}"`);
    }, 400);
  }

  function handleLinkSubmit(e) {
    e.preventDefault();
    if (!linkForm.title.trim() || !linkForm.url.trim()) return;

    const newLink = {
      id: generateId("ext"),
      title: linkForm.title.trim(),
      url: linkForm.url.trim(),
      subjectId: linkForm.subjectId,
      category: linkForm.category,
      provider: linkForm.provider.trim() || "Institutional Partner",
      description: linkForm.description.trim() || "Verified educational web resource.",
      status: "verified",
      addedAt: getTimestamp(),
    };

    update(
      (current) => ({
        ...current,
        externalLinks: [newLink, ...(current.externalLinks || [])],
      }),
      {
        actorId: "admin-1",
        actorName: "Taylor Morgan",
        actorRole: "admin",
        category: "activity",
        action: "created",
        target: newLink.title,
        targetId: newLink.id,
        summary: `Added external link "${newLink.title}".`,
      }
    );

    setLinkModalOpen(false);
    setLinkForm({
      title: "",
      url: "https://",
      subjectId: subjects[0]?.id || "",
      category: "Documentation",
      provider: "",
      description: "",
    });
    showNotice(`Added external link "${newLink.title}"`);
  }

  function handleModuleSubmit(e) {
    e.preventDefault();
    if (!moduleForm.title.trim()) return;

    const subjectModules = modules.filter(
      (m) => m.subjectId === moduleForm.subjectId
    );
    const newModule = {
      id: generateId("module"),
      subjectId: moduleForm.subjectId,
      classroomId:
        data.classrooms?.find((c) => c.subjectId === moduleForm.subjectId)?.id ||
        "",
      title: moduleForm.title.trim(),
      order: subjectModules.length + 1,
      description: moduleForm.description.trim() || "Academic curriculum unit.",
    };

    update(
      (current) => ({
        ...current,
        modules: [...(current.modules || []), newModule],
      }),
      {
        actorId: "admin-1",
        actorName: "Taylor Morgan",
        actorRole: "admin",
        category: "activity",
        action: "created",
        target: newModule.title,
        targetId: newModule.id,
        summary: `Created module "${newModule.title}".`,
      }
    );

    setModuleModalOpen(false);
    setModuleForm({
      title: "",
      subjectId: (subjectFilter !== "all" ? subjectFilter : subjects[0]?.id) || "",
      order: 1,
      description: "",
    });
    showNotice(`Created module "${newModule.title}"`);
  }

  function toggleStatus(material) {
    const nextStatus = material.status === "archived" ? "active" : "archived";
    update((current) => ({
      ...current,
      materials: (current.materials || []).map((m) =>
        m.id === material.id ? { ...m, status: nextStatus } : m
      ),
    }));
    setActiveItem((prev) => (prev ? { ...prev, status: nextStatus } : null));
    showNotice(
      `Resource marked as ${nextStatus === "archived" ? "Archived" : "Active"}.`
    );
  }

  function getSubject(subjectId) {
    return (
      subjects.find((s) => s.id === subjectId) || {
        code: "GEN",
        title: "General Curriculum",
      }
    );
  }

  function getModule(moduleId) {
    return (
      modules.find((m) => m.id === moduleId) || {
        title: "Unit 1 · Foundations",
      }
    );
  }

  const hasActiveFilters =
    query ||
    subjectFilter !== "all" ||
    (tab === "Materials" && (kindFilter !== "all" || statusFilter !== "all"));

  function clearFilters() {
    setQuery("");
    setSubjectFilter("all");
    setKindFilter("all");
    setStatusFilter("all");
    setPageNumber(1);
  }

  return (
    <section className="admin-directory">
      {/* Tab Switcher identical to Course Management tabs */}
      <div
        className="admin-course-tabs"
        role="tablist"
        aria-label="Learning resource sections"
      >
        {TABS.map((item) => (
          <button
            type="button"
            role="tab"
            key={item}
            aria-selected={tab === item}
            className={tab === item ? "selected" : ""}
            onClick={() => {
              setTab(item);
              setPageNumber(1);
              setQuery("");
            }}
          >
            {item}
          </button>
        ))}
      </div>

      {/* Directory Heading Toolbar identical to Course Management / Enrollments */}
      <div className="admin-directory-heading">
        <p>
          {activeRecords.length}{" "}
          {activeRecords.length === 1 ? "record" : "records"} found{" "}
          <span>· All changes reflect in the shared demo environment.</span>
        </p>
        <button
          type="button"
          className="role-primary admin-add-button"
          onClick={() => {
            if (tab === "Materials") setUploadModalOpen(true);
            else if (tab === "External Links") setLinkModalOpen(true);
            else {
              setModuleForm((prev) => ({
                ...prev,
                subjectId:
                  (subjectFilter !== "all" ? subjectFilter : subjects[0]?.id) ||
                  "",
              }));
              setModuleModalOpen(true);
            }
          }}
        >
          + Add{" "}
          {tab === "Materials"
            ? "material"
            : tab === "External Links"
              ? "external link"
              : "module"}
        </button>
      </div>

      {notice && (
        <div
          className="role-soft-tag"
          style={{
            background: "#eaf5ef",
            color: "#256d56",
            padding: "8px 14px",
            alignSelf: "flex-start",
          }}
        >
          {notice}
        </div>
      )}

      {/* Filter Bar identical to AdminDirectory */}
      <div className="admin-filter-bar">
        <label className="role-search">
          <Search size={16} />
          <input
            aria-label={`Search ${tab.toLowerCase()}`}
            placeholder={`Search ${tab.toLowerCase()}...`}
            value={query}
            onChange={(e) => updateFilter(setQuery, e.target.value)}
          />
        </label>

        <label className="admin-filter-control">
          <span>Subject</span>
          <select
            value={subjectFilter}
            onChange={(e) => updateFilter(setSubjectFilter, e.target.value)}
          >
            <option value="all">All subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} · {s.title}
              </option>
            ))}
          </select>
        </label>

        {tab === "Materials" && (
          <>
            <label className="admin-filter-control">
              <span>Resource type</span>
              <select
                value={kindFilter}
                onChange={(e) => updateFilter(setKindFilter, e.target.value)}
              >
                <option value="all">All types</option>
                {RESOURCE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>

            <label className="admin-filter-control">
              <span>Status</span>
              <select
                value={statusFilter}
                onChange={(e) => updateFilter(setStatusFilter, e.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </label>
          </>
        )}

        {hasActiveFilters && (
          <button
            type="button"
            className="admin-clear-filters"
            onClick={clearFilters}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Uniform Record Card Table identical to Course Management & Enrollments */}
      <div className="admin-record-card">
        {!activeRecords.length ? (
          <div className="role-empty">
            <strong>No {tab.toLowerCase()} found</strong>
            <span>Try adjusting your search terms or add a new entry.</span>
          </div>
        ) : (
          <div className="role-table-wrap">
            <table className="role-table">
              <thead>
                <tr>
                  {tab === "Materials" && (
                    <>
                      <th>Material / File</th>
                      <th>Subject</th>
                      <th>Curriculum Unit</th>
                      <th>Format & Size</th>
                      <th>Uploaded</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </>
                  )}

                  {tab === "External Links" && (
                    <>
                      <th>Resource & URL</th>
                      <th>Category</th>
                      <th>Subject</th>
                      <th>Provider</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </>
                  )}

                  {tab === "Curriculum Modules" && (
                    <>
                      <th>Unit / Module Title</th>
                      <th>Subject</th>
                      <th>Attached Materials</th>
                      <th>External Links</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {tab === "Materials" &&
                  pagination.records.map((item) => {
                    const sub = getSubject(item.subjectId);
                    const mod = getModule(item.moduleId);
                    return (
                      <tr key={item.id}>
                        <td>
                          <strong
                            style={{ cursor: "pointer", color: "#2c5949" }}
                            onClick={() => setActiveItem(item)}
                          >
                            {item.title}
                          </strong>
                          <small>{item.fileName || `${item.title}.pdf`}</small>
                        </td>
                        <td>
                          <span
                            className="role-soft-tag"
                            style={{ cursor: "pointer" }}
                            onClick={() => setActiveItem(item)}
                          >
                            {sub.code}
                          </span>
                        </td>
                        <td>{mod.title}</td>
                        <td>
                          <span className="role-pill">
                            {(item.fileType || "pdf").toUpperCase()}
                          </span>
                          <small>
                            {item.fileSize || "1.8 MB"} ·{" "}
                            {item.kind || "Study guide"}
                          </small>
                        </td>
                        <td>
                          {item.uploadedBy || "Taylor Morgan"}
                          <small>
                            {item.uploadedAt
                              ? new Date(item.uploadedAt).toLocaleDateString()
                              : "Oct 18, 2026"}
                          </small>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: "6px" }}>
                            <button
                              type="button"
                              className="role-row-action action-download"
                              onClick={() => handleDownload(item)}
                            >
                              Download
                            </button>
                            <button
                              type="button"
                              className="role-row-action action-inspect"
                              onClick={() => setActiveItem(item)}
                            >
                              Inspect
                            </button>
                            <button
                              type="button"
                              className={`role-row-action ${item.status === "active" ? "action-archive" : "action-restore"}`}
                              onClick={() => toggleStatus(item)}
                            >
                              {item.status === "active" ? "Archive" : "Restore"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                {tab === "External Links" &&
                  pagination.records.map((link) => {
                    const sub = getSubject(link.subjectId);
                    return (
                      <tr key={link.id}>
                        <td>
                          <strong>{link.title}</strong>
                          <small style={{ color: "#397b64" }}>{link.url}</small>
                        </td>
                        <td>
                          <span className="role-pill">{link.category}</span>
                        </td>
                        <td>
                          <span className="role-soft-tag">{sub.code}</span>
                        </td>
                        <td>{link.provider || "Institutional"}</td>
                        <td>
                          <span className="role-status is-active">
                            {link.status || "verified"}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="role-row-action action-link"
                            style={{ textDecoration: "none" }}
                          >
                            Open link ↗
                          </a>
                        </td>
                      </tr>
                    );
                  })}

                {tab === "Curriculum Modules" &&
                  pagination.records.map((unit, index) => {
                    const sub = getSubject(unit.subjectId);
                    const unitMaterials = materials.filter(
                      (m) => m.moduleId === unit.id
                    );
                    const unitLinks = externalLinks.filter(
                      (l) => l.subjectId === unit.subjectId
                    );
                    return (
                      <tr key={unit.id}>
                        <td>
                          <strong>
                            Unit {index + 1} · {unit.title}
                          </strong>
                          <small>
                            {unit.description || "Academic unit syllabus."}
                          </small>
                        </td>
                        <td>
                          <span className="role-soft-tag">{sub.code}</span>
                        </td>
                        <td>
                          <strong>{unitMaterials.length}</strong> materials
                          <small>
                            {unitMaterials
                              .slice(0, 2)
                              .map((m) => m.title)
                              .join(", ") || "No materials"}
                          </small>
                        </td>
                        <td>
                          <strong>{unitLinks.length}</strong> links
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            className="role-row-action action-link"
                            onClick={() => {
                              setSelectedSubjectId(unit.subjectId);
                              setUploadForm((prev) => ({
                                ...prev,
                                subjectId: unit.subjectId,
                                moduleId: unit.id,
                              }));
                              setUploadModalOpen(true);
                            }}
                          >
                            + Add material
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}

        {/* Uniform Pagination identical to AdminDirectory */}
        {activeRecords.length > 0 && (
          <nav
            className="admin-pagination"
            aria-label={`${tab.toLowerCase()} pages`}
          >
            <span>
              Showing {(pagination.page - 1) * pageSize + 1}–
              {Math.min(pagination.page * pageSize, activeRecords.length)} of{" "}
              {activeRecords.length}
            </span>
            <div>
              <button
                type="button"
                onClick={() => setPageNumber(pagination.page - 1)}
                disabled={pagination.page === 1}
              >
                Previous
              </button>
              {pagination.pageNumbers.map((number) => (
                <button
                  type="button"
                  key={number}
                  className={number === pagination.page ? "active" : ""}
                  aria-current={
                    number === pagination.page ? "page" : undefined
                  }
                  aria-label={`Page ${number}`}
                  onClick={() => setPageNumber(number)}
                >
                  {number}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPageNumber(pagination.page + 1)}
                disabled={pagination.page === pagination.pageCount}
              >
                Next
              </button>
            </div>
          </nav>
        )}
      </div>

      {/* MODAL 1: UPLOAD MATERIAL */}
      {uploadModalOpen && (
        <div
          className="admin-modal-backdrop"
          onClick={() => setUploadModalOpen(false)}
        >
          <div
            className="admin-modal-card"
            style={{ width: "min(100%, 520px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-head">
              <div>
                <h3>Upload Learning Material</h3>
                <p>Upload a course document or syllabus file.</p>
              </div>
              <button
                type="button"
                className="role-close"
                onClick={() => setUploadModalOpen(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} style={{ display: "grid", gap: 12 }}>
              <label className="admin-upload-dropzone">
                <input
                  type="file"
                  accept=".pdf,.docx,.pptx,.txt,.zip"
                  style={{ display: "none" }}
                  onChange={handleFileSelection}
                />
                <p>
                  {uploadForm.fileName
                    ? "Click to change selected file"
                    : "Drag & drop document here, or browse files"}
                </p>
                <small>Supported: PDF, DOCX, PPTX, ZIP (Max 50MB)</small>
              </label>

              {uploadForm.fileName && (
                <div className="admin-selected-file-badge">
                  <span>
                    📄 {uploadForm.fileName} ({uploadForm.fileSize})
                  </span>
                  <span className="role-status is-active">Ready</span>
                </div>
              )}

              {isUploading && (
                <div className="admin-upload-progress">
                  <div className="admin-upload-progress-bar" />
                </div>
              )}

              <label className="role-field">
                <span>Material Title *</span>
                <input
                  required
                  placeholder="e.g., Relational Database Normalization"
                  value={uploadForm.title}
                  onChange={(e) =>
                    setUploadForm({ ...uploadForm, title: e.target.value })
                  }
                />
              </label>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <label className="role-field">
                  <span>Subject *</span>
                  <select
                    value={uploadForm.subjectId}
                    onChange={(e) =>
                      setUploadForm({ ...uploadForm, subjectId: e.target.value })
                    }
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} · {s.title}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="role-field">
                  <span>Type *</span>
                  <select
                    value={uploadForm.kind}
                    onChange={(e) =>
                      setUploadForm({ ...uploadForm, kind: e.target.value })
                    }
                  >
                    {RESOURCE_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="role-field">
                <span>Description</span>
                <textarea
                  rows={2}
                  placeholder="Key topics and learning goals covered..."
                  value={uploadForm.description}
                  onChange={(e) =>
                    setUploadForm({
                      ...uploadForm,
                      description: e.target.value,
                    })
                  }
                />
              </label>

              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="role-secondary"
                  onClick={() => setUploadModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="role-primary"
                  disabled={isUploading || !uploadForm.title.trim()}
                >
                  {isUploading ? "Uploading..." : "Save Material"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD EXTERNAL LINK */}
      {linkModalOpen && (
        <div
          className="admin-modal-backdrop"
          onClick={() => setLinkModalOpen(false)}
        >
          <div
            className="admin-modal-card"
            style={{ width: "min(100%, 500px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-head">
              <div>
                <h3>Add External Learning Link</h3>
                <p>Register an approved learning website or research library.</p>
              </div>
              <button
                type="button"
                className="role-close"
                onClick={() => setLinkModalOpen(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleLinkSubmit} style={{ display: "grid", gap: 12 }}>
              <label className="role-field">
                <span>Resource Title *</span>
                <input
                  required
                  placeholder="e.g., IEEE Xplore Digital Library"
                  value={linkForm.title}
                  onChange={(e) =>
                    setLinkForm({ ...linkForm, title: e.target.value })
                  }
                />
              </label>

              <label className="role-field">
                <span>URL *</span>
                <input
                  type="url"
                  required
                  placeholder="https://..."
                  value={linkForm.url}
                  onChange={(e) =>
                    setLinkForm({ ...linkForm, url: e.target.value })
                  }
                />
              </label>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <label className="role-field">
                  <span>Subject</span>
                  <select
                    value={linkForm.subjectId}
                    onChange={(e) =>
                      setLinkForm({ ...linkForm, subjectId: e.target.value })
                    }
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} · {s.title}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="role-field">
                  <span>Category</span>
                  <select
                    value={linkForm.category}
                    onChange={(e) =>
                      setLinkForm({ ...linkForm, category: e.target.value })
                    }
                  >
                    {LINK_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="role-field">
                <span>Provider</span>
                <input
                  placeholder="e.g., Mozilla, IEEE, PostgreSQL Group"
                  value={linkForm.provider}
                  onChange={(e) =>
                    setLinkForm({ ...linkForm, provider: e.target.value })
                  }
                />
              </label>

              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="role-secondary"
                  onClick={() => setLinkModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="role-primary">
                  Save Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD MODULE */}
      {moduleModalOpen && (
        <div
          className="admin-modal-backdrop"
          onClick={() => setModuleModalOpen(false)}
        >
          <div
            className="admin-modal-card"
            style={{ width: "min(100%, 460px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-head">
              <div>
                <h3>Create Curriculum Module</h3>
                <p>Define a new unit to group study materials.</p>
              </div>
              <button
                type="button"
                className="role-close"
                onClick={() => setModuleModalOpen(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleModuleSubmit} style={{ display: "grid", gap: 12 }}>
              <label className="role-field">
                <span>Unit Title *</span>
                <input
                  required
                  placeholder="e.g., Unit 2 · Advanced Algorithms"
                  value={moduleForm.title}
                  onChange={(e) =>
                    setModuleForm({ ...moduleForm, title: e.target.value })
                  }
                />
              </label>

              <label className="role-field">
                <span>Subject *</span>
                <select
                  value={moduleForm.subjectId}
                  onChange={(e) =>
                    setModuleForm({ ...moduleForm, subjectId: e.target.value })
                  }
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} · {s.title}
                    </option>
                  ))}
                </select>
              </label>

              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="role-secondary"
                  onClick={() => setModuleModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="role-primary">
                  Create Unit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAILS SLIDE-OUT / MODAL */}
      {activeItem && (
        <div
          className="admin-modal-backdrop"
          onClick={() => setActiveItem(null)}
        >
          <div
            className="admin-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-head">
              <div>
                <h3>Resource Details</h3>
                <p>Inspect metadata and file properties.</p>
              </div>
              <button
                type="button"
                className="role-close"
                onClick={() => setActiveItem(null)}
              >
                ×
              </button>
            </div>

            <div className="admin-modal-details">
              <div className="admin-detail-item">
                <span>Title</span>
                <strong>{activeItem.title}</strong>
              </div>
              <div className="admin-detail-item">
                <span>File Name</span>
                <strong>
                  {activeItem.fileName || `${activeItem.title}.pdf`}
                </strong>
              </div>
              <div className="admin-detail-item">
                <span>Subject</span>
                <strong>
                  {getSubject(activeItem.subjectId).code} ·{" "}
                  {getSubject(activeItem.subjectId).title}
                </strong>
              </div>
              <div className="admin-detail-item">
                <span>Curriculum Unit</span>
                <strong>{getModule(activeItem.moduleId).title}</strong>
              </div>
              <div className="admin-detail-item">
                <span>Format & Size</span>
                <strong>
                  {(activeItem.fileType || "pdf").toUpperCase()} ·{" "}
                  {activeItem.fileSize || "1.8 MB"}
                </strong>
              </div>
              <div className="admin-detail-item">
                <span>Uploaded By</span>
                <strong>{activeItem.uploadedBy || "Taylor Morgan"}</strong>
              </div>
              <div className="admin-detail-item">
                <span>Total Downloads</span>
                <strong>{activeItem.downloads || 0} times</strong>
              </div>
              <div className="admin-detail-item">
                <span>Status</span>
                <span
                  className={`role-status ${
                    activeItem.status === "active" ? "is-active" : ""
                  }`}
                >
                  {activeItem.status || "active"}
                </span>
              </div>
            </div>

            <div
              className="admin-modal-actions"
              style={{ justifyContent: "space-between" }}
            >
              <button
                type="button"
                className="role-secondary"
                onClick={() => toggleStatus(activeItem)}
              >
                {activeItem.status === "archived" ? "Restore" : "Archive"}
              </button>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="role-primary"
                  onClick={() => handleDownload(activeItem)}
                >
                  Download File
                </button>
                <button
                  type="button"
                  className="role-secondary"
                  onClick={() => setActiveItem(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
