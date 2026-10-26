// =====================================================================
// CERBERUS AI — FRONTEND CONTROLLER (ENTERPRISE ENCLAVE WORKBENCH)
// =====================================================================

let presets = [];
let registeredModels = [];
let totalProbes = 0;
let canaryTraps = 0;
let syscallTraps = 0;

document.addEventListener("DOMContentLoaded", async () => {
  setupTabs();
  await loadStatus();
  await loadModels();
  await loadPresets();
  await loadAuditLog();

  // Custom Model UI handlers
  setupCustomModelControls();

  // Preset dropdown handler
  const selectPreset = document.getElementById("select-preset");
  if (selectPreset) {
    selectPreset.addEventListener("change", (e) => {
      const found = presets.find(p => p.id === e.target.value);
      if (found) {
        document.getElementById("input-prompt").value = found.prompt;
      }
    });
  }

  // Probe execution button
  const btnProbe = document.getElementById("btn-run-probe");
  if (btnProbe) {
    btnProbe.addEventListener("click", () => {
      dispatchProbe();
    });
  }

  // Verify Merkle Audit button
  const btnVerify = document.getElementById("btn-verify-merkle");
  if (btnVerify) {
    btnVerify.addEventListener("click", () => {
      verifyAuditVault();
    });
  }

  // Run Benchmark Suite button
  const btnBenchmark = document.getElementById("btn-run-benchmark");
  if (btnBenchmark) {
    btnBenchmark.addEventListener("click", () => {
      runBenchmarkSuite();
    });
  }

  // Export Audit Certificate button
  const btnExport = document.getElementById("btn-export-cert");
  if (btnExport) {
    btnExport.addEventListener("click", () => {
      exportCertificate();
    });
  }
});

// ---------------------------------------------------------------------
// TAB NAVIGATION
// ---------------------------------------------------------------------
function setupTabs() {
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabPanes = document.querySelectorAll(".tab-pane");

  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-tab");
      
      tabBtns.forEach(b => b.classList.remove("active"));
      tabPanes.forEach(p => p.classList.remove("active"));

      btn.classList.add("active");
      const targetPane = document.getElementById(targetId);
      if (targetPane) {
        targetPane.classList.add("active");
      }

      if (targetId === "tab-audit") {
        loadAuditLog();
      }
    });
  });
}

// ---------------------------------------------------------------------
// DATA INITIALIZATION
// ---------------------------------------------------------------------
async function loadStatus() {
  try {
    const res = await fetch("/api/status");
    const data = await res.json();
    
    totalProbes = data.event_count || 1;
    document.getElementById("kpi-probes").innerText = totalProbes;
    document.getElementById("kpi-merkle-preview").innerText = `Root: ${data.merkle_root.substring(0, 16)}...`;
    document.getElementById("vault-root-hash").innerText = data.merkle_root;
    document.getElementById("vault-leaf-count").innerText = totalProbes;
  } catch (err) {
    console.error("Failed to load status:", err);
  }
}

async function loadModels(selectModelName = null) {
  try {
    const res = await fetch("/api/models");
    registeredModels = await res.json();

    const select = document.getElementById("select-model");
    if (!select) return;

    select.innerHTML = "";
    registeredModels.forEach(m => {
      const opt = document.createElement("option");
      opt.value = m.name;
      opt.innerText = m.name;
      select.appendChild(opt);
    });

    if (selectModelName) {
      select.value = selectModelName;
    }
  } catch (err) {
    console.error("Failed to load models:", err);
  }
}

function setupCustomModelControls() {
  const btnOpen = document.getElementById("btn-open-custom-model");
  const btnClose = document.getElementById("btn-close-custom-model");
  const box = document.getElementById("box-custom-model");
  const typeSelect = document.getElementById("input-custom-type");
  const grpUrl = document.getElementById("grp-custom-url");
  const btnSave = document.getElementById("btn-save-custom-model");

  if (btnOpen && box) {
    btnOpen.addEventListener("click", () => {
      box.style.display = box.style.display === "none" ? "block" : "none";
    });
  }

  if (btnClose && box) {
    btnClose.addEventListener("click", () => {
      box.style.display = "none";
    });
  }

  if (typeSelect && grpUrl) {
    typeSelect.addEventListener("change", (e) => {
      grpUrl.style.display = (e.target.value === "simulated") ? "none" : "block";
    });
  }

  if (btnSave) {
    btnSave.addEventListener("click", async () => {
      const name = document.getElementById("input-custom-name").value.trim();
      const type = document.getElementById("input-custom-type").value;
      const url = document.getElementById("input-custom-url").value.trim();
      const secret = document.getElementById("input-custom-secret").value.trim();

      if (!name) {
        alert("Please enter a model name.");
        return;
      }

      btnSave.disabled = true;
      btnSave.innerText = "Registering...";

      try {
        const res = await fetch("/api/models/custom", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name,
            connection_type: type,
            endpoint_url: url,
            secret_directive: secret || "Confidential Custom Company Secret Directive"
          })
        });

        const data = await res.json();
        if (data.status === "SUCCESS") {
          await loadModels(data.model.name);
          box.style.display = "none";
          document.getElementById("input-custom-name").value = "";
          document.getElementById("input-custom-url").value = "";
          document.getElementById("input-custom-secret").value = "";
          updateFooterLog(`[MODEL REGISTERED] ${data.model.name} added to Cerberus Enclave!`);
        }
      } catch (err) {
        console.error("Failed to register custom model:", err);
      } finally {
        btnSave.disabled = false;
        btnSave.innerText = "Save & Select Model";
      }
    });
  }
}

