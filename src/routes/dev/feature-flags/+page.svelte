<script lang="ts">
  import classNames from "classnames";
  let _class: string = "";
  export { _class as class };
  import { featureFlags } from "$lib/featureFlags";
  import { Button } from "$lib/components/ui/button";
  import { Flag } from "lucide-svelte";
  import { dev } from "$app/environment";

  let dirty = false;
</script>

<div class={classNames("", _class)}>
  <div class="prose prose-invert">
    <h1 class="flex items-center">
      <Flag size="24" class="inline-block mr-4" />
      <span>Feature Flags</span>
    </h1>
    <p>
      Enable or disable these as you like. They are experimental and might cause breakage, but they
      are also pretty sweet.
    </p>
    {#if dev}
      <p>
        <a href="https://console.statsig.com/5CZvr5iLwFVm2OSzgPCHAs/gates">Add more flags</a> in Statsig
      </p>
    {/if}
    <hr class="mb-5" />
  </div>

  {#each featureFlags.flagList as flag}
    <div class="flex items-center justify-between pt-3">
      <div class="flex items-center">
        <input
          type="checkbox"
          id={flag.id}
          checked={featureFlags.check(flag.id)}
          on:change={() => {
            featureFlags.setFlag(flag.id, !featureFlags.check(flag.id));
            dirty = true;
          }}
          class="mr-2"
        />
        <label for={flag.id}>
          <span> {flag.name} </span>
        </label>
      </div>
      <div class="text-sm text-gray-500 flex space-x-4">
        <small class="">
          <span>id:</span>
          <span class="text-indigo-400">{flag.id}</span>
        </small>
        <span>
          {featureFlags.check(flag.id) ? "Enabled" : "Disabled"}
        </span>
      </div>
    </div>
    {#if flag.description}
      <div class="pl-5 text-sm text-gray-400">{flag.description}</div>
    {/if}
  {/each}

  {#if dirty}
    <div class="mt-5">
      <Button
        class="w-full sm:w-auto"
        on:click={() => {
          window.location.reload();
        }}
      >
        Save & Reload
      </Button>
    </div>
  {/if}
</div>
