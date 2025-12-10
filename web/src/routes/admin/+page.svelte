<script lang="ts">
    import { onMount } from "svelte";
    import { auth } from "../../stores/auth";
    import { goto } from "$app/navigation";

    interface App {
        id: string;
        name: string;
        status: string;
        url: string;
        user: { email: string };
    }

    let apps: App[] = [];
    let loading = true;
    let token: string | null = null;
    let error: string | null = null;

    async function fetchAllApps() {
        if (!token) return;
        try {
            const res = await fetch("http://localhost:3000/admin/apps", {
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
            await fetch(`http://localhost:3000/apps/${id}`, {
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

<div class="space-y-6">
    <header>
        <h1>Superadmin Dashboard</h1>
        <p class="text-muted">Manage ALL applications across the system.</p>
    </header>

    {#if loading}
        <div>Loading...</div>
    {:else}
        <div class="card overflow-hidden">
            <table class="w-full text-left">
                <thead>
                    <tr class="border-b">
                        <th class="p-4">App Name</th>
                        <th class="p-4">User</th>
                        <th class="p-4">Status</th>
                        <th class="p-4">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {#each apps as app}
                        <tr class="border-b last:border-0 hover:bg-gray-50">
                            <td class="p-4 font-bold">{app.name}</td>
                            <td class="p-4">{app.user.email}</td>
                            <td class="p-4">
                                <span
                                    class="status-badge"
                                    class:running={app.status === "running"}
                                    >{app.status}</span
                                >
                            </td>
                            <td class="p-4">
                                <a
                                    href={app.url}
                                    target="_blank"
                                    class="text-blue-600 hover:underline mr-4"
                                    >View</a
                                >
                                <button
                                    class="text-red-600 hover:underline"
                                    on:click={() => deleteApp(app.id)}
                                    >Delete</button
                                >
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
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
    .card {
        padding: 0;
        overflow: hidden;
    }
    .p-4 {
        padding: 1rem;
    }
    .border-b {
        border-bottom: 1px solid var(--border);
    }
    .w-full {
        width: 100%;
        border-collapse: collapse;
    }
    .last\:border-0:last-child {
        border-bottom: none;
    }
    .hover\:bg-gray-50:hover {
        background-color: #f9fafb;
    }
    .text-blue-600 {
        color: #2563eb;
    }
    .text-red-600 {
        color: #dc2626;
    }
    .mr-4 {
        margin-right: 1rem;
    }
    .font-bold {
        font-weight: 700;
    }

    .status-badge {
        padding: 0.25rem 0.5rem;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        background: #f1f5f9;
        color: #64748b;
    }
    .status-badge.running {
        background: #dcfce7;
        color: #166534;
    }
</style>
