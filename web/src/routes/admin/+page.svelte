<script lang="ts">
    import { onMount } from "svelte";
    import { auth } from "../../stores/auth";
    import { goto } from "$app/navigation";

    interface App {
        id: string;
        name: string;
        status: string;
        domain: string;
        user: { email: string };
    }

    let apps: App[] = [];
    let loading = true;
    let token: string | null = null;
    let error: string | null = null;

    async function fetchAllApps() {
        if (!token) return;
        try {
            const res = await fetch("/admin/apps", {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.status === 403 || res.status === 401) {
                goto("/"); // fallback
                return;
            }
            apps = await res.json();
        } catch (e: any) {
            error = e.message;
        } finally {
            loading = false;
        }
    }

    async function deleteApp(id: string) {
        if (
            !confirm(
                "Are you sure? This will delete the app container and record.",
            )
        )
            return;
        try {
            await fetch(`/apps/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });
            fetchAllApps(); // Refresh
        } catch (e) {
            alert("Failed to delete");
        }
    }

    onMount(() => {
        const unsub = auth.subscribe((val) => {
            if (!val.isAuthenticated || val.user?.role !== "ADMIN") {
                goto("/");
            } else {
                token = val.token;
                fetchAllApps();
            }
        });
        return unsub;
    });
</script>

<div class="admin-container animate-fade-in">
    <header class="header">
        <div>
            <h1 class="page-title">Superadmin Dashboard</h1>
            <p class="text-muted">System-wide application management</p>
        </div>
        <div class="stat-card">
            <span class="stat-value">{apps.length}</span>
            <span class="stat-label">Total Apps</span>
        </div>
    </header>

    {#if loading}
        <div class="loading-state">
            <span class="loader"></span> Loading...
        </div>
    {:else}
        <div class="card table-card">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Application</th>
                        <th>Owner</th>
                        <th>Status</th>
                        <th class="text-right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {#each apps as app}
                        <tr class="table-row">
                            <td>
                                <div class="app-cell">
                                    <span class="app-name">{app.name}</span>
                                    <a
                                        href={`http://${app.domain}`}
                                        target="_blank"
                                        class="app-domain">{app.domain}</a
                                    >
                                </div>
                            </td>
                            <td>
                                <div class="user-cell">
                                    <span class="user-avatar"
                                        >{app.user.email[0].toUpperCase()}</span
                                    >
                                    <span class="user-email"
                                        >{app.user.email}</span
                                    >
                                </div>
                            </td>
                            <td>
                                <span
                                    class="status-badge"
                                    class:running={app.status === "running"}
                                >
                                    <span class="status-dot"></span>
                                    {app.status}
                                </span>
                            </td>
                            <td class="text-right">
                                <div class="actions">
                                    <a
                                        href={`http://${app.domain}`}
                                        target="_blank"
                                        class="btn-icon"
                                        title="View App"
                                    >
                                        ↗
                                    </a>
                                    <button
                                        class="btn-icon danger"
                                        on:click={() => deleteApp(app.id)}
                                        title="Delete App"
                                    >
                                        🗑
                                    </button>
                                </div>
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>

            {#if apps.length === 0}
                <div class="empty-state">
                    No applications found in the system.
                </div>
            {/if}
        </div>
    {/if}
</div>

<style>
    .admin-container {
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

    .stat-card {
        background: var(--bg-card);
        border: 1px solid var(--border);
        padding: 0.75rem 1.5rem;
        border-radius: var(--radius-sm);
        text-align: center;
    }

    .stat-value {
        display: block;
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--primary);
        line-height: 1;
    }

    .stat-label {
        font-size: 0.75rem;
        color: var(--text-muted);
        text-transform: uppercase;
        font-weight: 600;
    }

    .table-card {
        padding: 0;
        overflow: hidden;
    }

    .data-table {
        width: 100%;
        border-collapse: collapse;
    }

    .data-table th {
        text-align: left;
        padding: 1rem 1.5rem;
        border-bottom: 1px solid var(--border);
        color: var(--text-muted);
        font-weight: 600;
        text-transform: uppercase;
        font-size: 0.75rem;
        letter-spacing: 0.05em;
        background: rgba(0, 0, 0, 0.2);
    }

    .data-table td {
        padding: 1rem 1.5rem;
        border-bottom: 1px solid var(--border);
        color: var(--text-main);
    }

    .table-row:last-child td {
        border-bottom: none;
    }

    .table-row:hover {
        background: rgba(255, 255, 255, 0.02);
    }

    .app-cell {
        display: flex;
        flex-direction: column;
    }

    .app-name {
        font-weight: 600;
        font-size: 1rem;
    }

    .app-domain {
        font-size: 0.85rem;
        color: var(--text-muted);
    }

    .user-cell {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .user-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: var(--primary);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.85rem;
        font-weight: 600;
    }

    .user-email {
        color: var(--text-muted);
    }

    .status-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.35rem 0.75rem;
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

    .actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 0.5rem;
    }

    .text-right {
        text-align: right;
    }

    .btn-icon {
        width: 32px;
        height: 32px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--radius-sm);
        color: var(--text-muted);
        transition: all 0.2s;
        background: transparent;
    }
    .btn-icon:hover {
        background: rgba(255, 255, 255, 0.1);
        color: var(--text-main);
    }
    .btn-icon.danger:hover {
        background: rgba(239, 68, 68, 0.2);
        color: var(--danger);
    }

    .empty-state {
        padding: 3rem;
        text-align: center;
        color: var(--text-muted);
    }

    .loading-state {
        padding: 4rem;
        text-align: center;
        color: var(--text-muted);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
    }
</style>
