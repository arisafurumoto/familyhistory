import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const dir = await mkdtemp(`${tmpdir()}/family-layout-`);
await build({entryPoints:['app/family-tree-layout.ts'],outfile:`${dir}/layout.mjs`,bundle:true,platform:'node',format:'esm'});
const {buildFamilyTreeLayout,groupChildrenByParents,birthOrderLabels}=await import(pathToFileURL(`${dir}/layout.mjs`));
test.after(()=>rm(dir,{recursive:true,force:true}));
const person=(id,year,gender='',month=1,day=1)=>({id,name:`人物${id}`,familyName:'家族',givenName:`${id}`,birthYear:year,birthMonth:month,birthDay:day,gender});
const rel=(from,to,type='parent')=>({id:from*100+to,personId:from,relatedPersonId:to,relationshipType:type});
const parents=[person(1,1951,'male'),person(2,1957,'female')];
const sisters=[person(3,1983,'female'),person(4,1990,'female')];
const links=[rel(1,2,'spouse'),rel(1,3),rel(2,3),rel(1,4),rel(2,4)];
const labels=(people,relationships)=>birthOrderLabels(groupChildrenByParents(people,relationships));

test('two parents and two children use one shared trunk and one drop per child',()=>{
 const layout=buildFamilyTreeLayout([...parents,...sisters],links);
 assert.equal(layout.lines.filter(l=>l.key.endsWith('-trunk')).length,1);
 assert.equal(layout.lines.filter(l=>l.key.includes('-child-')).length,2);
 assert.equal(layout.lines.filter(l=>l.kind==='spouse').length,1);
 assert.equal(layout.nodes.find(n=>n.person.id===3).birthOrderLabel,'長女');
 assert.equal(layout.nodes.find(n=>n.person.id===4).birthOrderLabel,'次女');
 assert.ok(layout.nodes.find(n=>n.person.id===3).x<layout.nodes.find(n=>n.person.id===4).x);
 assert.ok(layout.lines.every(l=>!l.path.includes('NaN')));
});
test('month and day order siblings independently of registration order or spouse age',()=>{
 const people=[...parents,person(4,1990,'female',5,20),person(3,1990,'female',5,2),person(5,1980,'male')];
 const layout=buildFamilyTreeLayout(people,[...links,rel(4,5,'spouse')]);
 const nodes=new Map(layout.nodes.map(n=>[n.person.id,n]));
 assert.ok(nodes.get(3).x<nodes.get(4).x);
 assert.equal(nodes.get(4).birthOrderLabel,'次女');
 assert.equal(nodes.get(5).x-nodes.get(4).x,266);
});
test('sons and daughters have independent birth order',()=>{
 const children=[person(3,1980,'male'),person(4,1982,'female'),person(5,1984,'female'),person(6,1986,'male')];
 const result=labels([...parents,...children],children.flatMap(c=>[rel(1,c.id),rel(2,c.id)]));
 assert.deepEqual([...result.values()],['長男','長女','次女','次男']);
});
test('unknown gender falls back to child order without guessing',()=>{
 const result=labels([...parents,person(3,1983),person(4,1990,'female')],links);
 assert.equal(result.get(3),'第1子'); assert.equal(result.get(4),'第2子');
});
test('ambiguous birthdays and missing years do not invent an ordinal',()=>{
 for(const children of [[person(3,1990,'female',null,null),person(4,1990,'female',5,1)], [person(3,null,'female'),person(4,1990,'female')],[person(3,1990,'female'),person(4,1990,'female')]]) {
  assert.equal(labels([...parents,...children],links).size,0);
 }
});
test('one parent is grouped visually but does not establish full siblings',()=>{
 const layout=buildFamilyTreeLayout([parents[0],...sisters],[rel(1,3),rel(1,4)]);
 assert.equal(layout.lines.filter(l=>l.key.endsWith('-trunk')).length,1);
 assert.ok(layout.nodes.every(n=>!n.birthOrderLabel));
});
test('different parent sets are not combined; duplicate relationships are deduplicated',()=>{
 const people=[...parents,...sisters,person(5,1955,'female')];
 const r=[rel(1,3),rel(2,3),rel(1,4),rel(5,4),rel(1,3)];
 const layout=buildFamilyTreeLayout(people,r);
 assert.equal(layout.lines.filter(l=>l.key.endsWith('-trunk')).length,2);
 assert.equal(layout.lines.filter(l=>l.key.includes('-child-')).length,2);
});
test('shared parents without a marriage link are connected without inventing a marriage',()=>{
 const layout=buildFamilyTreeLayout([...parents,...sisters],links.slice(1));
 assert.equal(layout.lines.filter(l=>l.kind==='spouse').length,0);
 assert.equal(layout.lines.filter(l=>l.key.endsWith('-parents')).length,1);
 assert.equal(layout.lines.filter(l=>l.key.endsWith('-trunk')).length,1);
});
test('empty, disconnected and dangling records remain finite',()=>{
 for(const people of [[],[person(1,1990)],[person(1,1990),person(2,null)]]) {
  const layout=buildFamilyTreeLayout(people,[rel(1,99),rel(1,1)]);
  assert.equal(layout.nodes.length,people.length);
  assert.ok(Number.isFinite(layout.width)&&Number.isFinite(layout.height));
  assert.equal(layout.lines.length,0);
 }
});
