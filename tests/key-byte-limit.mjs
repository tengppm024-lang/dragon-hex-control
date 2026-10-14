import assert from 'node:assert/strict';
import worker from '../worker/src/index.js';
let upstreamCalls=0;
globalThis.fetch=async(_url,request)=>{
  upstreamCalls++;
  const {key}=JSON.parse(request.body);
  return Response.json({ok:true,valid:true,key});
};
async function login(key){return worker.fetch(new Request('https://api.test/api/auth',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({key,build:'22'})}),{});}
for(const key of ['ก'.repeat(220),'ก'.repeat(170),'A'.repeat(509)]){
  const response=await login(key);
  assert.equal(response.status,400);
  assert.match((await response.json()).message,/คีย์ยาวเกิน/);
}
assert.equal(upstreamCalls,0,'Invalid input must not reach the KV-backed service');
for(const key of ['ก'.repeat(169),'A'.repeat(508)]){
  const response=await login(key);
  assert.equal(response.status,200);
  assert.equal((await response.json()).key,key,'Do not truncate or alter a key');
}
assert.equal(upstreamCalls,2);
console.log('PASS: UTF-8 KV byte limit includes prefix; invalid keys rejected before upstream; valid boundary keys retained');
