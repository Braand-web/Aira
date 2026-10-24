const autonomousToolNames = new Set(["search_workspace", "get_workspace_resource", "read_meta", "plan_mission", "search_skills", "read_skill"]);

export function agentToolsForMode(workMode, standardTools, connectorTools = []) {
  if (workMode !== "autonomous") return [...standardTools, ...connectorTools];
  return standardTools.filter((tool) => autonomousToolNames.has(tool.name));
}

export function agentToolAllowedForMode(workMode, toolName) {
  return workMode !== "autonomous" || autonomousToolNames.has(toolName);
}
