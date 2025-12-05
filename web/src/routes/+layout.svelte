<script lang="ts">
  import '../app.css';
</script>

<nav class="border-b bg-white">
  <div class="container py-4 flex justify-between items-center" style="padding-top: 1rem; padding-bottom: 1rem;">
    <a href="/" class="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600" style="background: linear-gradient(to right, #2563eb, #4f46e5); -webkit-background-clip: text; color: transparent;">
      PaaS Dashboard
    </a>
    <a href="/deploy" class="btn btn-primary">
      + New Deployment
    </a>
  </div>
</nav>

<main class="container">
  <slot />
</main>

<style>
  .border-b {
    border-bottom: 1px solid var(--border);
  }
  .bg-white {
    background: white;
  }
  .flex {
    display: flex;
  }
  .justify-between {
    justify-content: space-between;
  }
  .items-center {
    align-items: center;
  }
  .text-xl {
    font-size: 1.25rem;
  }
  .font-bold {
    font-weight: 700;
  }
</style>
