export type GrantNode = {key: string; parentKey?: string | null; label: string; status?: string};
export type GrantBranch = GrantNode & {children: GrantBranch[]; path: string};

export function grantForest(nodes: readonly GrantNode[]): GrantBranch[] {
  const byKey = new Map<string, GrantBranch>();
  for (const node of nodes) {
    if (!node.key || byKey.has(node.key)) throw new Error('Invalid grant identities.');
    byKey.set(node.key, {...node, children: [], path: ''});
  }
  const roots: GrantBranch[] = [];
  for (const node of byKey.values()) {
    const visited = new Set([node.key]); let parent = node.parentKey;
    while (parent && byKey.has(parent)) {
      if (visited.has(parent)) throw new Error('Invalid grant hierarchy.');
      visited.add(parent); parent = byKey.get(parent)?.parentKey;
    }
    const owner = node.parentKey ? byKey.get(node.parentKey) : undefined;
    if (owner) owner.children.push(node); else roots.push(node);
  }
  function paths(branch: GrantBranch, prefix: string) {
    branch.path = prefix ? `${prefix} / ${branch.label}` : branch.label;
    branch.children.forEach(child => paths(child, branch.path));
  }
  roots.forEach(root => paths(root, '')); return roots;
}
export function grantState(nodes: readonly GrantNode[], seeds: readonly string[], linked: boolean) {
  const full = new Set<string>(), half = new Set<string>(), chosen = new Set(seeds);
  function visit(node: GrantBranch): boolean {
    // Existing associations are explicit. Cascade only after a user toggles a node.
    const direct = chosen.has(node.key);
    const children = node.children.map(child => visit(child));
    if (direct || (linked && children.length > 0 && children.every(Boolean))) full.add(node.key);
    else if (linked && node.children.some(child => full.has(child.key) || half.has(child.key))) half.add(node.key);
    return full.has(node.key);
  }
  grantForest(nodes).forEach(root => visit(root));
  seeds.filter(key => !nodes.some(node => node.key === key)).forEach(key => full.add(key));
  return {full, half};
}
export function submittedGrants(nodes: readonly GrantNode[], seeds: readonly string[], linked: boolean): string[] {
  const state = grantState(nodes, seeds, linked); return [...new Set([...state.full, ...state.half])];
}
export function toggleGrant(nodes: readonly GrantNode[], seeds: readonly string[], key: string, checked: boolean, linked: boolean): string[] {
  const selected = linked ? grantState(nodes, seeds, true).full : new Set(seeds);
  const byKey = new Map(nodes.map(node => [node.key, node]));
  function descendants(id: string) {
    if (checked) selected.add(id); else selected.delete(id);
    if (linked) nodes.filter(node => node.parentKey === id).forEach(node => descendants(node.key));
  }
  descendants(key);
  if (linked) {
    let parent = byKey.get(key)?.parentKey;
    while (parent && byKey.has(parent)) { selected.delete(parent); parent = byKey.get(parent)?.parentKey; }
  }
  return [...selected];
}
/** Raw association parents must not cascade over an existing partial selection. */
export function linkedSeeds(nodes: readonly GrantNode[], raw: readonly string[]): string[] {
  const chosen = new Set(raw), byKey = new Map(nodes.map(node => [node.key, node]));
  for (const key of raw) {
    let parent = byKey.get(key)?.parentKey;
    while (parent && byKey.has(parent)) { chosen.delete(parent); parent = byKey.get(parent)?.parentKey; }
  }
  return [...chosen];
}
