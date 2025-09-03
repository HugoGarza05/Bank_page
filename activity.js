/* activity.js — LITE: Keep your layout, add inline Add/Edit/Delete.
   - Loads CSV from <body data-csv="...">
   - Persists edits to localStorage: key txn:<account>
   - Inline editor (no modal) shown by #inlineEditor
   - Rebuilds trend chart if #trendChart exists
*/

(function () {
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

    // Page refs (minimal assumptions)
    const account = (document.body.dataset.account || "credit").toLowerCase();
    const csvPathAttr = document.body.dataset.csv || "";
    const storageKey = `txn:${account}`;

    const table = $("#activityTable");
    const tbody = $("#activityTable tbody");
    const trendCanvas = $("#trendChart");
    const balanceEl = $("#accountBalance");

    // Optional toolbar buttons you may already have
    const importBtn = $("#importBtn");
    const fileInput = $("#csvFile");
    const exportBtn = $("#exportBtn");
    const resetBtn = $("#resetBtn");

    // Inline editor
    const addBtn = $("#addTxnBtn");
    const editor = $("#inlineEditor");
    const eIndex = $("#eIndex");
    const eDate = $("#eDate");
    const eStatus = $("#eStatus");
    const eDesc = $("#eDesc");
    const eAmount = $("#eAmount");
    const cancelEditBtn = $("#cancelEditBtn");

    // Data
    let rows = [];
    let chart = null;

    // Init
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }

    function init() {
      wireUI();

      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          rows = JSON.parse(saved);
          render();
        } catch {
          rows = [];
          loadCSV();
        }
      } else {
        loadCSV();
      }
    }

    function wireUI() {
      // Add button shows empty editor
      addBtn && addBtn.addEventListener("click", () => openEditorForAdd());

      // Inline editor submit/cancel
      editor && editor.addEventListener("submit", onEditorSubmit);
      cancelEditBtn && cancelEditBtn.addEventListener("click", closeEditor);

      // Row edit/delete (event delegation)
      tbody.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-action]");
        if (!btn) return;
        const idx = Number(btn.dataset.index);
        if (btn.dataset.action === "edit") return openEditorForEdit(idx);
        if (btn.dataset.action === "delete") return deleteAt(idx);
      });

      // Optional: import/export/reset if you already had them
      importBtn && importBtn.addEventListener("click", () => fileInput && fileInput.click());
      fileInput && fileInput.addEventListener("change", onImportFile);
      exportBtn && exportBtn.addEventListener("click", downloadCSV);
      resetBtn && resetBtn.addEventListener("click", resetToOriginal);
    }

    async function loadCSV() {
      if (!csvPathAttr) {
        rows = [];
        render();
        return;
      }
      try {
        const path = csvPathAttr.startsWith("./") || csvPathAttr.startsWith("/") ? csvPathAttr : `./${csvPathAttr}`;
        const res = await fetch(path, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        rows = parseCSV(text);
        persist();
        render();
      } catch (err) {
        console.error("[activity.js] CSV load failed:", err);
        rows = [];
        render();
      }
    }

    function onImportFile(e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          rows = parseCSV(String(reader.result || ""));
          sortRows();
          persist();
          render();
        } catch (err) {
          console.error("[activity.js] Import parse error:", err);
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    }

    // ---- Inline editor helpers ----
    function openEditorForAdd() {
      eIndex.value = "-1";
      eDate.value = new Date().toISOString().slice(0, 10);
      eStatus.value = "Posted";
      eDesc.value = "";
      eAmount.value = "";
      editor.style.display = "flex";
      eDesc.focus();
    }

    function openEditorForEdit(index) {
      const r = rows[index];
      if (!r) return;
      eIndex.value = String(index);
      eDate.value = r.date || "";
      eStatus.value = r.status || "Posted";
      eDesc.value = r.description || "";
      eAmount.value = String(r.amount || 0);
      editor.style.display = "flex";
      eDesc.focus();
    }

    function closeEditor() {
      editor.style.display = "none";
      eIndex.value = "-1";
      editor.reset && editor.reset(); // harmless if not a real <form>
    }

    function onEditorSubmit(ev) {
      ev.preventDefault();
      const idx = Number(eIndex.value || "-1");
      const rec = {
        date: eDate.value.trim(),
        status: eStatus.value || "Posted",
        description: eDesc.value.trim(),
        amount: Number(eAmount.value || 0),
      };
      if (!rec.date) return alert("Please enter a date.");
      if (!rec.description) return alert("Please enter a description.");
      if (isNaN(rec.amount)) return alert("Amount must be a number.");

      if (idx >= 0 && rows[idx]) rows[idx] = rec;
      else rows.push(rec);

      sortRows();
      persist();
      render();
      closeEditor();
    }

    function deleteAt(index) {
      if (!confirm("Delete this transaction?")) return;
      rows.splice(index, 1);
      sortRows();
      persist();
      render();
    }

    // ---- Render ----
    function render() {
      // table
      tbody.innerHTML = "";
      if (!rows.length) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 5;
        td.textContent = "No transactions.";
        td.style.color = "#5a6d89";
        td.style.padding = "16px";
        tr.appendChild(td);
        tbody.appendChild(tr);
      } else {
        rows.forEach((r, i) => {
          const tr = document.createElement("tr");

          const tdDate = document.createElement("td");
          tdDate.textContent = r.date;

          const tdDesc = document.createElement("td");
          tdDesc.textContent = r.description || "";

          const tdStatus = document.createElement("td");
          tdStatus.textContent = r.status || "Posted";

          const tdAmt = document.createElement("td");
          tdAmt.textContent = fmtUSD(r.amount);
          tdAmt.style.textAlign = "right";
          if (r.amount > 0) tdAmt.classList.add("green");

          const tdAct = document.createElement("td");
          tdAct.className = "actions";
          tdAct.innerHTML = `
            <button class="btn ghost" data-action="edit" data-index="${i}">Edit</button>
            <button class="btn ghost danger" data-action="delete" data-index="${i}">Delete</button>
          `;

          tr.append(tdDate, tdDesc, tdStatus, tdAmt, tdAct);
          tbody.appendChild(tr);
        });
      }

      // trend
      buildTrendChart(rows);

      // account balance display
      if (balanceEl) {
        const total = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
        balanceEl.textContent = fmtUSD(total);
      }
    }

    // ---- CSV helpers ----
    function parseCSV(text) {
      const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim().length);
      if (!lines.length) return [];
      const split = (line) =>
        line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((s) => s.replace(/^"|"$/g, "").trim());
      const header = split(lines[0]);

      const idx = {
        date: findIndex(header, /date/i),
        desc: findIndex(header, /(description|merchant|payee|narrative)/i),
        status: findIndex(header, /(status|state)/i),
        amount: findIndex(header, /(amount|charge|debit|credit)/i),
      };

      const out = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = split(lines[i]);
        if (!cols.length) continue;

        const amtRaw = idx.amount >= 0 ? cols[idx.amount] : "0";
        const amt = Number(String(amtRaw).replace(/[$,]/g, "")) || 0;

        const d = new Date(idx.date >= 0 ? cols[idx.date] : "");
        const dateISO = isNaN(d.getTime())
          ? (idx.date >= 0 ? cols[idx.date] : "")
          : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

        out.push({
          date: dateISO,
          description: idx.desc >= 0 ? cols[idx.desc] : "",
          status: idx.status >= 0 ? cols[idx.status] : "Posted",
          amount: amt,
        });
      }
      out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)); // newest first
      return out;
    }

    function toCSV(arr) {
      const header = ["Date", "Description", "Status", "Amount"];
      const body = arr.map((r) => {
        const esc = (s) => (/[",\n]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : String(s));
        return [
          esc(r.date || ""),
          esc(r.description || ""),
          esc(r.status || "Posted"),
          esc((Number(r.amount) || 0).toFixed(2)),
        ].join(",");
      });
      return [header.join(","), ...body].join("\n");
    }

    function downloadCSV() {
      const csv = toCSV(rows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${account}-activity.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    function resetToOriginal() {
      if (!confirm("Reset your changes and reload the original CSV?")) return;
      localStorage.removeItem(storageKey);
      rows = [];
      loadCSV();
    }

    function findIndex(arr, regex) {
      const i = arr.findIndex((h) => regex.test(h || ""));
      return i < 0 ? -1 : i;
    }

    function sortRows() {
      rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    }

    function persist() {
      localStorage.setItem(storageKey, JSON.stringify(rows));
    }

    // ---- Chart ----
    function buildTrendChart(dataRows) {
      if (!trendCanvas || typeof Chart === "undefined") return;
      if (chart) { chart.destroy(); chart = null; }

      const now = new Date();
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      const map = new Map();
      dataRows.forEach((r) => {
        if (!r.date || !String(r.date).startsWith(monthKey)) return;
        const out = r.amount < 0 ? Math.abs(r.amount) : 0; // spend only
        if (!out) return;
        map.set(r.date, (map.get(r.date) || 0) + out);
      });

      const labels = Array.from(map.keys()).sort();
      const series = labels.map((d) => Number((map.get(d) || 0).toFixed(2)));

      const ctx = trendCanvas.getContext("2d");
      chart = new Chart(ctx, {
        type: "line",
        data: {
          labels: labels.length ? labels : [monthKey + "-01"],
          datasets: [{
            data: series.length ? series : [0],
            borderColor: "rgba(13,33,62,0.9)",
            backgroundColor: "rgba(13,33,62,0.06)",
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.35,
            fill: { target: "origin", above: "rgba(13,33,62,0.06)" },
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => " " + fmtUSD(c.parsed.y) } } },
          interaction: { intersect: false, mode: "index" },
          scales: {
            x: { grid: { display: false } },
            y: { grid: { color: "rgba(13,33,62,0.08)" }, ticks: { callback: (v) => "$" + v } },
          },
        },
      });
    }

    function fmtUSD(n) {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n) || 0);
    }
  })();
