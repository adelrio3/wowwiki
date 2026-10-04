<script lang="ts">
  import { enhance } from "$app/forms";
  let { data, form } = $props();
</script>

<section class="max-w-xl space-y-6">
  <h1 class="text-2xl font-bold">Account</h1>
  <p class="text-stone-400 text-sm">{data.email}</p>
  <form method="post" action="?/displayName" use:enhance class="space-y-2">
    <label class="block text-sm text-stone-300" for="display_name">Display name (shown publicly where you opt in)</label>
    <input id="display_name" name="display_name" value={data.account?.display_name ?? ""} class="w-full rounded border border-stone-700 bg-stone-900 px-3 py-2" />
    <button class="rounded bg-amber-500 px-3 py-1.5 text-sm font-medium text-stone-950 hover:bg-amber-400">Save</button>
    {#if form?.error}<p class="text-red-400 text-sm">{form.error}</p>{/if}
    {#if form?.ok}<p class="text-emerald-400 text-sm">Saved.</p>{/if}
  </form>
  <div class="rounded border border-stone-800 p-4 space-y-2 text-sm">
    <div class="font-medium">Add-on link</div>
    <p class="text-stone-400">Your add-on installs are tied to this account by a private token written into the add-on folder. If you think it has leaked, rotate it and reinstall from the Sync page.</p>
    <form method="post" action="?/rotate" use:enhance><button class="rounded border border-stone-700 px-3 py-1.5 hover:border-stone-500">Rotate link token</button></form>
    {#if form?.rotated}<p class="text-emerald-400">Rotated. Reinstall the add-on from the Sync page to write the new token.</p>{/if}
  </div>
  <div class="text-sm text-stone-400">Role: {data.account?.role}{data.account?.trusted ? " · trusted contributor" : ""}</div>
</section>
