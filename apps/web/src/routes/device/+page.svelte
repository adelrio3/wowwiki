<script lang="ts">
  import { enhance } from "$app/forms";
  import Button from "$lib/ui/Button.svelte";
  import PageHeader from "$lib/ui/PageHeader.svelte";
  let { data, form } = $props();
</script>

<svelte:head><title>Approve helper · WoW Compendium</title></svelte:head>

<div class="mx-auto max-w-md">
  <PageHeader eyebrow="Helper" title="Approve sign-in" lede="The helper on your computer wants to sync with this account." />
  <div class="card p-5">
    {#if form?.approved || data.state === "approved"}
      <p class="text-[15px] text-ok">Approved. You can close this tab; the helper takes it from here.</p>
    {:else if data.state === "pending"}
      <p class="text-[14px] text-ink-muted">Code shown by the helper:</p>
      <div class="mono my-3 text-[32px] tracking-[0.3em] text-ink">{data.code}</div>
      <p class="text-[14px] text-ink-muted">Device: <strong class="text-ink">{data.name}</strong>. Only approve if you just clicked “Sign in” in the helper.</p>
      <form method="post" action="?/approve" use:enhance class="mt-4 flex items-center gap-3">
        <input type="hidden" name="code" value={data.code} />
        <Button type="submit">Approve this helper</Button>
        {#if form?.error}<span class="text-[14px] text-bad">{form.error}</span>{/if}
      </form>
    {:else if data.state === "expired"}
      <p class="text-[14px] text-warn">That code has expired. Click “Sign in” in the helper again for a fresh one.</p>
    {:else}
      <p class="text-[14px] text-ink-muted">No code to approve. Open the helper on your computer and click “Sign in”; it brings you back here.</p>
    {/if}
  </div>
</div>
