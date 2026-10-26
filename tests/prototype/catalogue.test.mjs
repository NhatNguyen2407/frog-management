import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
const context = {};
runInNewContext(readFileSync("public/prototype/catalogue.js","utf8"),context);
const {validate,view}=context.FrogCatalogue;
const item={id:"WS-001",name:"Workshop Tote",category:"workshop",price:100000,cost:35000,stock:10};
test("create product validates unique SKU and integer VND amounts",()=>{
  const input={id:"fb-01",name:" Cookie ",category:"food",price:"25000",cost:"9000"};
  assert.deepEqual(JSON.parse(JSON.stringify(validate(input,[item]).data)),{id:"FB-01",name:"Cookie",category:"food",price:25000,cost:9000});
  assert.ok(validate({...input,id:"WS-001"},[item]).error);
  assert.ok(validate({...input,price:"-1"},[item]).error);
  assert.ok(validate({...input,price:"1.5"},[item]).error);
  assert.ok(validate({...input,category:"invalid"},[item]).error);
  assert.ok(validate({...input,id:"FB-01"},[item],"WS-001").error);
});
test("archive filters products without removing them",()=>{
  const data=[item,{...item,id:"WS-002",active:false}];
  const active=view(data,"en",String,String,"","active");
  const archived=view(data,"en",String,String,"","archived");
  assert.match(active,/WS-001/);assert.doesNotMatch(active,/WS-002/);
  assert.match(archived,/WS-002/);assert.doesNotMatch(archived,/WS-001/);
});
