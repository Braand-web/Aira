import assert from 'node:assert/strict';
import {test} from 'node:test';
import {startAgentStatus,agentStatusEvent} from '../lib/agent-status.mjs';

test('Working labels follow actual stream events and keep the original start time',()=>{
  let status=startAgentStatus('answer-1',1000);
  status=agentStatusEvent(status,'run',{},2000);
  assert.equal(status.state,'thinking');
  status=agentStatusEvent(status,'specialist_start',{role:'creative'},3000);
  assert.equal(status.state,'analyzing');
  assert.equal(status.detail,'Spécialiste créatif');
  status=agentStatusEvent(status,'tool_start',{name:'read_meta'},4000);
  assert.equal(status.detail,'Lecture des données Meta');
  status=agentStatusEvent(status,'tool_result',{},5000);
  assert.equal(status.state,'thinking');
  status=agentStatusEvent(status,'text_delta',{text:'Voici'},6000);
  assert.equal(status.state,'writing');
  assert.equal(status.startedAt,1000);
  assert.equal(status.endedAt,undefined);
});

test('Text and tool results never imply completion; only the terminal server event does',()=>{
  let status=startAgentStatus('answer-2',1000);
  status=agentStatusEvent(status,'text_delta',{text:'Du texte reçu'},2500);
  status=agentStatusEvent(status,'tool_result',{result:{status:'completed'}},3500);
  assert.equal(status.endedAt,undefined);
  assert.notEqual(status.state,'done');
  status=agentStatusEvent(status,'done',{},9000);
  assert.equal(status.state,'done');
  assert.equal(status.endedAt-status.startedAt,8000);
});

test('Errors and stops remain distinct, and late events cannot restart a terminal run',()=>{
  const initial=startAgentStatus('answer-3',1000);
  for(const event of ['error','cancelled']){
    const terminal=agentStatusEvent(initial,event,{},4500);
    assert.equal(terminal.state,event);
    assert.equal(terminal.endedAt,4500);
    assert.equal(agentStatusEvent(terminal,'text_delta',{text:'Late text'},5000),terminal);
    assert.equal(agentStatusEvent(terminal,'done',{},6000),terminal);
  }
});

test('Unknown events and unrecognized tool names cannot invent a search or break status',()=>{
  const initial=startAgentStatus('answer-4',1000);
  assert.equal(agentStatusEvent(initial,'provider_future_event',{}),initial);
  assert.equal(agentStatusEvent(initial,'text_delta',{text:''}),initial);
  for(const name of ['UNKNOWN_TOOL','__proto__','constructor',null]){
    const status=agentStatusEvent(initial,'tool_start',{name});
    assert.equal(status.state,'analyzing');
    assert.equal(status.detail,'Utilisation d’un outil');
  }
  assert.equal(agentStatusEvent(null,'done',{}),null);
});
