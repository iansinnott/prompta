<!-- A settings page where the user can input their OpenAI api key -->
<script lang="ts">
  import { openAiConfig } from "../../lib/stores/stores";
</script>

<div class="p-2">
  <h1 class="text-2xl font-bold">Settings</h1>
  <form>
    <label for="apiKey" class="block text-sm font-medium text-gray-700"> OpenAI API Key </label>
    <div class="mt-1">
      <input
        type="text"
        name="apiKey"
        id="apiKey"
        bind:value={$openAiConfig.apiKey}
        class="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
      />
    </div>
    <div class="mt-4">
      <button
        type="submit"
        class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        Save
      </button>
    </div>
  </form>
</div>
