<script lang="ts">
    import { auth } from "../../stores/auth";
    import { goto } from "$app/navigation";

    let email = "";
    let password = "";
    let error = "";
    let loading = false;

    async function register() {
        loading = true;
        error = "";
        try {
            const res = await fetch("http://localhost:3000/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Registration failed");

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

<div class="container">
    <div class="card login-card">
        <h1 class="text-2xl font-bold mb-6 text-center">Register</h1>

        {#if error}
            <div class="alert error">{error}</div>
        {/if}

        <form on:submit|preventDefault={register} class="space-y-4">
            <div>
                <label for="email">Email</label>
                <input type="email" id="email" bind:value={email} required />
            </div>
            <div>
                <label for="password">Password</label>
                <input
                    type="password"
                    id="password"
                    bind:value={password}
                    required
                />
            </div>
            <button
                type="submit"
                class="btn btn-primary w-full"
                disabled={loading}
            >
                {loading ? "Creating Account..." : "Register"}
            </button>
        </form>

        <div class="mt-4 text-center">
            <a href="/login" class="text-primary hover:underline"
                >Already have an account? Login</a
            >
        </div>
    </div>
</div>

<style>
    .container {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 80vh;
    }
    .login-card {
        width: 100%;
        max-width: 400px;
        padding: 2rem;
    }
    .alert.error {
        background: #fee2e2;
        color: #991b1b;
        padding: 0.75rem;
        border-radius: 4px;
        margin-bottom: 1rem;
        font-size: 0.875rem;
    }
    .w-full {
        width: 100%;
    }
    .text-center {
        text-align: center;
    }
    .mt-4 {
        margin-top: 1rem;
    }
    .text-primary {
        color: var(--primary);
    }
</style>
