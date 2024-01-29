<script lang="ts">
  import { db } from "$lib/stores/stores";
  import classNames from "classnames";
  import { onMount } from "svelte";
  let _class: string = "";
  export { _class as class };
  import * as Card from "$lib/components/ui/card";

  let stats: any = {};

  onMount(async () => {
    const result = await $db?.execO(
      `
      SELECT
        (SELECT count(*) FROM "fragment") AS "fragmentCount",
        (SELECT count(*) FROM "message") AS "messageCount",
        (SELECT count(*) FROM "thread") AS "threadCount"
    `,
      []
    );

    if (result && result.length > 0) {
      stats = result[0];
    }
  });
</script>

<div class={classNames("stats-container", _class)}>
  {#if stats}
    <Card.Root>
      <Card.Header>
        <h1 class="text-2xl font-bold">{stats.threadCount?.toLocaleString()}</h1>
      </Card.Header>
      <Card.Content>Threads</Card.Content>
    </Card.Root>
    <Card.Root>
      <Card.Header>
        <h1 class="text-2xl font-bold">{stats.messageCount?.toLocaleString()}</h1>
      </Card.Header>
      <Card.Content>Messages</Card.Content>
    </Card.Root>
  {/if}
</div>

<style>
  .stats-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    grid-gap: 1rem;
  }
</style>
