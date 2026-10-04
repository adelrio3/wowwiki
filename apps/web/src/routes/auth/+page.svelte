<script lang="ts">
  import { enhance } from "$app/forms";
  let { form } = $props();
</script>

<section class="max-w-md space-y-4">
  <h1 class="text-2xl font-bold">Sign in</h1>
  <p class="text-stone-300">Enter your email and we'll send a sign-in link. No password.</p>
  {#if form?.sent}
    <p class="rounded border border-emerald-800 bg-emerald-950/40 p-3">Check your email for the link.</p>
  {:else}
    <form method="post" use:enhance class="space-y-3">
      <input name="email" type="email" required placeholder="you@example.com" class="w-full rounded border border-stone-700 bg-stone-900 px-3 py-2" />
      <button class="rounded bg-amber-500 px-4 py-2 font-medium text-stone-950 hover:bg-amber-400">Send link</button>
      {#if form?.error}<p class="text-red-400 text-sm">{form.error}</p>{/if}
    </form>
  {/if}
</section>
