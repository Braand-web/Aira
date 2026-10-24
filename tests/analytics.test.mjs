import assert from 'node:assert/strict';
import test from 'node:test';
import {analyticsRange,summarizeAnalytics,metricChange,dailyAnalytics,analyticsCSV} from '../lib/analytics.mjs';
import {demoAnalytics} from '../scripts/demo/analytics.mjs';

test('analytics compares equal completed calendar periods in the account timezone',()=>{
 const range=analyticsRange(7,'America/Los_Angeles',Date.parse('2026-03-09T01:00:00Z'));
 assert.deepEqual(range,{days:7,timezone:'America/Los_Angeles',since:'2026-03-01',until:'2026-03-07',previousSince:'2026-02-22',previousUntil:'2026-02-28'});
 assert.throws(()=>analyticsRange(31));
});
test('ratios are weighted from totals and missing values cannot become real zeros',()=>{
 const totals=summarizeAnalytics([{spend:'100',clicks:'10',impressions:'100'},{spend:'100',clicks:'2',impressions:'300'}]);
 assert.equal(totals.ctr,3);assert.equal(totals.cpc,200/12);assert.equal(totals.cpm,500);
 assert.equal(summarizeAnalytics([{clicks:1,impressions:10}]).spend,null);
 assert.equal(summarizeAnalytics([{spend:'invalid',clicks:1}]).cpc,null);
 assert.equal(summarizeAnalytics([{spend:0,clicks:2,impressions:4}]).cpc,0);
 assert.equal(summarizeAnalytics([{spend:4,clicks:0,impressions:0}]).cpc,null);
 assert.equal(metricChange(1,0),null);assert.equal(metricChange(null,1),null);assert.equal(metricChange(50,100),-50);
});
test('daily reports preserve missing observations and do not join them to zero',()=>{
 const series=dailyAnalytics([{date_start:'2026-10-01',spend:0,clicks:0,impressions:0},{date_start:'2026-10-03',spend:30,clicks:3,impressions:300}],'2026-10-01',3);
 assert.equal(series[0].metrics.clicks,0);assert.equal(series[1].metrics,null);assert.equal(series[2].metrics.clicks,3);
});
test('CSV exports preserve missing ratios, UTF-8 and escape campaign formulas and quotes',()=>{
 const csv=analyticsCSV([{campaign_name:'=SUM(1;2) "test"',spend:0,clicks:0,impressions:0}],{name:'Compte',currency:'XAF'},{since:'2026-10-01',until:'2026-10-07'});
 assert.equal(csv.charCodeAt(0),0xfeff);assert.ok(csv.includes('"\'=SUM(1;2) ""test"""'));assert.ok(csv.endsWith(';"";"";""'));
});
test('fictional daily preview data reconciles with campaign totals for all three periods',()=>{
 for(const days of [7,30,90]){
  const report=demoAnalytics(days,Date.parse('2026-10-24T12:00:00Z'));
  assert.equal(report.demonstration,true);assert.equal(report.daily.data.length,days);assert.equal(report.comparison.data.length,days);
  assert.deepEqual(summarizeAnalytics(report.daily.data),summarizeAnalytics(report.insights.data));
  assert.equal(report.daily.data[0].date_start,report.range.since);assert.equal(report.daily.data.at(-1).date_stop,report.range.until);
 }
});
