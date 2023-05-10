import { marked } from "marked";

const findTextChildren = ({ tokens }: { tokens: any[] }, unprocessed = []) => {
  if (!Array.isArray(tokens)) {
    return [];
  }

  const xs = [];

  for (const t of tokens) {
    if (t.text && !t.tokens) {
      // @ts-expect-error
      xs.push(t.text);
    } else {
      const x = findTextChildren(t).join("");
      // @ts-expect-error
      xs.push(x);
      // @ts-expect-error
      if (!x && !whitespace.has(t.type)) {
        // @ts-expect-error
        unprocessed.push(t);
      }
    }
  }

  return xs;
};

const processTokens = (tokens, results = [], unprocessed = []) => {
  for (const t of tokens) {
    switch (t.type) {
      case "paragraph":
      case "heading":
        // @ts-expect-error
        results.push({ type: t.type, text: findTextChildren(t).join("") });
        break;
      case "blockquote":
      case "list":
        processTokens(t.tokens || t.items, results, unprocessed); // recurse
        break;
      case "list_item":
        const textNodes = t.tokens.filter((x) => x.type === "text");
        const otherNodes = t.tokens.filter((x) => x.type !== "text");
        // @ts-expect-error
        results.push({ type: t.type, text: findTextChildren({ tokens: textNodes }).join("") });
        processTokens(otherNodes, results, unprocessed);
        break;
      case "code":
        // @ts-expect-error
        results.push({ type: t.type, text: t.text });
        break;
      case "table":
        // @ts-expect-error
        results.push({ type: t.type, text: t.raw }); // Maybe could do better here, but for now raw is good enough
        break;
      case "hr":
      case "space":
      case "br":
        continue;
      default:
        // @ts-expect-error
        unprocessed.push(t);
    }
  }

  return {
    fragments: results,
    unprocessed,
  };
};

export interface TextFragment {
  type: string;
  text: string;
}
export const extractFragments = async (s: string) => {
  const results = [] as string[];
  const tokens = marked.lexer(s);

  for (const token of tokens) {
    // @ts-expect-error types don't like this usage
    if (token.text) {
      // @ts-expect-error types don't like this usage
      results.push(token.text);
    }
  }

  // debugger;

  return results;
};
