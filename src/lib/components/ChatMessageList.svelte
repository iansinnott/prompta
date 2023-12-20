<script lang="ts">
  import { chooseRandomPrompts } from "$lib/llm/utils";
  import { currentChatThread, currentThread, isNewThread } from "$lib/stores/stores";
  import classNames from "classnames";
  import ChatMessageItem from "./ChatMessageItem.svelte";
  import IconBrainAiHybrid from "./IconBrainAiHybrid.svelte";
  import { onMount, afterUpdate, tick } from "svelte";
  import { isMobile, throttle } from "$lib/utils";

  let _class: string = "";
  export { _class as class };

  let scrollArea: HTMLDivElement;
  let isAtListBottom = true;

  $: messageList = $currentChatThread?.messages || [];

  const scrollToBottom = () => {
    if (!isAtListBottom) {
      console.log("Not scrolling to bottom because user is not at the bottom");
      return;
    }
    const parent = scrollArea.parentElement;
    if (parent) {
      parent.scrollTo({
        top: parent.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  // reset bottom flag when list changes. i.e. when the thread changes or when a
  // new message is inserted
  let lastMessageListLength = 0;
  $: if (messageList.length !== lastMessageListLength) {
    isAtListBottom = true;
    lastMessageListLength = messageList.length;
  }

  onMount(() => {
    tick().then(scrollToBottom);
  });

  // Scroll to bottom when the thread changes or when a new message is inserted
  let lastThreadId = $currentThread.id;
  let lastMessageCount = $currentChatThread?.messages.length || 0;
  $: if (lastThreadId !== $currentThread.id) {
    lastThreadId = $currentThread.id;
    lastMessageCount = $currentChatThread?.messages.length || 0;
    tick().then(scrollToBottom);
  } else if (lastMessageCount > $currentChatThread.messages.length) {
    lastMessageCount = $currentChatThread.messages.length;
    console.debug("same thread. not scrolling for deletion");
  } else {
    lastMessageCount = $currentChatThread.messages.length;
    tick().then(scrollToBottom);
  }

  const handleWheel = throttle(
    (e: WheelEvent) => {
      const parent = scrollArea.parentElement;
      if (!parent) return;
      const { scrollTop, scrollHeight, clientHeight } = parent;
      const isAtBottom = scrollHeight - clientHeight - scrollTop < 1;
      isAtListBottom = isAtBottom;
    },
    100,
    {
      leading: true,
      trailing: true,
    }
  );

  const mobile = isMobile();
</script>

<div
  bind:this={scrollArea}
  on:wheel={handleWheel}
  class={classNames("relative flex flex-col space-y-4 pt-2 pb-6", _class, {
    // I was seeing issues with a slight horizontal overflow where there shoudl
    // have been none. This fixed it, but be wary of regressions.
    "overflow-hidden": mobile,
  })}
>
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
      <h3 class="font-bold text-lg">Ask Prompta</h3>
      <div class="opacity-60 text-center flex flex-col space-y-2">
        {#each chooseRandomPrompts() as prompt}
          <p>"{prompt}"</p>
        {/each}
      </div>
    </div>
  {/if}
</div>
