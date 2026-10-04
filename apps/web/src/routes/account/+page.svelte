<script lang="ts">
  import { enhance } from "$app/forms";
  import Button from "$lib/ui/Button.svelte";
  import Card from "$lib/ui/Card.svelte";
  let { data, form } = $props();
</script>

<svelte:head><title>Account · WoW Compendium</title></svelte:head>

<div class="mx-auto max-w-xl space-y-6">
  <header>
    <h1 class="text-3xl font-medium">Account</h1>
    <p class="text-sm text-ink-muted">{data.email} · {data.account?.role}{data.account?.trusted ? " · trusted contributor" : ""}</p>
  </header>
  <Card title="Display name">
    <form method="post" action="?/displayName" use:enhance class="space-y-3">
      <p class="text-sm text-ink-muted">Shown publicly wherever you opt in. Nothing is public until you do.</p>
      <input name="display_name" value={data.account?.display_name ?? ""} class="w-full rounded-md border border-line bg-bg px-3 py-2 text-sm focus:border-accent focus:outline-none" />
      <div class="flex items-center gap-3">
        <Button type="submit">Save</Button>
        {#if form?.error}<span class="text-sm text-bad">{form.error}</span>{/if}
        {#if form?.ok}<span class="text-sm text-ok">Saved.</span>{/if}
      </div>
    </form>
  </Card>
  <Card title="Add-on link">
    <p class="text-sm text-ink-muted">Your add-on installs are tied to this account by a private token written into the add-on folder. If you think it has leaked, rotate it and reinstall from the Sync page.</p>
    <form method="post" action="?/rotate" use:enhance class="mt-3 flex items-center gap-3">
      <Button type="submit" variant="secondary">Rotate link token</Button>
      {#if form?.rotated}<span class="text-sm text-ok">Rotated. Reinstall the add-on from the Sync page.</span>{/if}
    </form>
  </Card>
</div>
