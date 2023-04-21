import { execSync } from "node:child_process";
import fs from "node:fs";

function getTags() {
  const output = execSync("git tag");
  return output.toString().trim().split("\n");
}

function getCommitsByTag(tag) {
  const output = execSync(
    `git log --pretty=format:'{"hash": "%H", "author": "%an", "email": "%ae", "date": "%ad", "message": "%s"}' ${tag}`
  );
  const lines = output.toString().trim().split("\n");
  return lines.map((line) => JSON.parse(line));
}

function aggregateCommitsByTag() {
  const tags = getTags();
  const result = {};

  tags.forEach((tag, index) => {
    const previousTag = index > 0 ? tags[index - 1] : "";
    if (previousTag) {
      const output = execSync(
        `git log --pretty=format:'{"hash": "%H", "author": "%an", "email": "%ae", "date": "%ad", "message": "%s"}' ${previousTag}..${tag}`
      );

      const lines = output
        .toString()
        .trim()
        .split("\n")
        .filter((x) => x.trim());

      result[tag] = lines.map((line) => {
        return JSON.parse(line);
      });
    } else {
      result[tag] = getCommitsByTag(tag);
    }
  });

  return result;
}

function generateMarkdown(data) {
  let markdownString = "";

  const xs = Object.entries(data)
    .reverse()
    .filter(([k]) => !k.startsWith("app-"));

  for (const [tag, commits] of xs) {
    markdownString += `## ${tag}\n\n`;

    commits.forEach((commit) => {
      if (commit.message !== tag) {
        markdownString += `- [${commit.hash.slice(0, 7)}](${commit.hash}) - ${commit.message}\n`;
      }
    });

    markdownString += "\n";
  }

  return markdownString;
}

const aggregatedData = aggregateCommitsByTag();
fs.writeFileSync("tmp/commits_by_tag.json", JSON.stringify(aggregatedData, null, 2));

const markdownString = generateMarkdown(aggregatedData);
fs.writeFileSync("CHANGELOG.md", markdownString);

console.log("Done!");
