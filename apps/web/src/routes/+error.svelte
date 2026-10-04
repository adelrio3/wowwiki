<script lang="ts">
  import { page } from "$app/state";
</script>

<svelte:head><title>{page.status} · WoW Compendium</title></svelte:head>
<section class="mx-auto max-w-md space-y-3 py-16 text-center">
  <div class="num text-[56px] leading-none text-ink-faint">{page.status}</div>
  <p class="serif text-[22px] text-ink">{page.status === 404 ? "Not on any map we have." : "Something went wrong."}</p>
  <p class="text-[14px] text-ink-muted">{page.error?.message ?? ""}</p>
  <p class="pt-2"><a href="/">Back to the front page</a> · <a href="/wiki">Browse zones</a></p>
</section>
