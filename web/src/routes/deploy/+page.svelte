<script lang="ts">
  import { onMount } from "svelte";
  import { auth } from "../../stores/auth";
  import { goto } from "$app/navigation";

  let repoUrl = "";
  let name = "";
  let loading = false;
  let error: string | null = null;
  let logs: string[] = [];
  let token: string | null = null;
  let restartPolicy = "no";
  let maxRetries: number | null;

  let envVars: Array<{ key: string; value: string }> = [{ key: "", value: "" }];

  onMount(() => {
    const unsub = auth.subscribe((val) => {
      if (!val.isAuthenticated) {
        goto("/login");
      } else {
        token = val.token;
      }
    });
    return unsub;
  });

  function addEnvVar() {
    envVars = [...envVars, { key: "", value: "" }];
  }

  function removeEnvVar(index: number) {
    envVars = envVars.filter((_, i) => i !== index);
  }

  import { afterUpdate } from "svelte";

  let logsElement: HTMLElement;

  afterUpdate(() => {
    if (logsElement) {
      logsElement.scrollTop = logsElement.scrollHeight;
    }
  });

  async function handleSubmit() {
    if (!repoUrl || !name) return;
    if (!token) {
      error = "You must be logged in to deploy.";
      return;
    }

    loading = true;
    error = null;
    logs = ["Initializing deployment..."];

    try {
      const env = envVars.reduce(
        (acc, { key, value }) => {
          if (key.trim()) {
            acc[key.trim()] = value;
          }
          return acc;
        },
        {} as Record<string, string>,
      );

      const res = await fetch("/deploy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          repoUrl,
          name,
          env,
          restartPolicy,
          maxRetries,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || "Deployment failed");
      }

      // Connect to SSE
      const buildId = data.buildId;
      logs = [...logs, `Build ID: ${buildId}`, "Waiting for logs..."];

      const evtSource = new EventSource(`/events/build/${buildId}`);

      evtSource.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        if (payload.log === "DONE") {
          evtSource.close();
          logs = [...logs, "Deployment successful! Redirecting..."];
          setTimeout(() => {
            goto("/");
          }, 1500);
        } else if (payload.log.startsWith("ERROR:")) {
          evtSource.close();
          error = payload.log;
          loading = false;
        } else {
          logs = [...logs, payload.log];
        }
      };

      evtSource.onerror = (err) => {
        console.error("EventSource failed:", err);
        evtSource.close();
        if (loading) {
          // logs = [...logs, "Connection closed unexpectedly."];
        }
      };
    } catch (e: any) {
      error = e.message;
      logs = [...logs, `Error: ${e.message}`];
      loading = false;
    }
  }
</script>