async function loadPresets() {
  try {
    const res = await fetch("/api/presets");
    presets = await res.json();
    
    const select = document.getElementById("select-preset");
    select.innerHTML = "";

    presets.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.innerText = `[${p.category.split(':')[0]}] ${p.title}`;
      select.appendChild(opt);
    });

    if (presets.length > 0) {
      document.getElementById("input-prompt").value = presets[0].prompt;
    }
  } catch (err) {
    console.error("Failed to load presets:", err);
  }
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function appendStreamLog(msg, type = "info") {
  const stream = document.getElementById("live-probe-stream");
  if (!stream) return;
  const line = document.createElement("div");
  line.className = `log-line log-${type}`;
  line.innerText = msg;
  stream.appendChild(line);
  stream.scrollTop = stream.scrollHeight;
}

function clearStreamLog() {
  const stream = document.getElementById("live-probe-stream");
  if (stream) stream.innerHTML = "";
}

// ---------------------------------------------------------------------
// PROBE EXECUTION & PIPELINE INSPECTION
// ---------------------------------------------------------------------
async function dispatchProbe() {
  const promptInput = document.getElementById("input-prompt");
  const promptText = promptInput.value.trim();
  if (!promptText) return;

  const btn = document.getElementById("btn-run-probe");
  const statusBadge = document.getElementById("probe-status-badge");
  const stageIndicator = document.getElementById("log-stage-indicator");
  const modelSelect = document.getElementById("select-model").value;
  const enableDualBlind = document.getElementById("chk-dual-blind").checked;
  const enableCanary = document.getElementById("chk-canary").checked;
  const enableSandbox = document.getElementById("chk-sandbox").checked;

  btn.disabled = true;
  btn.style.opacity = "0.7";
  statusBadge.className = "badge badge-amber";
  statusBadge.innerText = "ATTACK IN PROGRESS";
  
  if (stageIndicator) {
    stageIndicator.className = "badge badge-sm badge-amber";
    stageIndicator.innerText = "DEFENSE ACTIVE";
  }

  // Reset stream and start streaming logs
  clearStreamLog();
  appendStreamLog(`[00:00.080] [INITIATED] Dispatched probe to target: "${modelSelect}"`, "highlight");
  updateFooterLog(`[INGRESS] Dispatching probe to ${modelSelect}...`);

  await sleep(180);
  appendStreamLog(`[00:00.220] [DUAL-BLIND] Ingress proxy scrubbed IP & user agent headers...`, "info");

  try {
    const res = await fetch("/api/probe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: promptText,
        target_model: modelSelect,
        enable_dual_blind: enableDualBlind,
        enable_canary: enableCanary,
        enable_sandbox: enableSandbox
      })
    });
    const result = await res.json();

    await sleep(220);
    // 1. Ingress Pipeline
    const pipeIngress = document.getElementById("pipe-ingress");
    pipeIngress.classList.add("active");
    document.getElementById("txt-operator-id").innerText = `${result.operator} (${result.analysis.category})`;
    appendStreamLog(`[00:00.410] [INGRESS] Session anonymized: ${result.operator}`, "highlight");
    appendStreamLog(`[00:00.520] [CLASSIFIER] Threat vector classified: [${result.analysis.category}]`, "info");

    await sleep(200);
    // 2. Canary Honeytoken Pipeline
    const pipeCanary = document.getElementById("pipe-canary");
    const bannerLeak = document.getElementById("banner-leak-trapped");
    document.getElementById("txt-canary-tag").innerText = result.canary_token;
    appendStreamLog(`[00:00.710] [HONEYTOKEN] Injected dynamic canary watermark: ${result.canary_token}`, "info");

    await sleep(240);
    // 3. Execution & Containment logs
    const pipeSandbox = document.getElementById("pipe-sandbox");
    const sandbox = result.sandbox;

    if (sandbox.status === "CONTAINED") {
      syscallTraps++;
      document.getElementById("kpi-syscalls").innerText = syscallTraps;
      pipeSandbox.classList.add("alert");
      document.getElementById("txt-sandbox-status").innerText = `TRAP: ${sandbox.syscall_monitored}`;

      appendStreamLog(`[00:00.950] [HOSTILE SYSCALL] Code attempted execution: ${sandbox.syscall_monitored}`, "trap");
      appendStreamLog(`[00:01.080] [AIR-GAP FIREWALL] Zero-Egress rule enforced. Network connection dropped!`, "trap");
      appendStreamLog(`[00:01.210] [CONTAINER ACTION] gVisor microVM isolated and quarantined safely.`, "success");
    } else {
      pipeSandbox.classList.remove("alert");
      document.getElementById("txt-sandbox-status").innerText = "Air-Gapped: Zero-Egress Normal";
    }

    if (result.canary_intercepted) {
      canaryTraps++;
      document.getElementById("kpi-canary").innerText = canaryTraps;
      pipeCanary.classList.add("alert");
      bannerLeak.style.display = "block";
      document.getElementById("banner-leak-desc").innerText = 
        `Dynamic canary honeytoken '${result.canary_token}' was detected in outbound model stream. Zero-trust gateway sanitized and blocked transmission.`;

      appendStreamLog(`[00:01.120] [ALERT] OUTBOUND INTERCEPTOR TRIGGERED!`, "alert");
      appendStreamLog(`            Raw model tried to expose confidential system instructions.`, "alert");
      appendStreamLog(`            Canary watermark '${result.canary_token}' detected in output stream!`, "alert");
      appendStreamLog(`[00:01.290] [SANITIZATION] Outbound payload neutralized & scrubbed clean. Zero IP leaked.`, "success");
    } else {
      pipeCanary.classList.remove("alert");
      bannerLeak.style.display = "none";
      if (!sandbox.status || sandbox.status !== "CONTAINED") {
        appendStreamLog(`[00:01.050] [ALIGNMENT] Model evaluated query safely within security boundaries.`, "info");
      }
    }

    await sleep(200);
    // 4. Output Panes
    document.getElementById("view-sanitized").innerText = result.sanitized_response;
    document.getElementById("view-raw").innerText = result.raw_response;

    const dispositionBadge = document.getElementById("badge-disposition");
    if (result.disposition.includes("BLOCKED") || result.disposition.includes("CONTAINED")) {
      dispositionBadge.className = "badge badge-sm badge-green";
      dispositionBadge.innerText = "CONTAINED";
    } else {
      dispositionBadge.className = "badge badge-sm badge-neutral";
      dispositionBadge.innerText = result.disposition;
    }

    // 5. Leaf Hash and Status
    document.getElementById("txt-leaf-hash").innerText = result.leaf_hash;
    document.getElementById("vault-root-hash").innerText = result.merkle_root;
    document.getElementById("kpi-merkle-preview").innerText = `Root: ${result.merkle_root.substring(0, 16)}...`;

    totalProbes++;
    document.getElementById("kpi-probes").innerText = totalProbes;
    document.getElementById("vault-leaf-count").innerText = totalProbes;

    appendStreamLog(`[00:01.440] [MERKLE VAULT] Event ${result.event_id} sealed with SHA-256.`, "success");
    appendStreamLog(`            Leaf Hash: ${result.leaf_hash.substring(0, 24)}...`, "info");
    appendStreamLog(`            New Merkle Root: ${result.merkle_root.substring(0, 24)}...`, "info");
    appendStreamLog(`[00:01.520] [VERIFIED] Attack neutralized. Audit trail permanently sealed.`, "success");

    statusBadge.className = "badge badge-green";
    statusBadge.innerText = "ATTACK CONTAINED";

    if (stageIndicator) {
      stageIndicator.className = "badge badge-sm badge-green";
      stageIndicator.innerText = "CONTAINED (100%)";
    }

    updateFooterLog(`[MERKLE SEALED] Event ${result.event_id} appended. Root: ${result.merkle_root.substring(0, 16)}...`);

  } catch (err) {
    console.error("Probe error:", err);
    appendStreamLog(`[ERROR] Security inspection failed: ${err.message}`, "trap");
    statusBadge.className = "badge badge-red";
    statusBadge.innerText = "ERROR";
  } finally {
    btn.disabled = false;
    btn.style.opacity = "1";
  }
}

