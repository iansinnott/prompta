<script lang="ts">
  import classNames from "classnames";
  import { Combobox } from "./ui/combobox";
  import { chatModels, gptProfileStore } from "$lib/stores/stores";
  import { Circle } from "lucide-svelte";
  import { onMount } from "svelte";
  let _class: string = "";
  export { _class as class };

  onMount(() => {
    chatModels.refresh();
  });
</script>

<div class={classNames("", _class)}>
  <Combobox
    value={$gptProfileStore.model}
    onChange={(value) => {
      $gptProfileStore.model = value;
    }}
    options={$chatModels.models.map((x) => ({
      value: x.id,
      label: x.id,
    }))}
  />
</div>
