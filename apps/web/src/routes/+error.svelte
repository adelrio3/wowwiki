<script lang="ts">
  import { page } from "$app/state";
</script>

<svelte:head><title>{page.status} · WoW Compendium</title></svelte:head>
<section class="mx-auto max-w-md space-y-3 py-12 text-center">
  <div class="num text-5xl text-ink-faint">{page.status}</div>
  <p class="text-ink-muted">{page.error?.message ?? "Something went wrong."}</p>
  <a href="/">Back to the front page</a>
</section>
