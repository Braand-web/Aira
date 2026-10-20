// UI observations only: no effect on authorization, tools, billing or the agent prompt.
/** @typedef {{messageId:string,state:string,detail?:string,startedAt:number,endedAt?:number}} AgentStatus */
/** @returns {AgentStatus} */
export function startAgentStatus(messageId, now = Date.now()) {
  return {messageId, state:'thinking', detail:'Connexion au modèle', startedAt:now};
}
const toolStates = {
  search_workspace:['analyzing','Lecture de votre projet'],
  read_meta:['analyzing','Lecture des données Meta'],
  create_page:['writing','Création de votre page'],
  revise_page:['writing','Modification de votre page'],
  media_catalog:['analyzing','Consultation des modèles média'],
  propose_media:['analyzing','Préparation du visuel'],
  plan_mission:['analyzing','Préparation de la mission'],
  COMPOSIO_SEARCH_TOOLS:['analyzing','Recherche des outils disponibles'],
};
/** @param {AgentStatus|null} current @param {string} event @param {Record<string,unknown>} data @returns {AgentStatus|null} */
export function agentStatusEvent(current, event, data = {}, now = Date.now()) {
  if (!current || current.endedAt !== undefined) return current;
  if (event === 'done' || event === 'error' || event === 'cancelled') return {...current,state:event,detail:undefined,endedAt:now};
  if (event === 'text_delta' && typeof data.text === 'string' && data.text.length) return {...current,state:'writing',detail:undefined};
  if (event === 'specialist_start') return {...current,state:'analyzing',detail:data.role === 'creative' ? 'Spécialiste créatif' : 'Spécialiste campagnes'};
  if (event === 'tool_start') {
    const [state, detail] = typeof data.name === 'string' && Object.hasOwn(toolStates, data.name) ? toolStates[data.name] : ['analyzing','Utilisation d’un outil'];
    return {...current,state,detail};
  }
  if (['run','specialist_done','tool_result'].includes(event)) return {...current,state:'thinking',detail:undefined};
  return current;
}