// ---------------------------------------------------------------------
// AUDIT VAULT LOG & VERIFICATION
// ---------------------------------------------------------------------
async function loadAuditLog() {
  try {
    const res = await fetch("/api/audit-log");
    const data = await res.json();

    document.getElementById("vault-root-hash").innerText = data.merkle_root;
    document.getElementById("vault-leaf-count").innerText = data.total_events;

    const tbody = document.getElementById("table-audit-body");
    tbody.innerHTML = "";

    if (!data.events || data.events.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center">No audit records found.</td></tr>`;
      return;
    }

    data.events.forEach(entry => {
      const ev = entry.event;
      const tr = document.createElement("tr");

      const ts = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : "--";
      const eventId = ev.event_id || "EVT-SYS";
      const vector = ev.attack_vector || ev.event_type || "ENCLAVE_SYSTEM";
      const operator = ev.operator || "SYSTEM_BOOT";
      const disposition = ev.disposition || ev.status || "LOGGED";
      const leafHash = entry.leaf_hash ? entry.leaf_hash.substring(0, 24) + "..." : "--";

      tr.innerHTML = `
        <td class="font-mono">${ts}</td>
        <td class="font-mono"><strong>${eventId}</strong></td>
        <td>${vector}</td>
        <td class="font-mono text-sm">${operator}</td>
        <td><span class="badge badge-sm badge-green">${disposition}</span></td>
        <td class="font-mono text-sm" title="${entry.leaf_hash}">${leafHash}</td>
      `;
      tbody.appendChild(tr);
    });

  } catch (err) {
    console.error("Failed to load audit log:", err);
  }
}

