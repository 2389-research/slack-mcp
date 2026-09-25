// ABOUTME: Live end-to-end tests that exercise real Slack API calls.
// ABOUTME: Only runs when SLACK_E2E_TOKEN env var is set; otherwise exits immediately.

/**
 * This file is intentionally excluded from `npm test` (the default suite).
 * Run it with: npm run test:e2e
 *
 * Required environment variables:
 *   SLACK_E2E_TOKEN   - A real Slack bot token (xoxb-...)
 *   SLACK_E2E_CHANNEL - An existing channel ID to post to (e.g. C123ABC)
 *
 * The bot must have: chat:write, channels:read, pins:write, users:read
 */

const e2eToken = process.env.SLACK_E2E_TOKEN;
const e2eChannel = process.env.SLACK_E2E_CHANNEL;

if (!e2eToken) {
  console.error(
    "Error: set SLACK_E2E_TOKEN to run end-to-end tests.\n" +
    "These tests make real Slack API calls and require a valid bot token.\n" +
    "Example: SLACK_E2E_TOKEN=xoxb-... SLACK_E2E_CHANNEL=C123ABC npm run test:e2e"
  );
  process.exit(1);
}

if (!e2eChannel) {
  console.error(
    "Error: set SLACK_E2E_CHANNEL (a real channel ID) to run end-to-end tests."
  );
  process.exit(1);
}

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = path.resolve(__dirname, "../dist/index.js");

function spawnServer(env = {}) {
  const child = spawn("node", [SERVER_PATH], {
    env: { ...process.env, ...env },
    stdio: ["pipe", "pipe", "pipe"],
  });
  return child;
}

function sendRequest(child, request) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    const onData = (chunk) => {
      stdout += chunk.toString();
      const lines = stdout.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed);
          child.stdout.off("data", onData);
          resolve(parsed);
          return;
        } catch {
          // incomplete JSON
        }
      }
    };
    child.stdout.on("data", onData);
    child.once("error", reject);
    child.once("close", (code) => reject(new Error(`Process exited with code ${code}`)));
    child.stdin.write(JSON.stringify(request) + "\n");
  });
}

async function initializeServer(child) {
  return sendRequest(child, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "e2e-test", version: "0.0.1" },
    },
  });
}

test("e2e: post a real message to Slack", async () => {
  const child = spawnServer({ SLACK_BOT_TOKEN: e2eToken });
  try {
    await initializeServer(child);

    const response = await sendRequest(child, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "slack_post_message",
        arguments: {
          channel_id: e2eChannel,
          text: "[slack-mcp e2e test] automated test message — safe to ignore",
        },
      },
    });

    assert.ok(response.result, "should get a result");
    const content = response.result.content[0].text;
    const parsed = JSON.parse(content);
    assert.equal(parsed.success, true, "message post should succeed");
    assert.ok(parsed.message_ts, "should return a message timestamp");
  } finally {
    child.kill();
  }
});
