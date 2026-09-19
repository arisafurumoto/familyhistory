import type { FamilyMember, FamilyRelationship } from "./family-shared";
import { formatFamilyMemberDisplayName } from "./family-shared";

const TREE_CARD_WIDTH = 220;
const TREE_CARD_HEIGHT = 164;
const TREE_COLUMN_GAP = 46;
const TREE_ROW_GAP = 86;
const TREE_PADDING_X = 28;
const TREE_PADDING_Y = 32;
const TREE_LABEL_WIDTH = 84;

export type FamilyTreeLayout = {
  generationLabels: Array<{ key: string; text: string; y: number }>;
  height: number;
  lines: Array<{ key: string; kind: "parent" | "spouse"; path: string }>;
  nodes: Array<{
    generation: number;
    person: FamilyMember;
    birthOrderLabel?: string;
    x: number;
    y: number;
  }>;
  width: number;
};


function calculateGenerations(
  members: FamilyMember[],
  parentRelationships: FamilyRelationship[],
  spouseRelationships: FamilyRelationship[],
) {
  const maxGeneration = Math.max(0, members.length - 1);
  const generations = new Map(members.map((member) => [member.id, 0]));
  const maxPasses = Math.max(1, members.length * (parentRelationships.length + 1));

  for (let pass = 0; pass < maxPasses; pass += 1) {
    let changed = false;

    parentRelationships.forEach((relationship) => {
      const parentGeneration = generations.get(relationship.personId) ?? 0;
      const childGeneration = generations.get(relationship.relatedPersonId) ?? 0;
      const nextGeneration = Math.min(parentGeneration + 1, maxGeneration);
      if (childGeneration < nextGeneration) {
        generations.set(relationship.relatedPersonId, nextGeneration);
        changed = true;
      }
    });

    spouseRelationships.forEach((relationship) => {
      const firstGeneration = generations.get(relationship.personId) ?? 0;
      const secondGeneration = generations.get(relationship.relatedPersonId) ?? 0;
      const sharedGeneration = Math.max(firstGeneration, secondGeneration);
      if (firstGeneration !== sharedGeneration) {
        generations.set(relationship.personId, sharedGeneration);
        changed = true;
      }
      if (secondGeneration !== sharedGeneration) {
        generations.set(relationship.relatedPersonId, sharedGeneration);
        changed = true;
      }
    });

    if (!changed) break;
  }

  const minimumGeneration = Math.min(...generations.values(), 0);
  if (minimumGeneration > 0) {
    members.forEach((member) => {
      generations.set(member.id, (generations.get(member.id) ?? 0) - minimumGeneration);
    });
  }

  return generations;
}


type FamilyGroup = { key: string; parentIds: number[]; children: FamilyMember[] };
const personName = (p: FamilyMember) => formatFamilyMemberDisplayName(p.familyName, p.givenName) || p.name;
export function compareFamilyMembers(a: FamilyMember, b: FamilyMember) {
  return (a.birthYear ?? 10000) - (b.birthYear ?? 10000) ||
    (a.birthMonth ?? 1) - (b.birthMonth ?? 1) ||
    (a.birthDay ?? 1) - (b.birthDay ?? 1) ||
    personName(a).localeCompare(personName(b), 'ja-JP') || a.id - b.id;
}

export function groupChildrenByParents(members: FamilyMember[], relationships: FamilyRelationship[]) {
  const ids = new Set(members.map(p => p.id));
  const parents = new Map<number, Set<number>>();
  for (const r of relationships) {
    if (r.relationshipType !== 'parent' || r.personId === r.relatedPersonId || !ids.has(r.personId) || !ids.has(r.relatedPersonId)) continue;
    if (!parents.has(r.relatedPersonId)) parents.set(r.relatedPersonId, new Set());
    parents.get(r.relatedPersonId)!.add(r.personId);
  }
  const groups = new Map<string, FamilyGroup>();
  for (const person of members) {
    const parentIds = [...(parents.get(person.id) ?? [])].sort((a, b) => a - b);
    if (!parentIds.length) continue;
    const key = parentIds.join('-');
    if (!groups.has(key)) groups.set(key, { key, parentIds, children: [] });
    groups.get(key)!.children.push(person);
  }
  return [...groups.values()].map(g => ({ ...g, children: g.children.sort(compareFamilyMembers) }));
}

function birthRange(p: FamilyMember) {
  if (!p.birthYear) return null;
  return [p.birthYear * 10000 + (p.birthMonth ?? 1) * 100 + (p.birthDay ?? 1),
    p.birthYear * 10000 + (p.birthMonth ?? 12) * 100 + (p.birthDay ?? 31)];
}

