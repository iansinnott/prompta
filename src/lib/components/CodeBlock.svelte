<script lang="ts">
  import { onMount } from "svelte";
  import { dirname } from "$lib/utils";
  import Prism from "prismjs";
  import "prismjs/themes/prism-okaidia.css"; // Choose a theme of your liking
  import "prismjs/plugins/autoloader/prism-autoloader";
  import "prismjs/plugins/line-numbers/prism-line-numbers";
  import "prismjs/plugins/line-numbers/prism-line-numbers.css";
  import "prism-svelte";
  // import prismPath from "prismjs/components/?url";
  import CopyButton from "./CopyButton.svelte";

  // Seems like there woudl be a more direct way to do this...
  // Prism.plugins.autoloader.languages_path = dirname(prismPath) + "/";
  Prism.plugins.autoloader.languages_path = "https://unpkg.com/prismjs@latest/components/";

  function normalizeLangauge(lang: string) {
    lang = lang?.toLowerCase() || "plain";
    if (lang === "ts") return "typescript";
    if (lang === "js") return "javascript";
    if (lang === "py") return "python";
    if (lang === "sh") return "bash";
    if (lang === "yml") return "yaml";
    if (lang === "md") return "markdown";
    if (lang === "c++") return "cpp";
    return lang;
  }

  export let lang = "";
  export let text = "";

  $: language = normalizeLangauge(lang);

  let codeElement: HTMLElement;
  let highlighted = "";
  let fetchedLanguages = new Set();

  // NOTE Since we're using auto-loader we need to trigger a load (the auto is
  // not auto). It's only auto if we use prismjs to highlight an element. This
  // will trigger the auto fetcher to fetch our language.
  // https://github.com/PrismJS/prism/blob/be909b18faa0afa899bb71ac1ab1f06c499277ce/plugins/autoloader/prism-autoloader.js#L409
  $: if (language && codeElement && !fetchedLanguages.has(language)) {
    console.debug("FETCH LANGUAGE", language);
    Prism.hooks.run("complete", { language, code: text, element: codeElement });
    fetchedLanguages.add(language);
  }

  $: if (language && Prism.languages[language]) {
    let grammar = Prism.languages[language];
    try {
      highlighted = Prism.highlight(text, grammar, language);
    } catch (err) {
      console.warn("Prism.highlight failed", { err, language, text, codeElement });
      highlighted = text;
    }
  } else {
    highlighted = text;
  }
</script>

<div class="CodeBlock content relative my-7 first:mt-0">
  <div class="flex items-center justify-between bg-zinc-700 px-2 py-1 rounded-t-lg">
    <small class="text-sm block text-white/60">{language}</small>
    <CopyButton size="18px" {text} class="border-none text-xs">Copy Code</CopyButton>
  </div>
  <pre class="language-{language}"><code bind:this={codeElement} class="language-{language}"
      >{@html highlighted}</code
    ></pre>
</div>

<style>
  :global(.CodeBlock) > pre {
    @apply rounded-t-none mt-0;
  }
</style>
