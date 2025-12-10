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

  async function handleSubmit() {
    if (!repoUrl || !name) return;
    if (!token) {
      error = "You must be logged in to deploy.";
      return;
    }

    loading = true;
    error = null;
    logs = ["Starting deployment... this may take a minute..."];

    try {
      const res = await fetch("http://localhost:3000/deploy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ repoUrl, name }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || "Deployment failed");
      }

      logs = [
        ...logs,
        "Deployment successful!",
        `URL: ${data.url || data.app.domain || ""}`,
      ];
      setTimeout(() => goto("/"), 1500); // Redirect back to dashboard
    } catch (e: any) {
      error = e.message;
      logs = [...logs, `Error: ${e.message}`];
    } finally {
      loading = false;
    }
  }
</script>

<div class="max-w-2xl mx-auto">
  <header class="mb-8">
    <a href="/" class="text-sm text-muted hover:underline"
      >← Back to Dashboard</a
    >
    <h1 class="mt-2 text-3xl">Deploy New App</h1>
  </header>

  <div class="card">
    <form on:submit|preventDefault={handleSubmit} class="space-y-4">
      <div>
        <label for="name" class="label">Application Name</label>
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
        <p class="text-xs text-muted mt-1">
          Used for subdomain (app-name.localhost)
        </p>
      </div>

      <div>
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

      {#if error}
        <div class="p-4 rounded bg-red-50 text-red-600 text-sm">
          {error}
        </div>
      {/if}

      <div class="pt-4">
        <button type="submit" class="btn btn-primary w-full" disabled={loading}>
          {#if loading}
            Deploying...
          {:else}
            Deploy Application
          {/if}
        </button>
      </div>
    </form>
  </div>

  {#if logs.length > 0}
    <div class="mt-8 card bg-slate-900 text-slate-200 font-mono text-sm p-4">
      {#each logs as log}
        <div class="mb-1">> {log}</div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .max-w-2xl {
    max-width: 42rem;
  }
  .mx-auto {
    margin-left: auto;
    margin-right: auto;
  }
  .mb-8 {
    margin-bottom: 2rem;
  }
  .mt-2 {
    margin-top: 0.5rem;
  }
  .text-3xl {
    font-size: 1.875rem;
  }
  .space-y-4 > * + * {
    margin-top: 1rem;
  }
  .text-xs {
    font-size: 0.75rem;
  }
  .text-muted {
    color: var(--text-muted);
  }
  .hover\:underline:hover {
    text-decoration: underline;
  }
  .w-full {
    width: 100%;
  }
  .p-4 {
    padding: 1rem;
  }
  .pt-4 {
    padding-top: 1rem;
  }
  .rounded {
    border-radius: 0.25rem;
  }
  .bg-red-50 {
    background-color: #fef2f2;
  }
  .text-red-600 {
    color: #dc2626;
  }

  .bg-slate-900 {
    background-color: #0f172a;
    border-color: #1e293b;
  }
  .text-slate-200 {
    color: #e2e8f0;
  }
  .font-mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
      monospace;
  }
</style>