export function birthOrderLabels(groups: FamilyGroup[]) {
  const labels = new Map<number, string>();
  const ordinal = (n: number) => ['', '長', '次', '三', '四', '五', '六', '七', '八', '九', '十'][n] ?? `第${n}`;
  for (const group of groups) {
    // One known parent does not establish that both parents are the same.
    if (group.parentIds.length !== 2) continue;
    for (const child of group.children) {
      const own = birthRange(child);
      if (!own) continue;
      const others = group.children.filter(p => p.id !== child.id);
      if (others.some(p => { const range = birthRange(p); return !range || (range[0] <= own[1] && range[1] >= own[0]); })) continue;
      const older = others.filter(p => birthRange(p)![1] < own[0]);
      const knownGender = child.gender === 'female' || child.gender === 'male';
      if (!knownGender || older.some(p => p.gender !== 'female' && p.gender !== 'male')) {
        labels.set(child.id, `第${older.length + 1}子`);
      } else {
        const rank = older.filter(p => p.gender === child.gender).length + 1;
        labels.set(child.id, `${ordinal(rank)}${child.gender === 'female' ? '女' : '男'}`);
      }
    }
  }
  return labels;
}

function orderRow(
  people: FamilyMember[], groups: FamilyGroup[], partners: FamilyRelationship[],
  placed: Map<number, FamilyTreeLayout['nodes'][number]>,
) {
  const ids = new Set(people.map(p => p.id));
  const byId = new Map(people.map(p => [p.id, p]));
  const familyOf = new Map<number, FamilyGroup>();
  groups.forEach(g => g.children.forEach(p => familyOf.set(p.id, g)));
  const blocks = new Map<string, FamilyMember[]>();
  for (const p of people) {
    const key = familyOf.get(p.id)?.key ?? `person-${p.id}`;
    blocks.set(key, [...(blocks.get(key) ?? []), p]);
  }
  const anchor = (p: FamilyMember) => {
    const xs = (familyOf.get(p.id)?.parentIds ?? []).map(id => placed.get(id)?.x).filter((x): x is number => x !== undefined);
    return xs.length ? xs.reduce((a,b) => a+b, 0)/xs.length : Number.POSITIVE_INFINITY;
  };
  const sortedBlocks = [...blocks.values()].map(b => b.sort(compareFamilyMembers)).sort((a,b) => {
    const x = anchor(a[0]), y = anchor(b[0]);
    if (x !== y) return x < y ? -1 : 1;
    // Place sibling families first, then insert partners alongside their spouses.
    return b.length - a.length || compareFamilyMembers(a[0], b[0]);
  });
  const partnerIds = new Map<number, Set<number>>();
  for (const r of partners) {
    if (!ids.has(r.personId) || !ids.has(r.relatedPersonId)) continue;
    for (const [a,b] of [[r.personId,r.relatedPersonId],[r.relatedPersonId,r.personId]]) {
      if (!partnerIds.has(a)) partnerIds.set(a,new Set());
      partnerIds.get(a)!.add(b);
    }
  }
  const result: FamilyMember[] = [], used = new Set<number>();
  for (const block of sortedBlocks) for (const p of block) {
    if (used.has(p.id)) continue;
    result.push(p); used.add(p.id);
    const companions = [...(partnerIds.get(p.id) ?? [])].map(id => byId.get(id)!).sort(compareFamilyMembers);
    for (const partner of companions) {
      // Never pull a member out of another multi-child sibling group.
      if (used.has(partner.id) || (familyOf.get(partner.id)?.children.length ?? 0) > 1) continue;
      result.push(partner); used.add(partner.id);
    }
  }
  return result;
}