<div class="deploy-container animate-fade-in">
  <header class="page-header">
    <a href="/" class="back-link">
      <span class="icon">←</span> Back to Dashboard
    </a>
    <h1 class="page-title">Deploy New Application</h1>
    <p class="page-subtitle">Configure and launch your service in seconds</p>
  </header>

  <div class="deploy-grid">
    <div class="form-section">
      <div class="card deploy-card">
        <form on:submit|preventDefault={handleSubmit} class="deploy-form">
          <div class="form-group">
            <label for="name" class="label">Application Name</label>
            <div class="input-wrapper">
              <input
                id="name"
                type="text"
                class="input"
                placeholder="e.g. my-awesome-app"
                bind:value={name}
                disabled={loading}
                required
                pattern="^[a-z0-9-]+$"
                title="Lowercase letters, numbers, and hyphens only"
              />
              <span class="input-hint">app-name.localhost</span>
            </div>
          </div>

          <div class="form-group">
            <label for="repo" class="label">Git Repository URL</label>
            <input
              id="repo"
              type="url"
              class="input"
              placeholder="https://github.com/username/repo"
              bind:value={repoUrl}
              disabled={loading}
              required
            />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="restart-policy" class="label">Restart Policy</label>
              <div class="select-wrapper">
                <select bind:value={restartPolicy} class="select">
                  <option value="no">No</option>
                  <option value="on-failure">On Failure</option>
                  <option value="always">Always</option>
                  <option value="unless-stopped">Unless Stopped</option>
                </select>
              </div>
            </div>

            {#if restartPolicy === "on-failure"}
              <div class="form-group animate-fade-in">
                <label for="max-retries" class="label">Max Retries</label>
                <input
                  type="number"
                  id="max-retries"
                  bind:value={maxRetries}
                  min="1"
                  class="input"
                />
              </div>
            {/if}
          </div>

          <div class="form-group">
            <div class="label-row">
              <label class="label">Environment Variables</label>
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                on:click={addEnvVar}
                disabled={loading}
              >
                + Add Variable
              </button>
            </div>

            <div class="env-vars-container">
              {#each envVars as envVar, index}
                <div class="env-var-row">
                  <input
                    type="text"
                    class="input env-key"
                    placeholder="KEY"
                    bind:value={envVar.key}
                    disabled={loading}
                  />
                  <span class="separator">=</span>
                  <input
                    type="text"
                    class="input env-value"
                    placeholder="VALUE"
                    bind:value={envVar.value}
                    disabled={loading}
                  />
                  {#if envVars.length > 1}
                    <button
                      type="button"
                      class="btn-icon danger"
                      on:click={() => removeEnvVar(index)}
                      disabled={loading}
                      title="Remove variable"
                    >
                      ✕
                    </button>
                  {/if}
                </div>
              {/each}
            </div>
            <p class="input-hint">
              PORT and HOST are automatically set if not provided
            </p>
          </div>

          {#if error}
            <div class="error-banner animate-fade-in">
              <span class="icon">⚠️</span>
              {error}
            </div>
          {/if}

          <div class="form-actions">
            <button
              type="submit"
              class="btn btn-primary btn-block btn-lg"
              disabled={loading}
            >
              {#if loading}
                <span class="loader-sm"></span> Deploying...
              {:else}
                Launch Application 🚀
              {/if}
            </button>
          </div>
        </form>
      </div>
    </div>

    {#if logs.length > 0}
      <div class="logs-section animate-fade-in">
        <div class="card logs-card">
          <div class="logs-header">
            <h3>Build Logs</h3>
            <div class="live-indicator">
              <span class="dot"></span> Live
            </div>
          </div>
          <div class="logs-window" bind:this={logsElement}>
            {#each logs as log}
              <div class="log-line">{log}</div>
            {/each}
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .deploy-container {
    max-width: 1000px;
    margin: 0 auto;
    padding-bottom: 4rem;
  }

  .page-header {
    margin-bottom: 2rem;
    text-align: center;
  }

  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-muted);
    font-size: 0.875rem;
    margin-bottom: 1rem;
    padding: 0.5rem 1rem;
    border-radius: var(--radius-sm);
    transition: all 0.2s;
  }
  .back-link:hover {
    background: rgba(255, 255, 255, 0.05);
    color: var(--text-main);
  }

  .page-title {
    font-size: 2.5rem;
    margin-bottom: 0.5rem;
    background: linear-gradient(135deg, #fff 0%, #94a3b8 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .page-subtitle {
    color: var(--text-muted);
    font-size: 1.1rem;
  }

  .deploy-form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .label-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .input-wrapper {
    position: relative;
  }

  .input-hint {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-top: 0.25rem;
  }

  /* Environment Vars */
  .env-vars-container {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    background: rgba(0, 0, 0, 0.2);
    padding: 1rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
  }

  .env-var-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .env-key {
    font-family: monospace;
    font-weight: 600;
    color: #a5b4fc;
  }
  .env-value {
    font-family: monospace;
  }

  .separator {
    color: var(--text-muted);
    font-family: monospace;
  }

  .btn-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-muted);
    transition: all 0.2s;
  }
  .btn-icon:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--text-main);
  }

  .btn-icon.danger:hover {
    background: rgba(239, 68, 68, 0.2);
    color: var(--danger);
  }

  .error-banner {
    background: rgba(239, 68, 68, 0.1);
    color: var(--danger);
    padding: 1rem;
    border-radius: var(--radius-sm);
    border: 1px solid rgba(239, 68, 68, 0.2);
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .btn-block {
    width: 100%;
  }
  .btn-lg {
    padding: 1rem;
    font-size: 1.1rem;
  }

  /* Logs Section */
  .logs-section {
    margin-top: 2rem;
  }

  .logs-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border);
  }

  .logs-window {
    background: #000;
    border-radius: var(--radius-sm);
    padding: 1.5rem;
    font-family: "JetBrains Mono", monospace;
    font-size: 0.85rem;
    color: #e2e8f0;
    height: 400px;
    overflow-y: auto;
    border: 1px solid var(--border);
  }

  .log-line {
    padding: 2px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .live-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--success);
  }

  .dot {
    width: 8px;
    height: 8px;
    background: currentColor;
    border-radius: 50%;
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0% {
      opacity: 0.5;
      box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
    }
    70% {
      opacity: 1;
      box-shadow: 0 0 0 6px rgba(16, 185, 129, 0);
    }
    100% {
      opacity: 0.5;
      box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
    }
  }
</style>
