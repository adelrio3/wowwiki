<script lang="ts">
  import { enhance } from "$app/forms";
  import Button from "$lib/ui/Button.svelte";
  import Card from "$lib/ui/Card.svelte";
  let { form } = $props();
</script>

<svelte:head><title>Sign in · WoW Compendium</title></svelte:head>

<div class="mx-auto max-w-md space-y-6">
  <header>
    <h1 class="text-3xl font-medium">Sign in</h1>
    <p class="text-ink-muted">Enter your email and we'll send a sign-in link. No password to remember.</p>
  </header>
  <Card>
    {#if form?.sent}
      <p class="text-ok">Check your email for the link. It opens this site signed in.</p>
    {:else}
      <form method="post" use:enhance class="space-y-3">
        <label class="sr-only" for="email">Email</label>
        <input id="email" name="email" type="email" required placeholder="you@example.com" class="w-full rounded-md border border-line bg-bg px-3 py-2 text-sm focus:border-accent focus:outline-none" />
        <div class="flex items-center gap-3">
          <Button type="submit">Send link</Button>
          {#if form?.error}<span class="text-sm text-bad">{form.error}</span>{/if}
        </div>
      </form>
    {/if}
  </Card>
</div>
