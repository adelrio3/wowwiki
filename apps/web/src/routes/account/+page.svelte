<script lang="ts">
  import { enhance } from "$app/forms";
  import Button from "$lib/ui/Button.svelte";
  import Card from "$lib/ui/Card.svelte";
  import PageHeader from "$lib/ui/PageHeader.svelte";
  let { data, form } = $props();
</script>

<svelte:head><title>Account · WoW Compendium</title></svelte:head>

<div class="mx-auto max-w-2xl">
  <PageHeader eyebrow="You" title="Account" lede={`${data.email}${data.account?.role ? ` · ${data.account.role}` : ""}${data.account?.trusted ? " · trusted contributor" : ""}`} />
  <div class="space-y-4">
    <Card title="Display name">
      <form method="post" action="?/displayName" use:enhance class="space-y-3">
        <p class="text-[14px] text-ink-muted">Shown publicly only where you opt in. Nothing is public until you do.</p>
        <input name="display_name" value={data.account?.display_name ?? ""} class="field max-w-sm" />
        <div class="flex items-center gap-3">
          <Button type="submit">Save</Button>
          {#if form?.error}<span class="text-[14px] text-bad">{form.error}</span>{/if}
          {#if form?.ok}<span class="text-[14px] text-ok">Saved.</span>{/if}
        </div>
      </form>
    </Card>
    <Card title="Add-on link">
      <p class="text-[14px] text-ink-muted">Your add-on installs are tied to this account by a private token written into the add-on folder. If you think it has leaked, rotate it and reinstall from the Add-on page.</p>
      <form method="post" action="?/rotate" use:enhance class="mt-3 flex items-center gap-3">
        <Button type="submit" variant="secondary">Rotate link token</Button>
        {#if form?.rotated}<span class="text-[14px] text-ok">Rotated. Reinstall the add-on from the Add-on page.</span>{/if}
      </form>
    </Card>
  </div>
</div>
