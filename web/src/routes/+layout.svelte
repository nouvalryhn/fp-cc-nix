<script lang="ts">
  import "../app.css";
  import { auth, logout } from "../stores/auth";

  let isAuthenticated = false;
  let isAdmin = false;

  auth.subscribe((val) => {
    isAuthenticated = val.isAuthenticated;
    isAdmin = val.user?.role === "ADMIN";
  });
</script>

<nav class="navbar">
  <div class="nav-content">
    <a href="/" class="brand">
      <span class="logo-icon">⚡</span>
      AmbatuPaaS
    </a>

    <div class="nav-links">
      {#if isAuthenticated}
        {#if isAdmin}
          <a href="/admin" class="nav-item">Admin</a>
        {/if}
        <button on:click={logout} class="nav-item">Logout</button>
        <a href="/deploy" class="btn btn-primary">
          <span>+</span> New Deployment
        </a>
      {:else}
        <a href="/login" class="nav-item">Login</a>
        <a href="/register" class="btn btn-primary">Get Started</a>
      {/if}
    </div>
  </div>
</nav>

<main class="main-content">
  <slot />
</main>

<style>
  .navbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 70px;
    background: var(--glass-bg);
    backdrop-filter: var(--glass-backdrop);
    border-bottom: 1px solid var(--glass-border);
    z-index: 100;
    display: flex;
    align-items: center;
  }

  .nav-content {
    width: 100%;
    max-width: 1600px;
    margin: 0 auto;
    padding: 0 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .brand {
    font-size: 1.25rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: linear-gradient(135deg, #fff 0%, #94a3b8 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .logo-icon {
    font-size: 1.5rem;
    -webkit-text-fill-color: initial;
  }

  .nav-links {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }

  .nav-item {
    font-size: 0.95rem;
    font-weight: 500;
    color: var(--text-muted);
    transition: color 0.2s;
    background: none;
    padding: 0;
  }

  .nav-item:hover {
    color: var(--text-main);
  }

  .main-content {
    margin-top: 70px;
    min-height: calc(100vh - 70px);
    padding: 2rem;
  }
</style>
