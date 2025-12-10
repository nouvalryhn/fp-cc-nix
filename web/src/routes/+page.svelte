<script lang="ts">
  import { onMount } from "svelte";
  import { auth } from "../stores/auth";
  import { goto } from "$app/navigation";

  interface App {
    id: string;
    name: string;
    status: string;
    url: string;
  }

  let apps: App[] = [];
  let loading = true;
  let error: string | null = null;
  let token: string | null = null;

  auth.subscribe((value) => {
    token = value.token;
    if (!value.isAuthenticated && !loading) {
      // redirect handled in onMount or separate page guard
    }
  });

  async function fetchApps() {
    if (!token) return;
    try {
      const res = await fetch("http://localhost:3000/apps", {
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
      error = null;
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
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
</script>

<div class="space-y-6">
  <header>
    <h1>Dashboard</h1>
    <p class="text-muted">Manage your deployed applications.</p>
  </header>

  {#if loading && apps.length === 0}
    <div class="card">Loading...</div>
  {:else if error}
    <div
      class="card"
      style="border-color: var(--danger); color: var(--danger);"
    >
      Error: {error}
    </div>
  {:else if apps.length === 0}
    <div class="card text-center py-12">
      <p class="text-muted mb-4">No applications deployed yet.</p>
      <a href="/deploy" class="btn btn-primary"> + New Deployment </a>
    </div>
  {:else}
    <div class="grid">
      {#each apps as app}
        <div class="card">
          <div class="flex justify-between items-start mb-4">
            <div>
              <h3 class="text-lg font-bold">{app.name}</h3>
              <div
                class="status-badge"
                class:running={app.status === "running"}
              >
                {app.status}
              </div>
            </div>
            <a
              href={app.url}
              target="_blank"
              class="btn"
              style="background: var(--bg-body);"
            >
              Open ↗
            </a>
          </div>
          <div class="text-sm text-muted break-all">
            {app.url}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .space-y-6 > * + * {
    margin-top: 1.5rem;
  }
  .text-muted {
    color: var(--text-muted);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
  }
  .flex {
    display: flex;
  }
  .justify-between {
    justify-content: space-between;
  }
  .items-start {
    align-items: flex-start;
  }
  .font-bold {
    font-weight: 700;
  }
  .text-lg {
    font-size: 1.125rem;
  }
  .text-center {
    text-align: center;
  }
  .py-12 {
    padding-top: 3rem;
    padding-bottom: 3rem;
  }
  .mb-4 {
    margin-bottom: 1rem;
  }
  .break-all {
    word-break: break-all;
  }

  .status-badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    background: #f1f5f9;
    color: #64748b;
    margin-top: 0.25rem;
  }
  .status-badge.running {
    background: #dcfce7;
    color: #166534;
  }
</style>
