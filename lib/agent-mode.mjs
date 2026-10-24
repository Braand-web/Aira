const autonomousToolNames = new Set(['search_workspace','get_workspace_resource','search_memory','search_conversation','read_meta','plan_mission','search_skills','read_skill']);
const missionToolNames = new Set([...autonomousToolNames,'save_deliverable','revise_deliverable','create_page','revise_page','delegate_specialist','verify_deliverable','save_work_checkpoint','update_work_plan','prepare_media','propose_media']);
export function agentToolsForMode(workMode, standardTools, connectorTools = []) {
 if(workMode==='autonomous')return standardTools.filter(tool=>autonomousToolNames.has(tool.name));
 if(workMode==='approved_mission')return standardTools.filter(tool=>missionToolNames.has(tool.name));
 return [...standardTools,...connectorTools];
}
export function agentToolAllowedForMode(workMode,toolName){return workMode==='autonomous'?autonomousToolNames.has(toolName):workMode==='approved_mission'?missionToolNames.has(toolName):workMode==='accompanied';}
