<script lang="ts">
  import { enhance } from "$app/forms";
  import { page } from "$app/state";
  import Button from "$lib/ui/Button.svelte";
  import PageHeader from "$lib/ui/PageHeader.svelte";
  let { form } = $props();
</script>

<svelte:head><title>Sign in · WoW Compendium</title></svelte:head>

<div class="mx-auto max-w-md">
  <PageHeader eyebrow="Account" title="Sign in" lede="Enter your email and we send a sign-in link. No password to remember." />
  <div class="card p-5">
    {#if form?.sent}
      <p class="text-[15px] text-ok">Check your email for the link. It opens this site signed in.</p>
    {:else}
      <form method="post" use:enhance class="space-y-3">
        <label class="block text-[13px] font-medium text-ink-muted" for="email">Email</label>
        <input id="email" name="email" type="email" required placeholder="you@example.com" class="field" />
        <div class="flex items-center gap-3 pt-1">
          <Button type="submit">Send link</Button>
          {#if form?.error}<span class="text-[14px] text-bad">{form.error}</span>{/if}
        </div>
      </form>
    {/if}
  </div>
  <details class="mt-4">
    <summary class="text-[13px] text-ink-muted">Have a password instead?</summary>
    <form method="post" action="?/password{page.url.search ? '&' + page.url.search.slice(1) : ''}" use:enhance class="card mt-3 space-y-3 p-5">
      <label class="block text-[13px] font-medium text-ink-muted" for="pemail">Email</label>
      <input id="pemail" name="email" type="email" required autocomplete="username" class="field" />
      <label class="block text-[13px] font-medium text-ink-muted" for="password">Password</label>
      <input id="password" name="password" type="password" required autocomplete="current-password" class="field" />
      <div class="flex items-center gap-3 pt-1">
        <Button type="submit" variant="secondary">Sign in</Button>
        {#if form?.perror}<span class="text-[14px] text-bad">{form.perror}</span>{/if}
      </div>
    </form>
  </details>
</div>
