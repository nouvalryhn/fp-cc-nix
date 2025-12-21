<script lang="ts">
  import { onMount } from "svelte";
  import { auth } from "../stores/auth";
  import { goto } from "$app/navigation";

  interface App {
    id: string;
    name: string;
    status: string;
    domain: string;
  }

  interface Metrics {
    cpu: { percent: string };
    memory: { usage: string; limit: string; percent: string };
    network: { rxBytes: number; txBytes: number };
  }

  let apps: App[] = [];
  let metrics: Record<string, Metrics> = {};
  let loading = true;
  let error: string | null = null;
  let token: string | null = null;
  let logs: string[] = [];
  let showLogs = false;

  auth.subscribe((value) => {
    token = value.token;
    if (!value.isAuthenticated && !loading) {
      // redirect handled in onMount or separate page guard
    }
  });

  async function fetchApps() {
    if (!token) return;
    try {
      const res = await fetch("/apps", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.status === 401) {
        goto("/login");
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch apps");
      apps = await res.json();

      await fetchAllMetrics();
      error = null;
      console.log("Fetched apps:", apps);
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function fetchAllMetrics() {
    for (const app of apps) {
      if (app.status === "running") {
        try {
          const res = await fetch(`/apps/${app.id}/metrics`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            metrics[app.id] = await res.json();
          }
        } catch (e) {
          console.error(`Failed to fetch metrics for ${app.name}`);
        }
      }
    }
    metrics = { ...metrics };
  }

  async function changeContainerState(app: any) {
    if (!token) return;

    const isRunning = app.status === "running";
    if (
      !confirm(
        `Are you sure to ${isRunning ? "stop" : "start"} this container?`,
      )
    )
      return;

    try {
      const res = await fetch(`/apps/${app.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        method: "PATCH",
      });
      if (res.status === 401) {
        goto("/login");
        return;
      }
      fetchApps();
    } catch (e) {
      alert("Failed to change container state");
    }
  }

  onMount(() => {
    const unsub = auth.subscribe((val) => {
      if (!val.isAuthenticated) {
        goto("/login");
      } else {
        token = val.token;
        fetchApps();
      }
    });

    const interval = setInterval(() => {
      if (token) fetchApps();
    }, 5000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  });

  async function redeployApp(app: any) {
    if (!token) return;
    if (
      !confirm(
        `Are you sure you want to redeploy ${app.name}? This will rebuild the image from the source.`,
      )
    )
      return;

    try {
      logs = [`Initializing redeploy for ${app.name}...`];
      showLogs = true;

      const res = await fetch(`/apps/${app.id}/redeploy`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Redeploy failed");
      }

      const buildId = data.buildId;
      logs = [...logs, `Build ID: ${buildId}`, "Waiting for logs..."];

      const evtSource = new EventSource(`/events/build/${buildId}`);

      evtSource.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        if (payload.log === "DONE") {
          evtSource.close();
          logs = [...logs, "Redeployment successful! Refreshing..."];
          fetchApps();
          setTimeout(() => {
            showLogs = false;
          }, 2000);
        } else if (payload.log.startsWith("ERROR:")) {
          evtSource.close();
          logs = [...logs, payload.log];
        } else {
          logs = [...logs, payload.log];
          // Auto-scroll logic could be added here if we had a bind:this ref
        }
      };

      evtSource.onerror = (err) => {
        console.error("EventSource failed:", err);
        evtSource.close();
        logs = [...logs, "Connection closed."];
      };
    } catch (e: any) {
      logs = [...logs, `Error: ${e.message}`];
    }
  }

  async function deleteApp(app: any) {
    if (!token) return;
    if (
      !confirm(
        `DANGER: Are you sure you want to DELETE ${app.name}? This cannot be undone.`,
      )
    )
      return;

    try {
      const res = await fetch(`/apps/${app.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Delete failed");
      }

      alert(`Application ${app.name} deleted successfully.`);
      fetchApps();
    } catch (e: any) {
      alert(`Delete failed: ${e.message}`);
    }
  }

  function closeLogs() {
    showLogs = false;
    logs = [];
  }

  // Auto-scroll
  import { afterUpdate } from "svelte";
  let logsContainer: HTMLElement;
  afterUpdate(() => {
    if (logsContainer && showLogs) {
      logsContainer.scrollTop = logsContainer.scrollHeight;
    }
  });

  function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }
</script>

<div class="dashboard container animate-fade-in">
  <header class="header">
    <div>
      <h1 class="page-title">Applications</h1>
      <p class="text-muted">Manage your deployed services</p>
    </div>
    {#if apps.length > 0}
      <a href="/deploy" class="btn btn-primary shadow-glow">
        <span>+</span> New Deployment
      </a>
    {/if}
  </header>

  {#if loading && apps.length === 0}
    <div class="loading-state">
      <div class="loader"></div>
      <p>Loading your apps...</p>
    </div>
  {:else if error}
    <div class="error-banner">
      <span class="icon">⚠️</span>
      {error}
    </div>
  {:else if apps.length === 0}
    <div class="empty-state card">
      <div class="empty-content">
        <span class="empty-icon">🚀</span>
        <h3>No applications yet</h3>
        <p class="text-muted">Deploy your first application to get started.</p>
        <a href="/deploy" class="btn btn-primary mt-4">Deploy Now</a>
      </div>
    </div>
  {:else}
    <div class="app-grid">
      {#each apps as app}
        <div class="app-card card">
          <div class="card-header">
            <div class="app-info">
              <h3 class="app-name">{app.name}</h3>
              <a
                href={`http://${app.domain}`}
                target="_blank"
                class="app-domain"
              >
                {app.domain} ↗
              </a>
            </div>
            <div class="status-badge" class:running={app.status === "running"}>
              <span class="status-dot"></span>
              {app.status}
            </div>
          </div>

          {#if metrics[app.id] && app.status === "running"}
            <div class="metrics-grid">
              <div class="metric-item">
                <span class="metric-label">CPU</span>
                <span class="metric-value">{metrics[app.id].cpu.percent}%</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">RAM</span>
                <span class="metric-value"
                  >{metrics[app.id].memory.percent}%</span
                >
                <span class="metric-sub">{metrics[app.id].memory.usage}MB</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">NET ↓</span>
                <span class="metric-value"
                  >{formatBytes(metrics[app.id].network.rxBytes)}</span
                >
              </div>
              <div class="metric-item">
                <span class="metric-label">NET ↑</span>
                <span class="metric-value"
                  >{formatBytes(metrics[app.id].network.txBytes)}</span
                >
              </div>
            </div>
          {:else}
            <div class="metrics-placeholder">Connect to view metrics</div>
          {/if}

          <div class="card-actions">
            <button
              class="btn btn-ghost btn-sm"
              on:click={() => changeContainerState(app)}
              title={app.status === "running" ? "Stop App" : "Start App"}
            >
              <span class="icon">{app.status === "running" ? "⏹" : "▶"}</span>
              {app.status === "running" ? "Stop" : "Start"}
            </button>

            <button
              class="btn btn-ghost btn-sm"
              on:click={() => redeployApp(app)}
              title="Redeploy App"
            >
              <span class="icon">↺</span> Redeploy
            </button>

            <div class="spacer"></div>

            <button
              class="btn btn-danger btn-sm"
              on:click={() => deleteApp(app)}
              title="Delete App"
            >
              <span class="icon">🗑</span>
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if showLogs}
  <div class="modal-backdrop" on:click={closeLogs} aria-hidden="true">
    <div
      class="modal-content animate-fade-in"
      on:click|stopPropagation
      aria-hidden="true"
    >
      <div class="modal-header">
        <h3>Deployment Logs</h3>
        <button class="btn btn-ghost btn-sm" on:click={closeLogs}>✕</button>
      </div>
      <div class="logs-container" bind:this={logsContainer}>
        {#each logs as log}
          <div class="log-line">{log}</div>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .dashboard {
    padding-bottom: 4rem;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: 2rem;
  }

  .page-title {
    font-size: 2rem;
    margin-bottom: 0.25rem;
    background: linear-gradient(135deg, #fff 0%, #94a3b8 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .app-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 1.5rem;
  }

  .app-card {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    background: linear-gradient(
      180deg,
      var(--bg-card) 0%,
      rgba(30, 41, 59, 0.5) 100%
    );
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .app-name {
    font-size: 1.25rem;
    margin-bottom: 0.25rem;
  }

  .app-domain {
    font-size: 0.875rem;
    color: var(--primary);
    text-decoration: none;
  }
  .app-domain:hover {
    text-decoration: underline;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.75rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    background: rgba(148, 163, 184, 0.1);
    color: var(--text-muted);
    border: 1px solid rgba(148, 163, 184, 0.2);
  }

  .status-badge.running {
    background: rgba(16, 185, 129, 0.1);
    color: var(--success);
    border-color: rgba(16, 185, 129, 0.2);
  }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    padding: 1rem;
    background: rgba(0, 0, 0, 0.2);
    border-radius: var(--radius-sm);
  }

  .metrics-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    background: rgba(0, 0, 0, 0.2);
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    font-size: 0.875rem;
  }

  .metric-item {
    display: flex;
    flex-direction: column;
  }

  .metric-label {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    margin-bottom: 0.25rem;
  }

  .metric-value {
    font-family: monospace;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .metric-sub {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .card-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: auto;
    border-top: 1px solid var(--border);
    padding-top: 1rem;
  }

  .spacer {
    flex: 1;
  }

  .btn-sm {
    padding: 0.4rem 0.75rem;
    font-size: 0.875rem;
  }

  /* Modal */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal-content {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    width: 90%;
    max-width: 800px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-lg);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--border);
  }

  .logs-container {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
    background: #000;
    color: #0f0;
    font-family: "JetBrains Mono", monospace;
    font-size: 0.85rem;
  }

  .log-line {
    padding: 2px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
  }

  .empty-icon {
    font-size: 3rem;
    display: block;
    margin-bottom: 1rem;
  }

  .mt-4 {
    margin-top: 1rem;
  }

  .shadow-glow {
    box-shadow: 0 0 15px rgba(99, 102, 241, 0.3);
  }
</style>
