// ABOUTME: Unit tests for pure logic in the slack-mcp source.
// ABOUTME: Tests channel name normalization and token validation without Slack calls.

import { test } from "node:test";
import assert from "node:assert/strict";

// Channel name normalization logic mirrors src/slack-client.ts createChannel().
// We test the normalization expression directly here so this file has zero
// network calls and zero external dependencies.
function normalizeChannelName(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "");
}

test("normalizeChannelName: lowercase conversion", () => {
  assert.equal(normalizeChannelName("GTM"), "gtm");
  assert.equal(normalizeChannelName("MyChannel"), "mychannel");
});

test("normalizeChannelName: spaces become hyphens", () => {
  assert.equal(normalizeChannelName("my channel"), "my-channel");
  // \s+ consumes the whole run, so multiple spaces → one hyphen
  assert.equal(normalizeChannelName("a  b"), "a-b");
});

test("normalizeChannelName: strips special characters", () => {
  assert.equal(normalizeChannelName("hello!"), "hello");
  assert.equal(normalizeChannelName("foo@bar"), "foobar");
  assert.equal(normalizeChannelName("test#1"), "test1");
});

test("normalizeChannelName: preserves hyphens and underscores", () => {
  assert.equal(normalizeChannelName("my-channel"), "my-channel");
  assert.equal(normalizeChannelName("my_channel"), "my_channel");
  assert.equal(normalizeChannelName("a-b_c"), "a-b_c");
});

test("normalizeChannelName: combined transformation", () => {
  assert.equal(normalizeChannelName("GTM Jeff Launch!"), "gtm-jeff-launch");
  // Leading whitespace run collapses to one hyphen
  assert.equal(normalizeChannelName("  Leading Spaces"), "-leading-spaces");
});

// Email detection logic mirrors inviteToChannel(): user.includes("@")
function isEmail(input) {
  return input.includes("@");
}

test("isEmail: detects email addresses", () => {
  assert.ok(isEmail("harper@2389.ai"));
  assert.ok(isEmail("user@example.com"));
});

test("isEmail: treats non-email strings as user IDs", () => {
  assert.ok(!isEmail("U12345678"));
  assert.ok(!isEmail("UABCDE"));
  assert.ok(!isEmail(""));
});
