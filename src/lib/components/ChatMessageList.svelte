<script lang="ts">
  import { chooseRandomPrompts } from "$lib/llm/utils";
  import { currentChatThread, currentThread, isNewThread } from "$lib/stores/stores";
  import classNames from "classnames";
  import ChatMessageItem from "./ChatMessageItem.svelte";
  import IconBrain from "./IconBrain.svelte";
  import IconBrainAiHybrid from "./IconBrainAiHybrid.svelte";
  let _class: string = "";
  export { _class as class };

  $: messageList = $currentChatThread?.messages || [];
</script>

<div class={classNames("relative flex flex-col space-y-4 pt-2", _class)}>
  {#each messageList as x (x.id)}
    <ChatMessageItem item={x} />
  {/each}

  <!-- Give the user some examples to get them started -->
  {#if isNewThread($currentThread)}
    <div
      class="absolute inset-0 flex flex-col items-center pt-[10vh] sm:pt-[20vh] w-3/4 mx-auto space-y-4"
    >
      <div>
        <IconBrainAiHybrid class="w-20 h-20" />
      </div>
      <h3 class="font-bold text-lg">Ask GPT</h3>
      <div class="opacity-60 text-center flex flex-col space-y-2">
        {#each chooseRandomPrompts() as prompt}
          <p>"{prompt}"</p>
        {/each}
      </div>
    </div>
  {/if}
</div>
