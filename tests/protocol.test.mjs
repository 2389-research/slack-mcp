// ABOUTME: Protocol/integration tests for slack-mcp server over stdio JSON-RPC.
// ABOUTME: Spawns the real built server; no mocks, no Slack network calls.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = path.resolve(__dirname, "../dist/index.js");
const FAKE_TOKEN = "FAKE-audit-not-a-token";

/**
 * Send a single JSON-RPC request to a child process and collect the response.
 * Returns the parsed JSON object from stdout.
 */
function sendRequest(child, request) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";

    const onData = (chunk) => {
      stdout += chunk.toString();
      const lines = stdout.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed);
          child.stdout.off("data", onData);
          child.stderr.off("data", onStderr);
          resolve(parsed);
          return;
        } catch {
          // Not complete JSON yet, keep reading
        }
      }
    };

    const onStderr = (chunk) => {
      stderr += chunk.toString();
    };

    const onError = (err) => {
      reject(err);
    };

    const onClose = (code) => {
      reject(new Error(`Process exited with code ${code} before response. stderr: ${stderr}`));
    };

    child.stdout.on("data", onData);
    child.stderr.on("data", onStderr);
    child.once("error", onError);
    child.once("close", onClose);

    child.stdin.write(JSON.stringify(request) + "\n");
  });
}

/**
 * Spawn the server with a given environment. Returns {child, stderrLines}.
 */
function spawnServer(env = {}) {
  const child = spawn("node", [SERVER_PATH], {
    env: { ...process.env, ...env },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const stderrLines = [];
  child.stderr.on("data", (chunk) => {
    stderrLines.push(chunk.toString());
  });
  return { child, stderrLines };
}

test("missing SLACK_BOT_TOKEN → exit code 1 with error on stderr", async () => {
  const { child, stderrLines } = spawnServer({ SLACK_BOT_TOKEN: "" });

  const exitCode = await new Promise((resolve) => {
    child.on("close", resolve);
  });

  const stderrOutput = stderrLines.join("");
  assert.equal(exitCode, 1, "server should exit with code 1 when token is missing");
  assert.ok(
    stderrOutput.includes("SLACK_BOT_TOKEN"),
    `stderr should mention SLACK_BOT_TOKEN, got: ${stderrOutput}`
  );
});

test("initialize returns valid result with serverInfo name 'slack-mcp'", async () => {
  const { child } = spawnServer({ SLACK_BOT_TOKEN: FAKE_TOKEN });

  try {
    const response = await sendRequest(child, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test-client", version: "0.0.1" },
      },
    });

    assert.equal(response.jsonrpc, "2.0", "response must be JSON-RPC 2.0");
    assert.equal(response.id, 1, "response id must match request id");
    assert.ok(response.result, "response must have a result");
    assert.ok(
      response.result.serverInfo,
      "result must include serverInfo"
    );
    assert.equal(
      response.result.serverInfo.name,
      "slack-mcp",
      "serverInfo.name must be 'slack-mcp'"
    );
  } finally {
    child.kill();
  }
});

test("tools/list returns exactly 6 tools with non-empty descriptions and input schemas", async () => {
  const { child } = spawnServer({ SLACK_BOT_TOKEN: FAKE_TOKEN });

  const EXPECTED_TOOLS = [
    "slack_create_channel",
    "slack_invite_to_channel",
    "slack_post_message",
    "slack_post_thread",
    "slack_pin_message",
    "slack_list_users",
  ];

  try {
    // Must initialize before listing tools
    await sendRequest(child, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test-client", version: "0.0.1" },
      },
    });

    const response = await sendRequest(child, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    });

    assert.equal(response.jsonrpc, "2.0");
    assert.ok(response.result, "response must have a result");
    assert.ok(Array.isArray(response.result.tools), "result.tools must be an array");

    const tools = response.result.tools;
    assert.equal(tools.length, 6, `expected 6 tools, got ${tools.length}`);

    const toolNames = tools.map((t) => t.name);

    for (const expected of EXPECTED_TOOLS) {
      assert.ok(
        toolNames.includes(expected),
        `missing expected tool: ${expected}`
      );
    }

    for (const tool of tools) {
      assert.ok(
        typeof tool.description === "string" && tool.description.length > 0,
        `tool ${tool.name} must have a non-empty description`
      );
      assert.ok(
        tool.inputSchema && typeof tool.inputSchema === "object",
        `tool ${tool.name} must have an inputSchema`
      );
    }
  } finally {
    child.kill();
  }
});
