import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const QUOTES = [
  "Sedikit demi sedikit jadi bukit",
  "Fokus pada langkah berikutnya",
  "Konsisten itu kunci",
  "Kamu lebih dekat dari yang kamu kira",
  "Hari ini lebih baik dari kemarin",
];

const CATEGORIES = ["Kuliah", "Kerja", "Personal", "Lainnya"];
const MAX_LEN = 100;

function App() {
  // ----- STATE -----
  const [tasks, setTasks] = useState(() => {
    const saved = localStorage.getItem("tasks");
    return saved ? JSON.parse(saved) : [];
  });

  const [newTask, setNewTask] = useState("");
  const [newCategory, setNewCategory] = useState(CATEGORIES[0]);

  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    return saved ? JSON.parse(saved) : false;
  });

  const [filter, setFilter] = useState("all"); // all | done | todo
  const [sort, setSort] = useState("newest"); // newest | oldest
  const [search, setSearch] = useState("");
  const searchDebounceRef = useRef(null);

  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState("");

  const [toast, setToast] = useState("");
  const toastActionRef = useRef(null); // simpan aksi untuk tombol Undo

  const [error, setError] = useState("");

  // animasi keluar
  const [removingIds, setRemovingIds] = useState(new Set());

  // ----- EFFECTS -----
  // Debounce save ke localStorage
  const saveTimer = useRef(null);
  useEffect(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      localStorage.setItem("tasks", JSON.stringify(tasks));
    }, 250);
    return () => clearTimeout(saveTimer.current);
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem("darkMode", JSON.stringify(darkMode));
  }, [darkMode]);

  useEffect(() => {
    if (tasks.length > 0 && tasks.every((t) => t.completed)) {
      showToast("Semua tugas selesai! 🎉");
    }
  }, [tasks]);

  // ----- HELPERS -----
  const fmtDate = (ts) => new Date(ts).toLocaleDateString();
  const fmtTime = (ts) => new Date(ts).toLocaleTimeString();

  const showToast = (msg, actionLabel, actionFn) => {
    setToast(msg);
    toastActionRef.current = actionLabel && actionFn ? { actionLabel, actionFn } : null;
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => {
      setToast("");
      toastActionRef.current = null;
    }, 2500);
  };

  const normalized = (s) => s.replace(/\s+/g, " ").trim();

  const isDuplicate = (text, category, excludeId = null) => {
    const key = normalized(text).toLowerCase();
    return tasks.some(
      (t) =>
        (excludeId ? t.id !== excludeId : true) &&
        t.category === category &&
        t.text.toLowerCase() === key
    );
  };

  const validToAdd = () => {
    const text = normalized(newTask);
    if (!text) {
      setError("Tugas tidak boleh kosong");
      return false;
    }
    if (text.length > MAX_LEN) {
      setError(`Maksimal ${MAX_LEN} karakter`);
      return false;
    }
    if (isDuplicate(text, newCategory)) {
      setError("Tugas dengan kategori yang sama sudah ada");
      return false;
    }
    setError("");
    return true;
  };

  const validToSaveEdit = () => {
    const text = normalized(editingText);
    if (!text) {
      showToast("Teks tidak boleh kosong");
      return false;
    }
    if (text.length > MAX_LEN) {
      showToast(`Maksimal ${MAX_LEN} karakter`);
      return false;
    }
    if (isDuplicate(text, tasks.find((t) => t.id === editingId)?.category, editingId)) {
      showToast("Duplikat pada kategori yang sama");
      return false;
    }
    return true;
  };

  // progress
  const progress = useMemo(() => {
    if (tasks.length === 0) return 0;
    const done = tasks.filter((t) => t.completed).length;
    return Math.round((done / tasks.length) * 100);
  }, [tasks]);

  // statistik kategori
  const categoryStats = useMemo(() => {
    const stats = {};
    CATEGORIES.forEach(
      (c) => (stats[c] = tasks.filter((t) => t.category === c).length)
    );
    return stats;
  }, [tasks]);

  // daftar ter-filter
  const visibleTasks = useMemo(() => {
    let list = [...tasks];

    // search (debounced update input -> state)
    const q = normalized(search).toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          t.text.toLowerCase().includes(q) ||
          (t.category || "").toLowerCase().includes(q)
      );
    }

    // filter status
    if (filter === "done") list = list.filter((t) => t.completed);
    if (filter === "todo") list = list.filter((t) => !t.completed);

    // sort
    list.sort((a, b) => {
      const primary = sort === "newest" ? b.createdAt - a.createdAt : a.createdAt - b.createdAt;
      if (primary !== 0) return primary;
      // secondary: alfabetis
      return a.text.localeCompare(b.text);
    });

    return list;
  }, [tasks, filter, sort, search]);

  // ----- ACTIONS -----
  const addTask = () => {
    if (!validToAdd()) return;

    const text = normalized(newTask);
    const createdAt = Date.now();
    const id = `${createdAt}-${Math.random().toString(36).slice(2, 7)}`;

    setTasks((prev) => [
      ...prev,
      {
        id,
        text,
        completed: false,
        category: newCategory,
        createdAt,
      },
    ]);
    setNewTask("");

    // quotes motivasi
    const msg = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    showToast(msg);
  };

  const softRemove = (idsToRemove, toastMsg) => {
    // set animasi keluar
    setRemovingIds((prev) => new Set([...prev, ...idsToRemove]));
    // setelah animasi, baru remove
    setTimeout(() => {
      setTasks((prev) => prev.filter((t) => !idsToRemove.includes(t.id)));
    }, 220); // selaras dengan transition 200ms
    showToast(toastMsg);
  };

  const deleteTask = (id) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    if (window.confirm(`Hapus tugas "${task.text}"?`)) {
      // simpan untuk undo
      const snapshot = task;
      softRemove([id], "Tugas dihapus ❌");
      showToast("Tugas dihapus ❌", "Undo", () => {
        setTasks((prev) => [...prev, snapshot]);
      });
    }
  };

  const clearCompleted = () => {
    const completedIds = tasks.filter((t) => t.completed).map((t) => t.id);
    if (completedIds.length === 0) return;
    if (window.confirm("Hapus semua tugas yang sudah selesai?")) {
      const snapshot = tasks;
      softRemove(completedIds, "Tugas selesai dihapus 🧹");
      showToast("Tugas selesai dihapus 🧹", "Undo", () => {
        setTasks(snapshot);
      });
    }
  };

  const toggleTask = (id) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  const startEdit = (task) => {
    setEditingId(task.id);
    setEditingText(task.text);
  };

  const saveEdit = (id) => {
    if (!validToSaveEdit()) return;
    const text = normalized(editingText);
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, text } : t)));
    setEditingId(null);
    setEditingText("");
    showToast("Tugas diperbarui ✏️");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingText("");
  };

  const clearAll = () => {
    if (tasks.length === 0) return;
    if (window.confirm("Yakin hapus semua tugas?")) {
      const snapshot = tasks;
      softRemove(tasks.map((t) => t.id), "Semua tugas dihapus 🗑️");
      showToast("Semua tugas dihapus 🗑️", "Undo", () => setTasks(snapshot));
    }
  };

  const exportTasks = () => {
    const data = JSON.stringify(tasks, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tasks.json";
    a.click();
    URL.revokeObjectURL(url);
    showToast("Data diekspor 💾");
  };

  const importTasks = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target.result);
        if (!Array.isArray(parsed)) throw new Error("Bukan array");

        const normalizedArr = parsed.map((t) => {
          const text = normalized(String(t.text ?? t.title ?? ""));
          if (!text) throw new Error("Item tanpa teks");

          const category =
            t.category && CATEGORIES.includes(t.category)
              ? t.category
              : CATEGORIES[0];

          const createdAt = Number(t.createdAt ?? Date.now());
          const completed = Boolean(t.completed ?? t.done ?? false);
          const id = String(
            t.id ?? `${createdAt}-${Math.random().toString(36).slice(2, 7)}`
          );
          return { id, text, category, createdAt, completed };
        });

        setTasks(normalizedArr);
        showToast("Data berhasil diimpor ✅");
      } catch (err) {
        console.error(err);
        alert("File tidak valid atau rusak. Pastikan format JSON array tugas yang benar.");
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  // ----- RENDER -----
  return (
    <div className={`App ${darkMode ? "dark" : ""}`}>
      <header className="header">
        <h1>✅ Productivity To-Do</h1>
        <button
          className="mode-btn"
          onClick={() => setDarkMode((v) => !v)}
          aria-label="Toggle theme"
          title={darkMode ? "Ubah ke Light mode" : "Ubah ke Dark mode"}
        >
          {darkMode ? "☀️ Light" : "🌙 Dark"}
        </button>
      </header>

      {/* Controls */}
      <div className="controls card" role="region" aria-label="Controls">
        <div className="row">
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 6 }}>
            <input
              className="text-input"
              type="text"
              placeholder="Tulis tugas..."
              value={newTask}
              maxLength={MAX_LEN + 10} // biar tetap bisa ketik, tapi akan di-trim & validasi
              onChange={(e) => {
                const v = e.target.value;
                setNewTask(v);
                // reset error real-time
                if (error) setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") addTask();
              }}
              aria-label="Tugas baru"
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.75 }}>
              <span>{error ? "⚠️ " + error : " "}</span>
              <span>{normalized(newTask).length}/{MAX_LEN}</span>
            </div>
          </div>

          <select
            className="select"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            aria-label="Kategori"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <button
            className="primary"
            onClick={addTask}
            disabled={!normalized(newTask)}
            title={!normalized(newTask) ? "Isi tugas dulu" : "Tambah tugas"}
          >
            Tambah
          </button>
        </div>

        <div className="row">
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="search text-input"
              type="text"
              placeholder="Cari tugas atau kategori…"
              value={search}
              onChange={(e) => {
                const v = e.target.value;
                // debounce input supaya tidak ngerender berat
                clearTimeout(searchDebounceRef.current);
                searchDebounceRef.current = setTimeout(() => setSearch(v), 120);
              }}
              aria-label="Pencarian"
            />
            {search && (
              <button className="subtle" onClick={() => setSearch("")} title="Bersihkan pencarian">
                Clear
              </button>
            )}
          </div>

          <div className="segmented" role="tablist" aria-label="Filter status">
            <button
              className={filter === "all" ? "active" : ""}
              onClick={() => setFilter("all")}
              role="tab"
              aria-selected={filter === "all"}
            >
              Semua
            </button>
            <button
              className={filter === "todo" ? "active" : ""}
              onClick={() => setFilter("todo")}
              role="tab"
              aria-selected={filter === "todo"}
            >
              Belum
            </button>
            <button
              className={filter === "done" ? "active" : ""}
              onClick={() => setFilter("done")}
              role="tab"
              aria-selected={filter === "done"}
            >
              Selesai
            </button>
          </div>

          <select
            className="select"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Urutkan"
          >
            <option value="newest">Terbaru</option>
            <option value="oldest">Terlama</option>
          </select>

          <button className="danger subtle" onClick={clearAll} title="Hapus semua tugas">
            Hapus Semua
          </button>
          <button className="subtle" onClick={clearCompleted} title="Hapus semua yang selesai">
            Hapus Selesai
          </button>
          <button className="subtle" onClick={exportTasks} title="Export JSON">
            Export
          </button>
          <input type="file" accept="application/json" onChange={importTasks} title="Import JSON" />
        </div>
      </div>

      {/* Progress */}
      <div className="progress card" role="region" aria-label="Progress">
        <div className="progress-labels">
          <span>
            Selesai: {tasks.filter((t) => t.completed).length} / {tasks.length}
          </span>
          <span>{progress}%</span>
        </div>
        <div className="bar">
          {/* animasi lebar via CSS transition di .fill */}
          <div className="fill" style={{ width: `${progress}%`, transition: "width .35s ease" }} />
        </div>
      </div>

      {/* Statistik Kategori */}
      <div className="card" role="region" aria-label="Statistik kategori">
        <h3 style={{ marginTop: 0 }}>Statistik Kategori</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              className={`tag tag-${c}`}
              onClick={() => {
                // klik chip = filter cepat via search kategori
                setSearch(c);
              }}
              title={`Cari kategori: ${c}`}
              style={{ cursor: "pointer", border: "none" }}
            >
              {c}: {categoryStats[c]}
            </button>
          ))}
        </div>
      </div>

      {/* Toast (dengan tombol aksi optional, mis. Undo) */}
      {toast && (
        <div className="toast" role="status" aria-live="polite" style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
          <span>{toast}</span>
          {toastActionRef.current && (
            <button
              className="subtle"
              style={{ borderColor: "transparent", padding: "6px 10px" }}
              onClick={() => {
                toastActionRef.current?.actionFn?.();
                setToast("");
                toastActionRef.current = null;
              }}
            >
              {toastActionRef.current.actionLabel}
            </button>
          )}
        </div>
      )}

      {/* List */}
      <ul className="list card" role="list">
        {visibleTasks.length === 0 && (
          <li className="empty">Belum ada tugas. Mulai dari satu hal kecil ✨</li>
        )}

        {visibleTasks.map((task) => {
          const isEditing = editingId === task.id;
          const isLeaving = removingIds.has(task.id);
          return (
            <li
              key={task.id}
              className={`item ${task.completed ? "completed" : ""}`}
              style={{
                opacity: isLeaving ? 0 : 1,
                transition: "opacity .2s ease",
              }}
            >
              <div className="left">
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => toggleTask(task.id)}
                  aria-label={`Tandai ${task.text} sebagai ${task.completed ? "belum selesai" : "selesai"}`}
                />

                {!isEditing ? (
                  <div className="text-block">
                    <div className="title">{task.text}</div>
                    <div className="meta">
                      <button
                        className={`tag tag-${task.category}`}
                        onClick={() => setSearch(task.category)}
                        title={`Cari kategori: ${task.category}`}
                        style={{ cursor: "pointer", border: "none" }}
                      >
                        {task.category}
                      </button>
                      <span className="time" title="Waktu dibuat">
                        🗓 {fmtDate(task.createdAt)} • 🕒 {fmtTime(task.createdAt)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="edit-row" onKeyDown={(e) => e.key === "Escape" && cancelEdit()}>
                    <input
                      className="text-input"
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveEdit(task.id)}
                      maxLength={MAX_LEN + 10}
                      autoFocus
                    />
                    <button className="primary" onClick={() => saveEdit(task.id)}>
                      Simpan
                    </button>
                    <button className="subtle" onClick={cancelEdit}>
                      Batal
                    </button>
                  </div>
                )}
              </div>

              {!isEditing && (
                <div className="actions" style={{ display: "flex", gap: 8 }}>
                  <button className="subtle" onClick={() => startEdit(task)} title="Edit tugas">
                    ✏️ Edit
                  </button>
                  <button className="danger" onClick={() => deleteTask(task.id)} title="Hapus tugas">
                    ❌ Hapus
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <footer className="foot">
        Dibuat untuk Capstone • React + localStorage • {new Date().getFullYear()}
      </footer>
    </div>
  );
}

export default App;