export function buildFamilyTreeLayout(members: FamilyMember[], relationships: FamilyRelationship[]): FamilyTreeLayout {
  const ids = new Set(members.map(p => p.id));
  const valid = relationships.filter(r => r.personId !== r.relatedPersonId && ids.has(r.personId) && ids.has(r.relatedPersonId));
  const parentRelationships = valid.filter(r => r.relationshipType === 'parent');
  const spouses = valid.filter(r => r.relationshipType === 'spouse');
  const groups = groupChildrenByParents(members, parentRelationships);
  const labels = birthOrderLabels(groups);
  // Co-parents share a generation and are kept together without adding a stored
  // marriage or sibling relationship.
  const coParents = groups.flatMap(g => g.parentIds.slice(1).map(id => ({ id: -1, personId: g.parentIds[0], relatedPersonId: id, relationshipType: 'spouse', createdAt: '' })));
  const partners = [...spouses, ...coParents];
  const generations = calculateGenerations(members, parentRelationships, partners);
  const values = [...new Set(generations.values())].sort((a,b) => a-b);
  const rowPeople = values.map(value => members.filter(p => generations.get(p.id) === value));
  const maxRowWidth = Math.max(TREE_CARD_WIDTH, ...rowPeople.map(p => p.length * TREE_CARD_WIDTH + Math.max(0,p.length-1)*TREE_COLUMN_GAP));
  const width = Math.max(920,maxRowWidth+TREE_LABEL_WIDTH+TREE_PADDING_X*2);
  const nodes: FamilyTreeLayout['nodes'] = [], lines: FamilyTreeLayout['lines'] = [], generationLabels: FamilyTreeLayout['generationLabels'] = [];
  const byId = new Map<number, FamilyTreeLayout['nodes'][number]>();
  const rowGap = Math.max(TREE_ROW_GAP, 48 + groups.length * 12);
  rowPeople.forEach((row, rowIndex) => {
    const people = orderRow(row, groups, partners, byId);
    const rowWidth = people.length* TREE_CARD_WIDTH + Math.max(0,people.length-1)*TREE_COLUMN_GAP;
    const start = TREE_PADDING_X+TREE_LABEL_WIDTH+(maxRowWidth-rowWidth)/2;
    const y = TREE_PADDING_Y + rowIndex*(TREE_CARD_HEIGHT+rowGap);
    generationLabels.push({key:`generation-${rowIndex}`,text:`第${rowIndex+1}世代`,y:y+TREE_CARD_HEIGHT/2});
    people.forEach((person,index) => {
      const node = {person,generation:rowIndex,x:start+index*(TREE_CARD_WIDTH+TREE_COLUMN_GAP),y,birthOrderLabel:labels.get(person.id)};
      nodes.push(node); byId.set(person.id,node);
    });
  });
  const coupleJunctions = new Map<string,{x:number;y:number}>();
  for (const r of spouses) {
    const pair = [r.personId,r.relatedPersonId].sort((a,b)=>a-b).join('-');
    if (coupleJunctions.has(pair)) continue;
    const [left,right] = [byId.get(r.personId)!,byId.get(r.relatedPersonId)!].sort((a,b)=>a.x-b.x);
    const adjacent = left.y === right.y && right.x-left.x <= TREE_CARD_WIDTH+TREE_COLUMN_GAP;
    const y = adjacent ? left.y+TREE_CARD_HEIGHT/2 : Math.min(left.y,right.y)-18;
    const x = (left.x+TREE_CARD_WIDTH+right.x)/2;
    coupleJunctions.set(pair,{x,y});
    lines.push({key:`spouse-${pair}`,kind:'spouse',path:adjacent
      ? `M ${left.x+TREE_CARD_WIDTH} ${y} H ${right.x}`
      : `M ${left.x+TREE_CARD_WIDTH/2} ${left.y} V ${y} H ${right.x+TREE_CARD_WIDTH/2} V ${right.y}`});
  }
  groups.forEach((group,index) => {
    const parents = group.parentIds.map(id=>byId.get(id)!);
    const childrenByRow = new Map<number,typeof nodes>();
    group.children.forEach(p=>{const node=byId.get(p.id)!;childrenByRow.set(node.generation,[...(childrenByRow.get(node.generation)??[]),node]);});
    for (const [row,children] of childrenByRow) {
      const bottom = Math.max(...parents.map(p=>p.y+TREE_CARD_HEIGHT));
      const childTop = Math.min(...children.map(c=>c.y));
      const minX = Math.min(...children.map(c=>c.x+TREE_CARD_WIDTH/2));
      const maxX = Math.max(...children.map(c=>c.x+TREE_CARD_WIDTH/2));
      const spouse = group.parentIds.length===2 ? coupleJunctions.get(group.key) : undefined;
      const adjacentSpouse = spouse && Math.abs(parents[0].x-parents[1].x) <= TREE_CARD_WIDTH+TREE_COLUMN_GAP;
      const joinY = bottom+16;
      const joinX = parents.reduce((sum,p)=>sum+p.x+TREE_CARD_WIDTH/2,0)/parents.length;
      const busY = childTop>bottom ? bottom+32+(index*12) % Math.max(12,rowGap-48) : childTop-24;
      const key=`family-${group.key}-${row}`;
      if (!adjacentSpouse && parents.length>1) {
        const xs=parents.map(p=>p.x+TREE_CARD_WIDTH/2);
        lines.push({key:key+'-parents',kind:'parent',path:parents.map((p,i)=>`M ${xs[i]} ${p.y+TREE_CARD_HEIGHT} V ${joinY}`).join(' ')+` M ${Math.min(...xs)} ${joinY} H ${Math.max(...xs)}`});
      }
      const startX = adjacentSpouse ? spouse.x : joinX;
      const startY = adjacentSpouse ? spouse.y : parents.length>1 ? joinY : bottom;
      lines.push({key:key+'-trunk',kind:'parent',path:`M ${startX} ${startY} V ${busY} M ${Math.min(startX,minX)} ${busY} H ${Math.max(startX,maxX)}`});
      for (const child of children) lines.push({key:key+`-child-${child.person.id}`,kind:'parent',path:`M ${child.x+TREE_CARD_WIDTH/2} ${busY} V ${child.y}`});
    }
  });
  return {nodes,lines,generationLabels,width,height:TREE_PADDING_Y*2+rowPeople.length*TREE_CARD_HEIGHT+Math.max(0,rowPeople.length-1)*rowGap};
}
