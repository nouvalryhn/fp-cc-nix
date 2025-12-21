<script lang="ts">
    import { auth } from "../../stores/auth";
    import { goto } from "$app/navigation";

    let email = "";
    let password = "";
    let error = "";
    let loading = false;

    async function login() {
        loading = true;
        error = "";
        try {
            const res = await fetch("/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Login failed");

            auth.set({
                token: data.token,
                user: data.user,
                isAuthenticated: true,
            });
            goto("/");
        } catch (e: any) {
            error = e.message;
        } finally {
            loading = false;
        }
    }
</script>

<div class="auth-container animate-fade-in">
    <div class="auth-card">
        <div class="card-header">
            <h1 class="auth-title">Welcome Back</h1>
            <p class="auth-subtitle">Sign in to manage your apps</p>
        </div>

        {#if error}
            <div class="error-banner animate-fade-in">{error}</div>
        {/if}

        <form on:submit|preventDefault={login} class="auth-form">
            <div class="form-group">
                <label for="email" class="label">Email Address</label>
                <input
                    type="email"
                    id="email"
                    class="input"
                    placeholder="name@example.com"
                    bind:value={email}
                    required
                />
            </div>

            <div class="form-group">
                <label for="password" class="label">Password</label>
                <input
                    type="password"
                    id="password"
                    class="input"
                    placeholder="••••••••"
                    bind:value={password}
                    required
                />
            </div>

            <button
                type="submit"
                class="btn btn-primary btn-block btn-lg mt-2"
                disabled={loading}
            >
                {#if loading}
                    <span class="loader-sm"></span> Signing in...
                {:else}
                    Sign In
                {/if}
            </button>
        </form>

        <div class="auth-footer">
            <p>Don't have an account?</p>
            <a href="/register" class="link-primary">Create an account</a>
        </div>
    </div>
</div>

<style>
    .auth-container {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: calc(100vh - 140px);
        padding: 2rem;
    }

    .auth-card {
        width: 100%;
        max-width: 400px;
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        padding: 2.5rem;
        box-shadow: var(--shadow-lg);
    }

    .card-header {
        text-align: center;
        margin-bottom: 2rem;
    }

    .auth-title {
        font-size: 1.75rem;
        margin-bottom: 0.5rem;
        background: linear-gradient(135deg, #fff 0%, #94a3b8 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }

    .auth-subtitle {
        color: var(--text-muted);
        font-size: 0.95rem;
    }

    .auth-form {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
    }

    .form-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .error-banner {
        background: rgba(239, 68, 68, 0.1);
        color: var(--danger);
        padding: 0.75rem;
        border-radius: var(--radius-sm);
        border: 1px solid rgba(239, 68, 68, 0.2);
        margin-bottom: 1.5rem;
        font-size: 0.9rem;
        text-align: center;
    }

    .btn-block {
        width: 100%;
        justify-content: center;
    }

    .btn-lg {
        padding: 0.75rem;
        font-size: 1rem;
    }

    .mt-2 {
        margin-top: 0.5rem;
    }

    .auth-footer {
        margin-top: 2rem;
        text-align: center;
        font-size: 0.9rem;
        color: var(--text-muted);
    }

    .link-primary {
        color: var(--primary);
        font-weight: 500;
        margin-left: 0.25rem;
    }
    .link-primary:hover {
        text-decoration: underline;
    }
</style>
