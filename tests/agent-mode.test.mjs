import assert from "node:assert/strict";
import test from "node:test";
import { agentToolAllowedForMode, agentToolsForMode } from "../lib/agent-mode.mjs";

const standardTools = [
  { name: "search_workspace" },
  { name: "read_meta" },
  { name: "plan_mission" },
  { name: "create_page" },
  { name: "propose_media" },
];
const connectorTools = [{ name: "COMPOSIO_SEARCH_TOOLS" }, { name: "aira_connector_action" }];

test("accompanied mode retains normal and connected tools", () => {
  assert.deepEqual(
    agentToolsForMode("accompanied", standardTools, connectorTools).map((tool) => tool.name),
    [...standardTools, ...connectorTools].map((tool) => tool.name),
  );
  assert.equal(agentToolAllowedForMode("accompanied", "aira_connector_action"), true);
});

test("autonomous mode exposes only safe reads and draft mission planning", () => {
  assert.deepEqual(
    agentToolsForMode("autonomous", standardTools, connectorTools).map((tool) => tool.name),
    ["search_workspace", "read_meta", "plan_mission"],
  );
  assert.equal(agentToolAllowedForMode("autonomous", "plan_mission"), true);
  assert.equal(agentToolAllowedForMode("autonomous", "create_page"), false);
  assert.equal(agentToolAllowedForMode("autonomous", "aira_connector_action"), false);
});