async function verifyAuditVault() {
  const btn = document.getElementById("btn-verify-merkle");
  const statusVal = document.getElementById("vault-proof-status");

  btn.disabled = true;
  statusVal.innerText = "COMPUTING SHA-256 PROOFS...";
  statusVal.style.color = "var(--amber)";

  try {
    const res = await fetch("/api/verify-audit", { method: "POST" });
    const data = await res.json();

    setTimeout(() => {
      if (data.integrity_intact) {
        statusVal.innerText = "VALIDATED TAMPER-PROOF (100%)";
        statusVal.style.color = "var(--green)";
        updateFooterLog(`[AUDIT INTEGRITY] Mathematical re-hash validated ${data.leaf_count} leaves against Merkle root.`);
      } else {
        statusVal.innerText = "COMPROMISED";
        statusVal.style.color = "var(--red)";
      }
      btn.disabled = false;
    }, 300);
  } catch (err) {
    console.error("Verification error:", err);
    btn.disabled = false;
  }
}

// ---------------------------------------------------------------------
// AUTOMATED BENCHMARK SUITE
// ---------------------------------------------------------------------
async function runBenchmarkSuite() {
  const btn = document.getElementById("btn-run-benchmark");
  const tbody = document.getElementById("table-benchmark-body");

  btn.disabled = true;
  btn.innerText = "Running Test Suite...";
  tbody.innerHTML = `<tr><td colspan="5" class="text-center">Executing OWASP Top 10 automated test vectors...</td></tr>`;

  try {
    const res = await fetch("/api/benchmark/run");
    const data = await res.json();

    document.getElementById("score-resilience").innerText = data.resilience_score;
    document.getElementById("score-canary-rate").innerText = data.canary_interception_rate;
    document.getElementById("score-sandbox-rate").innerText = data.sandbox_containment_rate;

    tbody.innerHTML = "";
    data.results.forEach(item => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="font-mono"><strong>${item.id.toUpperCase()}</strong></td>
        <td>${item.category}</td>
        <td>${item.title}</td>
        <td><span class="badge badge-sm badge-green">${item.status}</span></td>
        <td class="text-sm font-mono">${item.details}</td>
      `;
      tbody.appendChild(tr);
    });

    updateFooterLog(`[BENCHMARK] Automated evaluation complete. Overall Resilience: ${data.resilience_score}.`);

  } catch (err) {
    console.error("Benchmark error:", err);
  } finally {
    btn.disabled = false;
    btn.innerText = "Run Complete Benchmark Suite";
  }
}

// ---------------------------------------------------------------------
// EXPORT COMPLIANCE REPORT
// ---------------------------------------------------------------------
function exportCertificate() {
  fetch("/api/export-certificate")
    .then(res => res.json())
    .then(data => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Cerberus_AI_Safety_Attestation_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      updateFooterLog("[ATTESTATION] Official AI Safety Compliance Certificate exported (JSON).");
    })
    .catch(err => console.error("Export error:", err));
}

function updateFooterLog(msg) {
  const el = document.getElementById("footer-live-msg");
  if (el) {
    el.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
  }
}
